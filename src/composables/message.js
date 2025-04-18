/**
 * @fileoverview Interacts with the Llama 4 Scout AI model.
 */

// Centralized API endpoint
const API_ENDPOINT = "https://ai.hackclub.com/chat/completions"; // Replace if needed

/**
 * Helper function to log message arrays as raw text to the console.
 * @param {object[]} messages - Array of message objects.
 * @param {string} prefix - Prefix for each log line.
 */
function _logMessagesRaw(messages, prefix) {
  console.log(`${prefix} Messages:`);
  messages.forEach((msg) => {
    console.log(`${prefix} Role: ${msg.role}`);
    const contentToLog =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
    console.log(`${prefix} Content:\n${contentToLog}`);
    console.log(`${prefix} ---`);
  });
}

/**
 * Helper function to interact with the Llama 4 Scout API.
 * Handles fetch requests, basic error handling, and logging raw text.
 * @param {object[]} messages - The array of message objects for the API call.
 * @param {boolean} stream - Whether to request a streaming response.
 * @param {AbortSignal} signal - AbortController signal for cancellation.
 * @param {string} requestDescription - A description for logging purposes.
 * @returns {Promise<object|Response>} - Promise resolving to JSON data or Response.
 * @throws {Error} If the API call fails.
 */
async function _callLlama4Scout(messages, stream, signal, requestDescription) {
  console.log(`=== NEW REQUEST === (${requestDescription})`);
  _logMessagesRaw(messages, `[${requestDescription} Request]`);

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messages,
        stream: stream,
      }),
      signal: signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[${requestDescription}] API Error Status: ${response.status}`
      );
      console.error(
        `[${requestDescription}] API Error Response:\n${errorText}`
      );
      throw new Error(
        `API call failed for ${requestDescription} with status ${response.status}`
      );
    }

    console.log(
      `[${requestDescription}] API call successful (stream=${stream}).`
    );
    return stream ? response : await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      console.log(`[${requestDescription}] API call aborted.`);
    } else {
      console.error(`[${requestDescription}] Fetch error: ${error.message}`);
      console.error(error.stack);
    }
    throw error;
  }
}

/**
 * Determines if a simulated reasoning process (chain-of-thought) should be used.
 * (This function remains the same)
 * @param {string} prompt - The user's latest input prompt.
 * @param {object[]} plainMessages - Simplified conversation history.
 * @returns {Promise<boolean>} - Promise resolving to true/false.
 */
export async function shouldUseReasoning(prompt, plainMessages) {
  let historyString = "No history provided.";
  if (plainMessages && plainMessages.length > 0) {
    historyString = plainMessages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");
  }

  const systemMsg = `You are an analyzer determining if a complex reasoning process is needed for a user query. Analyze the user's query and conversation history based on the rules below. First, briefly explain your reasoning in one sentence, then conclude with "Decision: true" or "Decision: false" on a new line.

**Conversation History:**
${historyString}

**Analysis Rules:**
1.  **Overrides:**
    * If the LATEST user query contains keywords like "use reasoning", "show thoughts", "think step-by-step", "agentic", "plan and execute", respond with "true".
    * If the LATEST user query contains keywords like "no reasoning", "simple answer", "quick response", respond with "false".
2.  **Complexity Assessment (if no overrides):**
    * Respond with "true" if the query likely requires multiple steps, planning, logical deduction, calculations, code generation, or breaking down into sub-problems. Examples: "Write a python script for...", "Compare the pros and cons of...", "Plan a trip to...".
    * Respond with "false" if the query asks for simple facts, definitions, summarizations of provided text, or straightforward instructions. Examples: "What is the capital of France?", "Summarize this text: ...", "Hello".

**Your Task:** Analyze the LATEST user query below in the context of the history. Provide a one-sentence rationale, then the decision.

**Latest User Query:**
${prompt}`;

  const messages = [{ role: "system", content: systemMsg }];

  try {
    const data = await _callLlama4Scout(
      messages,
      false,
      null,
      "Reasoning Check"
    );
    if (
      !data ||
      !data.choices ||
      data.choices.length === 0 ||
      !data.choices[0].message
    ) {
      console.error(
        "[Reasoning Check] Invalid response structure received from API."
      );
      throw new Error(
        "Received invalid response structure from reasoning check API call."
      );
    }
    const rawContent = data.choices[0].message.content.trim();
    console.log("[Reasoning Check] Raw LLM Response:\n" + rawContent);
    const decisionMatch = rawContent.match(/Decision:\s*(true|false)$/i);
    if (decisionMatch && decisionMatch[1]) {
      const decision = decisionMatch[1].toLowerCase() === "true";
      console.log("[Reasoning Check] Decision: " + decision);
      return decision;
    } else {
      console.warn(
        "[Reasoning Check] Could not find 'Decision: true/false'. Attempting fallback interpretation based on raw text."
      );
      if (rawContent.toLowerCase().includes("true")) {
        console.log("[Reasoning Check] Fallback decision: true");
        return true;
      }
      if (rawContent.toLowerCase().includes("false")) {
        console.log("[Reasoning Check] Fallback decision: false");
        return false;
      }
      console.warn("[Reasoning Check] Fallback failed. Defaulting to 'false'.");
      return false;
    }
  } catch (error) {
    console.error(`Error in shouldUseReasoning: ${error.message}`);
    return false;
  }
}

/**
 * Simulates reasoning using Plan -> Solve -> Reflect -> Summarize flow
 * with enhanced prompts for better phase adherence. Yields intermediate steps.
 *
 * @param {string} system_prompt - Base system prompt.
 * @param {string} global_memory - Persistent information.
 * @param {object[]} plainMessages - Simplified conversation history.
 * @param {string} prompt - The user's input prompt.
 * @param {AbortController} controller - AbortController for cancellation.
 * @yields {string} Chunks of the thinking process (Plan, Solve, Reflect) and final summary.
 */
export async function* streamChainOfThought(
  system_prompt,
  global_memory,
  plainMessages,
  prompt,
  controller
) {
  let fullThinkingProcess = "🤔 Let me think this through step by step\n\n";
  console.log(fullThinkingProcess);
  yield fullThinkingProcess;

  // --- Context Setup ---
  let historyString = "No history provided.";
  if (plainMessages && plainMessages.length > 0) {
    historyString = plainMessages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");
  }
  const baseContextMessages = [
    { role: "system", content: system_prompt },
    {
      role: "system",
      content: `Relevant Memory/Scratchpad:\n${global_memory || "None provided."}`,
    },
    {
      role: "system",
      content: `Conversation History (for context):\n${historyString}`,
    },
    // User prompt is added specifically for the phase that needs it most directly
  ];

  let planText = "";
  let solveText = "";
  let reflectionText = "";

  try {
    // --- PHASE 1: PLAN ---
    const planHeader = `### PLAN ###\n`;
    fullThinkingProcess += planHeader;
    console.log(planHeader);
    yield planHeader; // Yield header immediately

    // Enhanced prompt for PLAN phase
    const planSystemPrompt = `[ROLE] You are ONLY the PLANNER. Your sole task is to outline the steps needed to solve the user's request.

[CONTEXT] Consider the user's request below, plus any relevant conversation history and memory provided earlier.
User Request: ${prompt}

[TASK] Create a concise, step-by-step plan in plain text describing HOW you will solve the request. List the main stages or actions you will take.

[OUTPUT FORMAT] Output *only* the plan text itself.

[IMPORTANT] Stick strictly to your role as PLANNER. Do *not* actually perform the steps or solve the problem now. Your output must be the plan only.`;

    // Include user prompt specifically for planning context
    const planMessages = [
      ...baseContextMessages,
      { role: "user", content: prompt },
      { role: "system", content: planSystemPrompt },
    ];
    const planData = await _callLlama4Scout(
      planMessages,
      false,
      controller.signal,
      "Plan Phase"
    );
    if (!planData || !planData.choices || !planData.choices[0].message)
      throw new Error("Invalid PLAN response");
    planText = planData.choices[0].message.content.trim();

    const planOutput = `${planText}\n\n`; // Plan text + spacing
    fullThinkingProcess += planOutput;
    console.log(planText); // Log the plan text
    yield planOutput; // Yield the plan text

    // --- PHASE 2: SOLVE ---
    const solveHeader = `### SOLVE ###\n`;
    fullThinkingProcess += solveHeader;
    console.log(solveHeader);
    yield solveHeader; // Yield header immediately

    // Enhanced prompt for SOLVE phase
    const solveSystemPrompt = `[ROLE] You are ONLY the SOLVER. Your sole task is to execute the plan created previously.

[CONTEXT] Execute the plan below to address the original user request.
User Request: ${prompt}
Your Plan:
${planText}

[TASK] Follow the plan. Reason step-by-step, applying logical inference based on the given information and any relevant rules or constraints. Consider different possibilities and evaluate them against the known facts. Build towards a conclusion by ensuring each step is consistent with the initial conditions and prior deductions. If the information leads to an ambiguous or impossible outcome, identify and state that limitation.

[OUTPUT FORMAT] Output *ONLY* your reasoning process and conclusion.

[IMPORTANT] Stick strictly to your role as SOLVER executing the provided plan. Your output must be the reasoning process.
`;

    // Include user prompt and plan as context
    const solveMessages = [
      ...baseContextMessages, // Base context (system prompt, memory, history)
      { role: "user", content: prompt }, // Original request
      { role: "system", content: `[CONTEXT: Your Plan]\n${planText}` }, // Plan context
      { role: "system", content: solveSystemPrompt }, // Solve instruction
    ];
    const solveData = await _callLlama4Scout(
      solveMessages,
      false,
      controller.signal,
      `Solve Phase`
    );
    if (!solveData || !solveData.choices || !solveData.choices[0].message)
      throw new Error(`Invalid SOLVE response`);
    solveText = solveData.choices[0].message.content.trim();

    const solveOutput = `${solveText}\n\n`; // Solve text + spacing
    fullThinkingProcess += solveOutput;
    console.log(solveText); // Log the solve text
    yield solveOutput; // Yield the solve text

    // --- PHASE 3: REFLECT ---
    const reflectHeader = `### REFLECT ###\n`;
    fullThinkingProcess += reflectHeader;
    console.log(reflectHeader);
    yield reflectHeader; // Yield header immediately

    // Enhanced prompt for REFLECT phase
    const reflectSystemPrompt = `[ROLE] You are ONLY the REVIEWER. Your sole task is to critically evaluate the reasoning process and conclusion performed previously.

[CONTEXT] Review the original user request, the plan, and the complete reasoning process provided below.
User Request: ${prompt}
Plan Created:
${planText}

[TASK] Critically evaluate the reasoning process based on the plan and the original request.
 - Was the reasoning process logical and sound?
 - Does the conclusion follow validly from the initial information and steps taken?
 - Is the conclusion consistent with all given facts and constraints?
 - Were potential ambiguities or impossibilities identified correctly?
 - **Based on your critique, determine if the reasoning attempt was successful or if a retry is needed.**

Provide your review as concise points. Conclude your response with a line indicating if a retry is needed, using the format: "RETRY_NEEDED: Yes" or "RETRY_NEEDED: No".

[OUTPUT FORMAT] Output *only* your critique, followed by the RETRY_NEEDED line.

[IMPORTANT] Stick strictly to your role as REVIEWER. Do *not* repeat the plan or reasoning. Do *not* re-solve the problem. Your output must be the critique and the retry decision.`;

    const reflectMessages = [
      // Minimal context needed: just the instruction and the items to review
      { role: "system", content: `[CONTEXT: User Request]\n${prompt}` },
      { role: "system", content: `[CONTEXT: Plan Created]\n${planText}` },
      {
        role: "system",
        content: `[CONTEXT: Solution Steps Executed]\n${solveText}`,
      },
      { role: "system", content: reflectSystemPrompt },
    ];
    const reflectData = await _callLlama4Scout(
      reflectMessages,
      false,
      controller.signal,
      "Reflect Phase"
    );
    if (!reflectData || !reflectData.choices || !reflectData.choices[0].message)
      throw new Error("Invalid REFLECT response");
    reflectionText = reflectData.choices[0].message.content.trim();

    const reflectOutput = `${reflectionText}\n\n`; // Reflect text + spacing
    fullThinkingProcess += reflectOutput;
    console.log(reflectionText); // Log reflection text
    yield reflectOutput; // Yield the reflection text

    // --- PHASE 4: SUMMARIZE ---
    const summarySeparator = `### SUMMARIZE ###\n`;
    fullThinkingProcess += summarySeparator;
    console.log(summarySeparator);
    yield summarySeparator; // Yield separator

    // Enhanced prompt for SUMMARIZE phase
    const summarySystemPrompt = `[ROLE] You are ONLY the FINAL ANSWER provider.

[CONTEXT] Based on the previous reasoning (Plan, Solve, Reflect), determine the final answer to the original user request.
User Request: ${prompt}
Plan: ${planText}
Solution Steps: ${solveText}
Review: ${reflectionText}

[TASK] Provide *only* the final answer to the user's original request. Present it clearly, directly, and concisely in plain text.

[OUTPUT FORMAT] Output *only* the final answer itself.

[IMPORTANT] Stick strictly to your role as FINAL ANSWER provider. Do *not* include your planning, solving, or reflection steps. Your output must be only the answer.`;

    // Provide necessary context for final answer synthesis
    const summaryMessages = [
      { role: "system", content: `[CONTEXT: User Request]\n${prompt}` },
      { role: "system", content: `[CONTEXT: Plan]\n${planText}` },
      { role: "system", content: `[CONTEXT: Solution Steps]\n${solveText}` },
      { role: "system", content: `[CONTEXT: Review]\n${reflectionText}` },
      { role: "system", content: summarySystemPrompt },
    ];

    // Use streaming for the final summary answer
    const summaryResponse = await _callLlama4Scout(
      summaryMessages,
      true,
      controller.signal,
      "Summarize Phase"
    );

    // Stream processing logic (parses JSON chunks for text - same as before)
    const reader = summaryResponse.body.getReader();
    const decoder = new TextDecoder();
    let summaryAccumulator = "";
    let leftover = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (leftover.trim()) {
          try {
            const jsonChunk = JSON.parse(leftover.trim());
            const content = jsonChunk?.choices?.[0]?.delta?.content;
            if (content) {
              summaryAccumulator += content;
              fullThinkingProcess += content;
              console.log(content);
              yield content;
            }
          } catch (e) {
            console.warn(
              "[Summarize Phase] Error parsing leftover stream data:",
              leftover,
              e
            );
          }
        }
        break;
      }
      const textChunk = leftover + decoder.decode(value, { stream: true });
      let potentialJsons = textChunk.split(/(?<=\})\s*(?=\{)/);
      leftover = "";
      for (let i = 0; i < potentialJsons.length; i++) {
        let potentialJsonString = potentialJsons[i].trim();
        if (!potentialJsonString) continue;
        try {
          const jsonChunk = JSON.parse(potentialJsonString);
          const content = jsonChunk?.choices?.[0]?.delta?.content;
          if (content) {
            summaryAccumulator += content;
            fullThinkingProcess += content;
            console.log(content);
            yield content;
          }
          if (i === potentialJsons.length - 1) {
            leftover = "";
          }
        } catch (e) {
          if (i === potentialJsons.length - 1) {
            leftover = potentialJsonString;
          } else {
            console.warn(
              "[Summarize Phase] Failed to parse intermediate JSON chunk:",
              potentialJsonString,
              e
            );
          }
        }
      }
    }
    console.log(`[Summarize Phase] End of stream.`);
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error(`Error during streamChainOfThought: ${error.message}`);
      const errorMsg = `\n\n--- ERROR ---\nAn error occurred during processing: ${error.message}\n`;
      fullThinkingProcess += errorMsg;
      console.log(errorMsg);
      yield errorMsg; // Yield error after the separator it failed on
    } else {
      const abortMsg = "\n\n--- ABORTED ---\nProcessing was cancelled.\n";
      fullThinkingProcess += abortMsg;
      console.log(abortMsg);
      yield abortMsg; // Yield abort message
    }
  } finally {
    console.log("\n--- Full Raw Thinking Process Log ---");
    console.log(fullThinkingProcess);
    console.log("--- End of Raw Thinking Process ---");
  }
}

/**
 * Handles regular, non-reasoning messages.
 * (Remains the same, yielding text chunks)
 * @param {string} system_prompt - Base system prompt.
 * @param {string} global_memory - Persistent information.
 * @param {object[]} plainMessages - Simplified conversation history.
 * @param {string} prompt - The user's input prompt.
 * @param {AbortController} controller - AbortController for cancellation.
 * @returns {AsyncGenerator<string, void, unknown>} - Async generator yielding text chunks.
 */
export async function regularMsg(
  system_prompt,
  global_memory,
  plainMessages,
  prompt,
  controller
) {
  let historyString = "No history provided.";
  if (plainMessages && plainMessages.length > 0) {
    historyString = plainMessages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");
  }
  const messages = [
    { role: "system", content: system_prompt },
    {
      role: "system",
      content: `Relevant Memory/Scratchpad:\n${global_memory || "None provided."}`,
    },
    {
      role: "system",
      content: `Conversation History (for context):\n${historyString}`,
    },
    { role: "user", content: prompt },
  ];

  try {
    const response = await _callLlama4Scout(
      messages,
      true,
      controller.signal,
      "Regular Message"
    );
    async function* processStream() {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let leftover = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (leftover.trim()) {
            try {
              const jsonChunk = JSON.parse(leftover.trim());
              const content = jsonChunk?.choices?.[0]?.delta?.content;
              if (content) yield content;
            } catch (e) {
              console.warn(
                "[Regular Message] Error parsing leftover stream data:",
                leftover,
                e
              );
            }
          }
          break;
        }
        const textChunk = leftover + decoder.decode(value, { stream: true });
        let potentialJsons = textChunk.split(/(?<=\})\s*(?=\{)/);
        leftover = "";
        for (let i = 0; i < potentialJsons.length; i++) {
          let potentialJsonString = potentialJsons[i].trim();
          if (!potentialJsonString) continue;
          try {
            const jsonChunk = JSON.parse(potentialJsonString);
            const content = jsonChunk?.choices?.[0]?.delta?.content;
            if (content) yield content;
            if (i === potentialJsons.length - 1) {
              leftover = "";
            }
          } catch (e) {
            if (i === potentialJsons.length - 1) {
              leftover = potentialJsonString;
            } else {
              console.warn(
                "[Regular Message] Failed to parse intermediate JSON chunk:",
                potentialJsonString,
                e
              );
            }
          }
        }
      }
      console.log(`[Regular Message] End of stream.`);
    }
    return processStream();
  } catch (error) {
    console.error(`Error in regularMsg: ${error.message}`);
    throw error;
  }
}
