// Determine if we should use chain-of-thought based on the prompt and conversation history.
export async function shouldUseReasoning(prompt, plainMessages) {
  const response = await fetch("https://ai.hackclub.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: `Decide if the following prompt needs step-by-step reasoning. Respond ONLY with "true" or "false".

          Overrides:
          - If the prompt includes "use reasoning", "explain step-by-step", or similar, return "true".
          - If the prompt includes "no reasoning", return "false".

          Otherwise:
          - Return "true" if the prompt involves multi-step problem solving, mathematical calculations, coding tasks, logical analysis, or interdependent steps.
          - Return "false" for simple factual or general queries.

          Examples:
          - "Calculate the derivative of x^2 + 3x." → true
          - "What is the capital of Italy?" → false
          - "What is the meaning of life?" → false (unless preceded or followed by a direct request for reasoning)
          - "What is the meaning of life? Please use reasoning." → true
          - "Explain the steps to solve a Rubik's Cube." → true
          - "What is the airspeed velocity of an unladen swallow?" → false
          - "Hey! I heard you can use reasoning now?" → false
          - "Write a program that prints 'Hello, world!'" → true

          Current conversation context: ${JSON.stringify(plainMessages)}`,
        },
        { role: "user", content: prompt },
      ],
      stream: false,
    }),
  });
  const data = await response.json();
  return JSON.stringify(data.choices[0].message.content);
}

// A helper that reads the streamed response and yields full parsed chunks
async function* readStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine === "data: [DONE]") continue;
      try {
        const json = JSON.parse(trimmedLine.replace("data: ", ""));
        const content = json.choices[0].delta.content;
        if (content) yield content;
      } catch (err) {
        console.error("Error parsing stream chunk:", err);
      }
    }
  }
}

// An async generator that chains multiple API calls if needed.
export async function* streamChainOfThought(
  system_prompt,
  global_memory,
  plainMessages,
  prompt,
  controller
) {
  console.log("Using chain-of-thought reasoning");

  let currentStep = "gather";
  let aggregatedContent = "";
  let stepContent = "";
  let attempts = 0;
  let lastReviewFeedback = "";
  const MAX_ATTEMPTS = 3; // Prevents infinite loops

  const prompts = {
    gather: `You are in the GATHERING phase of a multi-step reasoning process.
    ONLY list relevant information as bullet points. Do not solve the problem yet.
    Include:
    - Key details from the user's request
    - Relevant context from memory
    - Core problem to be solved
    Format as "- point" bullets only. No introduction or conclusion.`,

    analyze: `You are in the ANALYSIS phase.
    Review the gathered information above and:
    1. Break this problem into clear logical steps
    2. List possible approaches
    3. Identify key constraints
    Do not solve yet - only analyze the approach.`,

    solve: `You are in the SOLUTION phase.
    Using ONLY the analysis above:
    1. Follow each step identified
    2. Show your work clearly
    3. Explain each step's reasoning
    4. Validate your solution
    ${attempts > 0 ? "\nPrevious attempt was UNACCEPTABLE because:\n" + lastReviewFeedback : ""}
    Solve the problem step by step.`,

    review: `You are in the REVIEW phase.
    Carefully review the solution above and determine if it is acceptable.
    Your review must be thorough and critical.
    
    Consider:
    1. Does it follow the analysis plan?
    2. Are the calculations/steps correct?
    3. Is the reasoning sound?
    4. Does it solve the original problem?
    
    Respond with either:
    "ACCEPTABLE: [Brief explanation why]"
    or
    "UNACCEPTABLE: [List specific issues that need fixing]"

    The beginning of your response MUST be exactly "ACCEPTABLE: " or "UNACCEPTABLE: ".
    Your feedback will be used to improve the solution if needed, HOWEVER, you MUST keep ALL of your feedback AFTER you have decided it is ACCEPTABLE or UNACCEPTABLE.
    
    Be thorough but concise.`,

    summarize: `You are in the SUMMARY phase.
    Based on all previous reasoning, create a summary that does the following:
    - Clearly restates the original problem.
    - Presents the solution in a concise manner. If the solution includes code or long explanations, include only the critical parts needed for understanding.
    - Optionally, highlight key insights if they are necessary to understand the solution.
    Keep the output as open as possible: use paragraphs, bullet points, or code blocks as needed.
    Remember, the user will not see the intermediate steps, so make sure the summary is self-contained.`,
  };

  yield "\n\n🤔 Let me think this through step by step...\n\n";

  while (currentStep && attempts < MAX_ATTEMPTS) {
    const response = await fetch("https://ai.hackclub.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: `You are an AI performing structured reasoning.
            Your CURRENT PHASE is: ${currentStep.toUpperCase()} ${
              attempts > 0 && currentStep === "solve"
                ? `\nThis is attempt ${attempts + 1} after previous solution was deemed unacceptable.\n`
                : ""
            }
            
            Your task for this phase:
            ${prompts[currentStep]}
            
            Previous steps completed:
            ${aggregatedContent}
            
            Base context:
            - System: ${system_prompt}
            - Memory: ${global_memory}
            - History: ${JSON.stringify(plainMessages)}
            
            Respond ONLY with content appropriate for the current phase.
            ${currentStep === "review" ? "\nBe especially thorough in your review." : ""}`,
          },
          { role: "user", content: prompt },
        ],
        stream: true,
      }),
      signal: controller.value.signal,
    });

    yield `\n### ${currentStep.toUpperCase()} ###\n`;

    stepContent = "";
    for await (const chunk of readStream(response)) {
      stepContent += chunk;
      yield chunk;
    }

    // Store phase results with clear separation
    aggregatedContent += `\n\n=== ${currentStep.toUpperCase()} ===\n${stepContent}\n`;

    yield "\n---\n";

    // Progress through phases with review cycle
    switch (currentStep) {
      case "gather":
        currentStep = "analyze";
        break;
      case "analyze":
        currentStep = "solve";
        break;
      case "solve":
        currentStep = "review";
        break;
      case "review":
        // Check if solution is acceptable
        if (stepContent.trim().startsWith("ACCEPTABLE:")) {
          currentStep = "summarize";
        } else {
          // Solution needs improvement
          if (attempts < MAX_ATTEMPTS - 1) {
            lastReviewFeedback = stepContent.trim();
            yield "\n### RETRY SOLUTION ###\n";
            currentStep = "solve";
            attempts++;
          } else {
            // Max attempts reached, move to summary anyway
            yield "\n### MAX ATTEMPTS REACHED ###\n";
            currentStep = "summarize";
          }
        }
        break;
      case "summarize":
        currentStep = null;
        break;
    }
  }
}

// Regular message stream (using a single API call)
export async function regularMsg(
  system_prompt,
  global_memory,
  plainMessages,
  prompt,
  controller
) {
  const response = await fetch("https://ai.hackclub.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: `${system_prompt} Memory: ${global_memory}. Conversation: ${JSON.stringify(plainMessages)}`,
        },
        { role: "user", content: prompt },
      ],
      stream: true,
    }),
    signal: controller.value.signal,
  });
  return response;
}
