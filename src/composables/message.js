// Determine if we should use chain-of-thought based on the prompt and conversation history.
export async function shouldUseReasoning(prompt, plainMessages) {
  const response = await fetch("https://ai.hackclub.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: `Analyze the query STRICTLY through these lenses. You MUST respond EXACTLY "true" or "false" with NO punctuation.

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

          - If asking about processes/methods without explicit instruction → true
          - If requesting comparisons/advantages/disadvantages → true
          - If containing multiple questions → true
          - If using ambiguous terms like "it", "they" needing context → true

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
    gather: `You are in the GATHERING phase. Perform comprehensive information extraction using this protocol:

1. SOURCE CATEGORIZATION
[User Input] Direct quotes/numbers from prompt
[Memory] Relevant context from history/knowledge
[Implicit] Unstated but necessary assumptions
[Conflict] Contradictions requiring resolution

2. CONTEXT TAGGING
For each item, add:
- (ESSENTIAL): Must be used in solution
- (AMBIGUOUS): Requires clarification
- (CONSTRAINT): Limits solution space

3. PROBLEM DECLARATION
Identify the EXACT SOLUTION ARTIFACT needed:
[Calculation] → Required output type
[Proof] → Logical validation needed
[Explanation] → Causal relationships required

4. FORMAT RULES
- Use hyphen bullets ONLY
- No markdown or special symbols
- Max 8 bullet points
- Include negative space indicators ("Missing: X")

Example Output:
- User Input: "Calculate velocity after 5s fall" (ESSENTIAL)
- Memory: Gravity = 9.8m/s² (ESSENTIAL)
- Implicit: Air resistance negligible (AMBIGUOUS)
- Missing: Initial velocity assumption (CONFLICT)
- Core Problem: Derive v(t) for free-fall (ESSENTIAL)`,

    analyze: `You are in the ANALYSIS phase. Conduct this structured breakdown:

1. PROBLEM DECONSTRUCTION
A) Core Components: 
- List MUST-SOLVE elements (from gathered info)
- Identify IMPLICIT requirements
B) Input/Output Mapping:
Inputs: [All given data/conditions]
→ Expected Outputs: [Required solution aspects]

2. APPROACH GENERATION
For MATH/LOGIC problems:
- Method 1: [Primary technique] 
  Pros: [...] 
  Cons: [...]
- Method 2: [Alternative] 
  Pros: [...] 
  Cons: [...]
  
For OPEN-ENDED problems:
- Framework 1: [Structured approach]
- Framework 2: [Creative angle]

3. CONSTRAINT ENGINEERING
A) Hard Constraints (Inviolable):
1. [Exact quote from problem] → [Interpretation]
2. [Implicit physical law/domain rule]

B) Soft Constraints (Optimization goals):
1. [Efficiency consideration]
2. [Aesthetic/UX factor]

4. CONFLICT RESOLUTION
A) List contradictory requirements
B) Prioritize using:
- Explicit over implicit
- Hard constraints over soft
- Earlier context over later

4. RISK ASSESSMENT 
Potential Failure Points:
- [Likely error] → Mitigation: [...]
- [Ambiguity] → Clarification Needed: [...]

5. VALIDATION CHECKPOINTS
- Pre-Solve: Confirm [critical assumption] via [method]
- Mid-Solve: Verify [intermediate result] using [technique]

FORMAT REQUIREMENTS:
- Use clear section headers (ALL CAPS)
- For math: List variables as Var={description}
- For logic: Map as IF [condition] → [implication]
- No markdown - use indentation for subpoints

Example Analysis:
PROBLEM DECONSTRUCTION
A) Core Components:
- MUST-SOLVE: Calculate velocity AND verify safety
- IMPLICIT: Use metric units

APPROACH GENERATION
Method 1: Kinematic equations
Pros: Direct solution | Cons: Assumes constant acceleration
Method 2: Energy conservation 
Pros: Accounts for friction | Cons: Requires mass data

CONSTRAINT ENGINEERING
Hard Constraints:
1. "Max speed ≤ 25m/s" → Absolute limit
2. Conservation of energy → Physical law

RISK ASSESSMENT 
- Risk: Missing air resistance → Mitigation: Add 10% buffer`,

    solve: `You are in the SOLUTION phase. Strictly follow these rules:

            1. Structural Requirements
            - Format: "STEP [N]: [Title in Caps]"
            - Begin each step with "As analyzed: " + relevant analysis point
            - For math: Show as (1) Formula (2) Substitution (3) Result
            - For logic puzzles: Map all permutations using decision trees

            2. Logical Puzzle Protocol (When applicable)
            A. List all possible initial assumptions
            B. For each assumption:
              - Explore implications through logical operators (AND/OR/NOT)
              - Identify contradictions/confirmations
              - Prune impossible branches with reasoning
            C. Cross-validate surviving paths

            3. Validation Checkpoints
            - After equations: [Check] Units consistency & magnitude sanity
            - After logical steps: [Verify] No hidden assumptions introduced
            - Final answer: [Confirm] Matches ALL problem constraints

            4. Error Prevention
            - When re-attempting: DIRECTLY ADDRESS previous failure points:
            ${attempts > 0 ? "\n[Previous Errors] MUST FIX: " + lastReviewFeedback + "\n" : ""}

            5. Required Format (No Markdown)
            - Mathematical notation: EQ#) Expression (e.g., EQ1) F = ma)
            - Logical operators: AND/OR/NOT in caps
            - Emphasis: Use *asterisks* for key terms

            Example Structure:
            STEP 1: INITIAL ASSUMPTIONS
            As analyzed: <relevant analysis point>...
            *Possible outcomes*:
            1) Scenario A: <description>
            2) Scenario B: <description>

            STEP 2: CORE CALCULATION
            EQ1) v = d/t
            EQ2) v = 100m / 10s
            EQ3) v = 10 m/s
            [Check] Units: meters/sec ✓, Magnitude: Plausible for human movement ✓

            STEP 3: LOGICAL ELIMINATION
            Scenario A implies X, which CONTRADICTS constraint Y because...
            Scenario B aligns with Z, therefore SURVIVES validation.`,

    review: `You are in the REVIEW phase. Apply this strict protocol:

1. VALIDATION SEQUENCE (MUST FOLLOW ORDER):
A) Cross-check with ORIGINAL PROBLEM: Quote exact requirement vs solution
B) ASSUMPTION AUDIT: List ALL assumptions made, flagging any without explicit basis
C) CALCULATION VERIFICATION: Recompute 2 key calculations using alternative methods
D) LOGICAL FLOW TEST: Create step dependency diagram mentally - identify missing links
E) TERMINOLOGY MATCH: Compare solution's terms to problem's vocabulary list

2. DECISION MATRIX (ALL must be TRUE):
✅ [1] 100% requirement coverage (no more/less)
✅ [2] 0 unsupported assumptions
✅ [3] ≤5% numerical variance in recalculations
✅ [4] No >1 logical hop between steps
✅ [5] ≥90% term alignment with problem statement

3. RESPONSE TEMPLATE:
ACCEPTABLE/UNACCEPTABLE: [Initial verdict]

[IF UNACCEPTABLE]
Failed Criteria (Cite Evidence):
1. [Rubric #]: [Exact quote from solution] violates because...
2. [Rubric #]: Missing connection between [Step X] and [Step Y]
...

Required Fixes:
- [Actionable instruction] in [Specific Location]
- [Alternative approach] for [Identified Issue]

[IF ACCEPTABLE]
Confirmation Checks:
- Recalculation Method: [Describe alternative approach used]
- Logical Bridge Test: [State how each transition was validated]
- Terminology Variance: [List any allowed synonyms]

4. STRICT FORMAT RULES:
- Use "QUOTE: ..." for exact problematic phrases
- Reference steps as [Step N]/[Equation N]
- For numbers: "Expected:<X> vs Actual:<Y> (Δ=Z%)"
- No markdown - use CAPS for emphasis

Example UNACCEPTABLE response:
UNACCEPTABLE: Fails 3 criteria
1. [3] QUOTE: "Force = 5kg * 10m/s" → Expected: 5*9.81=49.05N vs 50N (Δ=1.9%)
2. [4] Missing link between Step 2 (kinematics) and Step 3 (energy)
...
Required Fixes:
- Recompute acceleration using F=ma in Step 2
- Add conservation of energy explanation between Steps 2-3`,

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
            content: `STRUCTURED REASONING SYSTEM // ${currentStep.toUpperCase()} PHASE
            ${attempts > 0 ? `ATTEMPT ${attempts + 1}` : ""}
            
            FULL CONTEXT:
            User's Original Request: "${system_prompt}"
            Conversation History: ${JSON.stringify(plainMessages)}
            Global Memory: ${global_memory}
            Aggregated Knowledge: 
            ${aggregatedContent}
            
            PHASE TASK:
            ${prompts[currentStep]}
            
            STRICT REQUIREMENTS:
            1. Use ALL available context above
            2. Never re-interpret original request`,
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
