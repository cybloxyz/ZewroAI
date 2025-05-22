/**
 * @fileoverview Interacts with Llama 3.3 70b AI model (or similar).
 * V25 - Adaptive Agentic "Inner Monologue" with refined adaptive depth.
 * Focuses on AI self-determining step count, reliable completion signal,
 * natural prose, and integrated critique/correction. Summary uses Markdown.
 */

// API endpoint for the AI model
const API_ENDPOINT = "https://ai.hackclub.com/chat/completions"; // Adjust if needed
const MAX_AGENT_STEPS = 15; // Max reasoning steps; simple tasks should finish in 1.

/**
 * Logs message history to the console for debugging.
 * Helps trace the conversation flow with the AI.
 */
function _logMessagesRaw(messages, prefix) {
  console.log(`${prefix} Messages:`);
  messages.forEach((msg, index) => {
    const role = msg.role || "unknown_role"; // Default if role is missing
    const content = msg.content || "[No Content]";
    // Indent content for better readability in logs
    const formattedContent =
      typeof content === "string"
        ? content.replace(/\n/g, `\n${prefix}   `)
        : JSON.stringify(content, null, 2).replace(/\n/g, `\n${prefix}   `);

    console.log(`${prefix} [${index}] Role: ${role}`);
    console.log(`${prefix}   Content:\n${prefix}   ${formattedContent}`);
    console.log(`${prefix} ---`); // Separator for clarity
  });
}

/**
 * Sends requests to the AI API and handles responses.
 * This function is the workhorse for all AI interactions.
 */
async function _callLlamaAI(messages, stream, signal, requestDescription) {
  const isCritique = requestDescription.includes("Critique Step");
  // Be less noisy in logs for the frequent, internal critique calls
  if (!isCritique) {
    console.log(`=== NEW REQUEST === (${requestDescription})`);
    _logMessagesRaw(messages, `[${requestDescription} Request]`);
  } else {
    // Minimal log for internal check
    console.log(`--- Internal Critique Request (for prior AI step) ---`);
  }

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // model: "llama-3.1-70b-versatile", // Example: Ensure this matches your endpoint's expected model
        messages: messages,
        stream: stream,
      }),
      signal: signal, // For aborting requests
    });

    // Handle non-OK HTTP responses (e.g., 4xx, 5xx errors)
    if (!response.ok) {
      let errorBody = "[Could not extract error body from API response]";
      try {
        errorBody = await response.text();
      } catch (e) {
        /* Keep default if body read fails */
      }
      const errorText = `API call failed for ${requestDescription} with status ${response.status}. Response: ${errorBody}`;
      console.error(errorText);
      throw new Error(errorText); // Propagate a detailed error
    }

    // Log success, again less verbosely for critique
    if (!isCritique) {
      console.log(
        `[${requestDescription}] API call successful (stream=${stream}).`
      );
    } else {
      console.log(`--- Internal Critique Response Received ---`);
    }

    // If streaming, the response body might be missing even on success (rarely)
    if (stream && !response.body) {
      console.warn(
        `[${requestDescription}] Stream requested but API response has no body.`
      );
      // The caller will need to handle this (e.g., by trying a non-streaming parse or erroring)
      return response;
    }

    // The critique step is always expected to be non-streaming JSON
    if (isCritique) {
      return await response.json();
    }

    // Return the Response object for streaming, or parsed JSON for non-streaming
    return stream ? response : await response.json();
  } catch (error) {
    // Catch and log network/fetch errors or aborts
    if (error.name === "AbortError") {
      console.log(`[${requestDescription}] API call aborted by user.`);
    } else {
      // Log the full error for better diagnostics
      console.error(`[${requestDescription}] Fetch/Network Error:`, error);
    }
    // Re-throw to let the calling function handle it
    throw error;
  }
}

/**
 * Decides if the complex reasoning process ("inner monologue") should be used.
 * This helps in quickly responding to simple queries without overthinking.
 */
export async function shouldUseReasoning(prompt, plainMessages) {
  let historyString = "No history provided.";
  if (plainMessages && plainMessages.length > 0) {
    historyString = plainMessages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");
  }
  // Clear instructions for the analyzer model
  const systemMsg = `Analyze the user's latest query and conversation history. Is complex reasoning (logic, planning, multi-step deduction) required, or is it a simple request (like a greeting, quick question, or acknowledgement)?
Provide a 1-sentence rationale, then state "Decision: true" (for complex) or "Decision: false" (for simple) on a new line.

**History:**
${historyString}

**Guidelines:**
- Logic puzzles, coding tasks, planning requests, detailed analysis -> true
- Simple greetings ("hi", "hello"), direct factual questions ("what is X?"), expressions of thanks -> false
- Multi-part questions requiring sequential answers -> true
- Single, straightforward questions -> false

**Latest User Query:**
${prompt}`;

  const messages = [{ role: "system", content: systemMsg }];
  try {
    const data = await _callLlamaAI(messages, false, null, "Reasoning Check");
    // Ensure the response structure is as expected
    if (!data?.choices?.[0]?.message?.content) {
      console.error(
        "[Reasoning Check] Invalid response structure from AI:",
        data
      );
      throw new Error(
        "Received invalid response structure from reasoning check API call."
      );
    }
    const rawContent = data.choices[0].message.content.trim();
    console.log("[Reasoning Check] Raw LLM Response:\n" + rawContent);
    // Use regex for reliable extraction of the decision
    const decisionMatch = rawContent.match(/Decision:\s*(true|false)$/im); // Case-insensitive, multiline
    if (decisionMatch?.[1]) {
      const decision = decisionMatch[1].toLowerCase() === "true";
      console.log("[Reasoning Check] Decision: " + decision);
      return decision;
    } else {
      // Fallback if the specific "Decision: ..." format isn't found
      console.warn(
        "[Reasoning Check] Could not find 'Decision: true/false' marker. Attempting keyword fallback."
      );
      if (
        rawContent.toLowerCase().includes("true") &&
        !rawContent.toLowerCase().includes("false")
      ) {
        console.log("[Reasoning Check] Fallback decision: true");
        return true;
      }
      if (rawContent.toLowerCase().includes("false")) {
        console.log("[Reasoning Check] Fallback decision: false");
        return false;
      }
      console.warn("[Reasoning Check] Fallback failed. Defaulting to 'false'.");
      return false; // Default to simple if unsure
    }
  } catch (error) {
    console.error(`Error in shouldUseReasoning: ${error.message}`);
    return false; // Default to simple mode on error for safety
  }
}

/**
 * Parses the structured output from the hidden critique step.
 * Extracts whether the step was flawed and the reason.
 */
function _parseCritique(critiqueOutput) {
  const lowerOutput = critiqueOutput.toLowerCase();
  // Look for "Critique Result: flawed" or "Critique Result: acceptable"
  const resultMatch = lowerOutput.match(
    /critique result:\s*(acceptable|flawed)/
  );
  // Look for the reason text after "Reason:"
  const reasonMatch = critiqueOutput.match(/reason:\s*([\s\S]*)/i); // Capture multi-line reasons

  // Default to flawed if "acceptable" is not explicitly found
  const isAcceptable = resultMatch ? resultMatch[1] === "acceptable" : false;
  const isFlawed = !isAcceptable;

  const reason = reasonMatch
    ? reasonMatch[1].trim()
    : isFlawed
      ? "Critique identified potential flaws or issues with step scope."
      : "Step appears sound and appropriately scoped.";

  return { isFlawed, reason };
}

/**
 * Simulates reasoning using an adaptive "Inner Monologue" loop.
 * Includes a hidden Critique & Correct cycle after each step.
 * The AI determines the number of steps and uses natural prose.
 *
 * @param {string} system_prompt - Base persona prompt.
 * @param {string} global_memory - Persistent info/scratchpad.
 * @param {object[]} plainMessages - Simplified conversation history.
 * @param {string} prompt - The user's request.
 * @param {AbortController} controller - Allows cancellation.
 * @yields {string} - Chunks of the agent's monologue (including corrections) or the final summary.
 */
export async function* streamChainOfThought(
  system_prompt, // Base persona
  global_memory,
  plainMessages,
  prompt, // The user's actual request
  controller
) {
  const initialMsg = "🤔 Let me think this through step by step...\n\n";
  console.log(initialMsg.trim());
  yield initialMsg;
  let fullThinkingProcess = initialMsg;

  // --- Agent Setup ---
  let historyString = "No history provided.";
  if (plainMessages && plainMessages.length > 0) {
    historyString = plainMessages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");
  }

  // ** Agent System Prompt (Adaptive Inner Monologue - v25) **
  // Guides AI to determine step count, use natural prose, and signal completion reliably.
  const agentSystemPrompt = `${system_prompt}

**Your Role:** You are simulating a meticulous **internal thought process** ("inner monologue") to arrive at the most accurate and complete answer to the user's request. Your goal is to reason effectively and efficiently, adapting your approach to the task's complexity.

**Process:**
1.  **Analyze Request:** Deeply understand the user's request, context, history, and ALL constraints/clues.
2.  **Adaptive Reasoning Depth (CRITICAL):**
    * For **simple requests** (e.g., greetings like "hi", quick factual questions, acknowledgements): Your internal monologue should be **ONE brief step**. Formulate your thought, and then **IMMEDIATELY** end that single response with "REASONING COMPLETE.".
    * For **complex requests** (e.g., logic puzzles, coding, detailed analysis): Your monologue will involve multiple steps. Take **ONE logical step or deduction at a time.** Do not try to solve everything at once.
3.  **Think Aloud (Natural Prose):** Explain your reasoning for each step using clear, natural language prose. Use conversational fillers ("Okay, let's see...", "Hmm, if that's true then...", "Wait a minute...") naturally to make your thought process clear. **Each response from you is one continuous block of thought; do not use external "Step X:" numbering.** You can structure *internal* sub-points within your prose if needed for clarity on a complex step.
4.  **Grounding:** Base ALL reasoning STRICTLY on the provided information ONLY. Explicitly mention clue numbers or facts supporting deductions.
5.  **Self-Correction (Guidance):** If you realize a mistake during your monologue, acknowledge it naturally ("Hold on, looking back...") and correct your path. (An internal critique will also occur after your step, prompting further correction if needed).
6.  **Completion Signal (ESSENTIAL):** When your internal monologue has fully addressed the request (whether in one step for simple tasks or multiple for complex ones) and you have performed a final mental check, end your *very last* thought process response with the exact phrase "REASONING COMPLETE." on a new line. **This is the ONLY way to signal your thinking is done.**

Begin your internal thought process. Assess the request and take your first step. If it's simple, this first step might be your only step.

---
REMEMBER: **Adapt your number of steps.** For simple inputs, ONE step ending with "REASONING COMPLETE." is often enough. For complex ones, take ONE small logical step per turn. **The "REASONING COMPLETE." signal is VITAL and marks the end of your *entire* thought process for this request.**`;

  // ** System Prompt for the HIDDEN Critique Step **
  // Focuses on logical soundness and if the step was appropriately conclusive for simple tasks.
  const critiqueSystemPrompt = `You are a strict logical reviewer. Your ONLY task is to analyze the provided SINGLE reasoning step.

**Reasoning Step to Review:**
[REASONING_STEP_TEXT]

**Instructions:**
1.  **Logic Check:** Is the deduction/reasoning within this step logically sound based on hypothetical prior context?
2.  **Granularity/Sufficiency Assessment:**
    * If the original user request was likely **simple** (e.g., a greeting): Did this step adequately address it AND did it (or should it have) ended with "REASONING COMPLETE."? If it's a good single response for a simple query but lacks the marker, it's flawed.
    * If the original request was likely **complex**: Did this step focus on ONLY ONE small, logical deduction or clue application? Or did it try to do too much? Is it a reasonable increment of progress?
3.  Output your verdict in the following format ONLY:
    Critique Result: [Acceptable/Flawed]
    Reason: [Provide a brief explanation ONLY if Flawed (e.g., "For a simple greeting, this is a complete thought and should have ended with REASONING COMPLETE.", "Step attempted too many deductions at once.", "Logical leap."). If Acceptable, state "Step appears sound and appropriately scoped for this stage of reasoning."]`;

  // ** System Prompt for the VISIBLE Correction Step **
  // Guides the AI to respond naturally based on the critique.
  const correctionSystemPrompt = `You are continuing your internal thought process. Upon further reflection (prompted by an internal check), it seems your immediately preceding reasoning step needs refinement or correction.

**Your Previous Step (which was just critiqued):**
[FLAWED_STEP_TEXT]

**Identified Issue from Internal Check:**
[CRITIQUE_REASON]

**Your Task:**
1.  Acknowledge the need for correction naturally, as part of your ongoing monologue (e.g., "Wait a minute, that's a good point, let me refine that...", "Hold on, I see the issue with my last thought. Correcting that now...", "Okay, on second thought..."). Use conversational fillers.
2.  Provide the **corrected version of ONLY that single reasoning step**, addressing the identified issue. Ensure the corrected step is appropriately granular and logical.
3.  If this corrected step now completes the entire reasoning process (e.g., it fully answers a simple request, or it's the final step for a complex one) and is verified, end this response with "REASONING COMPLETE." on a new line. Otherwise, simply provide the corrected step.

Provide your corrected reasoning naturally as part of your monologue.`;

  // Initial message history for the main agent loop
  let agentMessages = [
    { role: "system", content: agentSystemPrompt },
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

  let stepCount = 0;
  let reasoningComplete = false;
  let finalReasoningOutput = "[Reasoning did not complete or produce output]";

  try {
    // --- Agent Loop ---
    while (stepCount < MAX_AGENT_STEPS && !reasoningComplete) {
      stepCount++;
      const stepDescription = `Agent Reasoning Step ${stepCount}`;
      let currentTurnOutput = ""; // Text yielded this turn
      let currentHistoryContent = ""; // Text added to history for the next AI call

      // --- 1. Generate Reasoning Step ---
      const solveResponseData = await _callLlamaAI(
        agentMessages,
        false,
        controller.signal,
        stepDescription
      );
      if (!solveResponseData?.choices?.[0]?.message?.content) {
        console.error(
          `Invalid AI Solve Step response at step ${stepCount}:`,
          solveResponseData
        );
        const errorMsg = `\n\n[System Error: AI response missing content at step ${stepCount}.]\n\n`;
        fullThinkingProcess += errorMsg;
        console.log(errorMsg.trim());
        yield errorMsg;
        reasoningComplete = true;
        finalReasoningOutput = "[Error in reasoning step]";
        continue;
      }
      const initialSolveStepText =
        solveResponseData.choices[0].message.content.trim();
      currentTurnOutput = initialSolveStepText; // This will be yielded
      currentHistoryContent = initialSolveStepText; // This will be added to history if not corrected

      const logSolveText = `[Agent Step ${stepCount} - Attempt]\n${initialSolveStepText}\n\n`;
      fullThinkingProcess += logSolveText;
      console.log(logSolveText.trim());
      // Yield the initial attempt, it might be corrected or stand as is.
      // The user sees this raw thought.
      yield initialSolveStepText + "\n\n";

      // --- 2. Perform Hidden Critique Step ---
      const critiqueMessages = [
        {
          role: "system",
          content: critiqueSystemPrompt.replace(
            "[REASONING_STEP_TEXT]",
            initialSolveStepText
          ),
        },
      ];
      let critiqueResult = {
        isFlawed: false,
        reason: "Critique step failed or produced invalid output.",
      };
      try {
        const critiqueResponseData = await _callLlamaAI(
          critiqueMessages,
          false,
          controller.signal,
          `Critique Step ${stepCount}`
        );
        if (critiqueResponseData?.choices?.[0]?.message?.content) {
          critiqueResult = _parseCritique(
            critiqueResponseData.choices[0].message.content.trim()
          );
          console.log(
            `--- Critique (Step ${stepCount}): ${critiqueResult.isFlawed ? "Flawed" : "Acceptable"}. Reason: ${critiqueResult.reason} ---`
          );
          fullThinkingProcess += `--- [Internal Critique ${stepCount}] Result: ${critiqueResult.isFlawed ? "Flawed" : "Acceptable"}. Reason: ${critiqueResult.reason} ---\n\n`;
        } else {
          console.warn(
            `[Critique Step ${stepCount}] Invalid response structure. Assuming step was acceptable.`
          );
          fullThinkingProcess += `--- [Internal Critique ${stepCount}] Error: Invalid response. Assumed acceptable. ---\n\n`;
          critiqueResult.isFlawed = false;
        }
      } catch (critiqueError) {
        if (critiqueError.name === "AbortError") throw critiqueError;
        console.error(
          `Error during Critique Step ${stepCount}:`,
          critiqueError
        );
        fullThinkingProcess += `--- [Internal Critique ${stepCount}] Error: ${critiqueError.message}. Assumed acceptable. ---\n\n`;
        critiqueResult.isFlawed = false;
      }

      // --- 3. Perform Visible Correction Step (If Needed) ---
      if (critiqueResult.isFlawed) {
        console.log(
          `--- Flaw detected in Step ${stepCount} (Critique: ${critiqueResult.reason}), attempting correction ---`
        );
        fullThinkingProcess += `--- [System Requesting Correction for Step ${stepCount} due to: ${critiqueResult.reason}] ---\n`;

        // History for correction: main history + the flawed assistant step + correction prompt
        const correctionMessages = [
          ...agentMessages, // History *before* the flawed step was added to main agentMessages
          { role: "assistant", content: initialSolveStepText }, // The flawed step for context
          {
            role: "system",
            content: correctionSystemPrompt
              .replace("[FLAWED_STEP_TEXT]", initialSolveStepText)
              .replace("[CRITIQUE_REASON]", critiqueResult.reason),
          },
        ];

        const correctionResponseData = await _callLlamaAI(
          correctionMessages,
          false,
          controller.signal,
          `Correction Step ${stepCount}`
        );
        if (correctionResponseData?.choices?.[0]?.message?.content) {
          const correctedStepText =
            correctionResponseData.choices[0].message.content.trim();
          currentTurnOutput = correctedStepText; // This is what's yielded
          currentHistoryContent = correctedStepText; // This is what goes into history

          const logCorrectionText = `[Correction Step ${stepCount}]\n${correctedStepText}\n\n`;
          fullThinkingProcess += logCorrectionText;
          console.log(logCorrectionText.trim());
          // Yield the corrected step, replacing the initial one in the user's view for this "turn"
          yield correctedStepText + "\n\n";
        } else {
          // If correction fails, we stick with the original potentially flawed step for history
          const correctionErrorMsg = `\n[System Error: Failed to generate correction for step ${stepCount}. Original step output for this turn will be used in history.]\n\n`;
          console.error(correctionErrorMsg.trim());
          fullThinkingProcess += correctionErrorMsg;
          yield correctionErrorMsg;
          // currentTurnOutput and currentHistoryContent remain initialSolveStepText
        }
      }
      // else: No correction needed. currentTurnOutput and currentHistoryContent are already initialSolveStepText.

      // --- 4. Add the FINAL output of this turn (original or corrected) to main agent history ---
      agentMessages.push({ role: "assistant", content: currentHistoryContent });

      // --- 5. Check for Completion Signal in the FINAL output of this turn ---
      finalReasoningOutput = currentHistoryContent; // Update with the content that went into history
      const completionMarker = "REASONING COMPLETE.";
      const completionRegex = new RegExp(
        `\\s*${completionMarker.replace(".", "\\.")}\\s*$`
      );

      if (completionRegex.test(currentHistoryContent)) {
        reasoningComplete = true;
        // Remove marker from finalReasoningOutput for the summary stage
        finalReasoningOutput = currentHistoryContent
          .replace(completionRegex, "")
          .trim();
        console.log("AI indicated reasoning complete.");
        // The actual content (without marker) was already yielded.
      }

      // Prevent conversation history getting too long
      if (agentMessages.length > 15) {
        const systemPrompts = agentMessages.filter((m) => m.role === "system");
        const userPromptMsg = agentMessages.find((m) => m.role === "user");
        const recentAssistantTurns = agentMessages
          .filter((m) => m.role === "assistant")
          .slice(-5);
        agentMessages = [
          ...systemPrompts,
          userPromptMsg,
          ...recentAssistantTurns,
        ].filter(Boolean);
      }
    } // End of while loop

    // Handle reaching max steps
    if (stepCount >= MAX_AGENT_STEPS && !reasoningComplete) {
      const maxStepMsg =
        "[System: Reached maximum reasoning steps without signaling completion. Proceeding to summary based on the current state.]\n\n";
      console.warn(maxStepMsg.trim());
      fullThinkingProcess += maxStepMsg;
      yield maxStepMsg;
    }

    // --- Summarization Stage ---
    const summarySeparator = `### SUMMARIZE ###\n`;
    // Capture context *before* adding separator to fullThinkingProcess
    const reasoningContextForSummary = fullThinkingProcess
      .substring(0, fullThinkingProcess.lastIndexOf(summarySeparator))
      .trim();
    fullThinkingProcess += summarySeparator;
    console.log(summarySeparator.trim());
    yield summarySeparator;

    // Final Summarize Prompt (Markdown output)
    const summarySystemPrompt = `[ROLE] You are the FINAL RESPONSE writer. Your task is to synthesize the preceding internal thought process into a polished, user-facing answer.

[CONTEXT] Below is the internal monologue simulation (including any self-corrections) used to address the user's request.
User Request: ${prompt}
Completed Internal Monologue:
${reasoningContextForSummary}

[TASK] Craft the final response for the user based *only* on the outcome of the internal monologue.
- Address the user directly.
- Present the final answer or conclusion derived during the monologue in a friendly, conversational manner.
- **Format your response using Markdown.** Use paragraphs, **bolding** for key results or names, and lists (\`*\` or \`-\`) where appropriate for clarity and readability.
- If a definitive solution was reached, state it clearly.
- If the monologue ended due to errors, hitting limits, or uncertainty, explain that politely.
- **DO NOT** mention the "internal monologue", "reasoning steps", or critique process in your response to the user. Focus purely on delivering the result.

[OUTPUT FORMAT] Output *only* the final user-facing summary text, formatted using Markdown.`;

    const summaryMessages = [
      { role: "system", content: `[CONTEXT: User Request]\n${prompt}` },
      {
        role: "system",
        content: `[CONTEXT: Completed Internal Monologue]\n${reasoningContextForSummary}`,
      },
      { role: "system", content: summarySystemPrompt },
    ];

    const summaryResponse = await _callLlamaAI(
      summaryMessages,
      true,
      controller.signal,
      "Summarize Phase"
    );

    // Stream processing logic (same as v18)
    async function* processSummaryStream(response) {
      if (!response?.body) {
        console.error(
          "[Summarize Phase] Error: Invalid response object or missing body for streaming summary."
        );
        yield "\n\n[Error: Failed to stream summary response.]";
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let leftover = "";
      try {
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
                  "[Summarize Phase] Error parsing leftover JSON data:",
                  leftover,
                  e
                );
              }
            }
            break;
          }
          const textChunk = leftover + decoder.decode(value, { stream: true });
          const jsonObjects = textChunk.split(/(?<=\})\s*(?=\{)/);
          leftover = "";
          for (let i = 0; i < jsonObjects.length; i++) {
            let potentialJsonString = jsonObjects[i].trim();
            if (!potentialJsonString) continue;
            try {
              const jsonChunk = JSON.parse(potentialJsonString);
              const content = jsonChunk?.choices?.[0]?.delta?.content;
              if (content) yield content;
              if (i === jsonObjects.length - 1) leftover = "";
            } catch (e) {
              if (i === jsonObjects.length - 1) leftover = potentialJsonString;
              else
                console.warn(
                  "[Summarize Phase] Failed to parse intermediate JSON chunk:",
                  potentialJsonString,
                  e
                );
            }
          }
        }
      } finally {
        console.log(`[Summarize Phase] End of stream.`);
      }
    }
    for await (const chunk of processSummaryStream(summaryResponse)) {
      yield chunk;
    }
  } catch (error) {
    // Handle errors from the main agent loop try block
    if (error.name !== "AbortError") {
      console.error(`Error during streamChainOfThought: ${error.message}`);
      const errorMsg = `\n\n--- ERROR ---\nAn error occurred during processing: ${error.message}\n`;
      if (!fullThinkingProcess.includes(errorMsg))
        fullThinkingProcess += errorMsg;
      console.log(errorMsg.trim());
      yield errorMsg;
    } else {
      const abortMsg = "\n\n--- ABORTED ---\nProcessing was cancelled.\n";
      if (!fullThinkingProcess.includes(abortMsg))
        fullThinkingProcess += abortMsg;
      console.log(abortMsg.trim());
      yield abortMsg;
    }
  } finally {
    // Log the thinking process *before* the summary separator
    const finalReasoningLog = fullThinkingProcess
      .substring(0, fullThinkingProcess.lastIndexOf("### SUMMARIZE ###"))
      .trim();
    console.log("\n--- Full Raw Thinking Process Log ---");
    console.log(finalReasoningLog);
    console.log("--- End of Raw Thinking Process ---");
  }
}

/**
 * Handles regular, non-reasoning messages.
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
    const response = await _callLlamaAI(
      messages,
      true,
      controller.signal,
      "Regular Message"
    );
    async function* processStream() {
      if (!response?.body) {
        console.error(
          "[Regular Message] Error: Invalid response object or missing body for streaming."
        );
        try {
          const fallbackData = await response.clone().json();
          if (fallbackData?.choices?.[0]?.message?.content) {
            console.warn(
              "[Regular Message] Falling back to non-streaming response."
            );
            yield fallbackData.choices[0].message.content;
            return;
          }
        } catch (e) {
          /* Ignore */
        }
        yield "\n\n[Error: Failed to get streamable response.]";
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let leftover = "";
      try {
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
          const jsonObjects = textChunk.split(/(?<=\})\s*(?=\{)/);
          leftover = "";
          for (let i = 0; i < jsonObjects.length; i++) {
            let potentialJsonString = jsonObjects[i].trim();
            if (!potentialJsonString) continue;
            try {
              const jsonChunk = JSON.parse(potentialJsonString);
              const content = jsonChunk?.choices?.[0]?.delta?.content;
              if (content) yield content;
              if (i === jsonObjects.length - 1) leftover = "";
            } catch (e) {
              if (i === jsonObjects.length - 1) leftover = potentialJsonString;
              else
                console.warn(
                  "[Regular Message] Failed to parse intermediate JSON chunk:",
                  potentialJsonString,
                  e
                );
            }
          }
        }
      } finally {
        /* Optional: reader.releaseLock(); */
      }
    }
    return processStream();
  } catch (error) {
    console.error(`Error in regularMsg: ${error.message}`);
    async function* errorStream() {
      yield `\n\n[Error: Failed to get response - ${error.message}]`;
    }
    return errorStream();
  }
}
/*

**Key Changes in v25 (from v24 in Canvas):**

1.  **Agent System Prompt (`agentSystemPrompt`):**
    * Point #2 ("Adaptive Reasoning Depth") is now much more explicit about how to handle simple vs. complex requests regarding the number of steps and the `REASONING COMPLETE.` signal.
    * Point #3 ("Think Aloud") strongly reinforces using natural prose and avoiding external step numbering.
    * Point #6 ("Completion Signal") is highlighted as "ESSENTIAL" and the "ONLY way" to signal completion.
    * The "REMEMBER" section at the end re-emphasizes these key points.

2.  **Critique Prompt (`critiqueSystemPrompt`):**
    * Point #2 ("Granularity/Sufficiency Assessment") is now more detailed. It explicitly asks the critique to check if a simple request was handled in one step AND ended with `REASONING COMPLETE.`. If not, it's flawed. For complex requests, it still checks if the step was granular or tried to do too much.

3.  **Correction Prompt (`correctionSystemPrompt`):**
    * Point #3 now clearly states that if the *corrected* step completes the *entire* reasoning process (for simple or complex tasks), it should then end with `REASONING COMPLETE.`.

4.  **Loop Logic & History Management (`streamChainOfThought`):**
    * **Yielding Initial Step:** The `initialSolveStepText` is now yielded *before* the critique. This makes the process more transparent to the user, showing the AI's first attempt for that turn.
    * **History Update for Correction:** The logic for updating `agentMessages` after a correction was refined. The goal is that the `agentMessages` array, which is used to prompt the *next* reasoning step, should always contain the *final accepted version* of the *previous* assistant's turn (either the original if critique passed, or the corrected version if critique led to a fix).
        * The `correctionMessages` array is built using the main `agentMessages` *up to the user prompt*, then the `initialSolveStepText` (flawed step) is added as context for the AI doing the correction.
        * After the correction (or if no correction was needed), `currentHistoryContent` (which holds the final text for that turn) is then pushed to the main `agentMessages` as the assistant's response for that completed turn.
    * **`finalReasoningOutput` Update:** This variable is now consistently updated with `currentHistoryContent` at the end of each loop iteration *before* checking for the completion marker. This ensures it always holds the text of the last step that was added to the history.
    * **Yielding Corrected Step:** If a correction occurs, the `correctedStepText` is yielded, effectively replacing the initial flawed attempt in the user's view for that turn.

5.  **Placeholder Syntax:** Confirmed and ensured `[PLACEHOLDER_NAME]` is used in system prompts for clarity when referring to text that will be injected by the code.

These changes aim to make the agent more discerning about when its reasoning is truly "complete" for simple tasks, enforce stricter granularity on complex tasks, and ensure the critique/correction cycle works smoothly to improve the reliability and logical soundness of each st
*/
