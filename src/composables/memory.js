import localforage from "localforage";

export async function updateMemory(message, context) {
  let global_memory;
  try {
    global_memory = (await localforage.getItem("memory")) || "";
  } catch (err) {
    throw "Error loading global memory: " + err;
  }

  const system_prompt = `You are a memory extractor for long-term global conversation insights in a web application. You receive three inputs: the user’s current message, the full conversation history, and the existing global memory. Analyze these inputs and update the global memory with only enduring, actionable facts that will shape future interactions. Discard any trivial, speculative, or ephemeral details—such as casual greetings, timestamps, conversation initiations, or general philosophical musings that do not include explicit decisions or user directives.

Criteria for a fact to be kept:
- It must reflect an explicit instruction, commitment, or preference expressed by the user.
- It must be directly relevant to future decisions or interactions.
- It must be clear and concise for both AI and non-experts.

Do not store general explorations or abstract musings (e.g., general thoughts on the meaning of life) unless they lead to a specific, actionable conclusion.

Overrides:
- If the user issues a command to manipulate memory, follow their command and do as they wish.

Output:
- List each enduring fact on a separate line, with no extra punctuation or formatting.
- If no significant details exist, output exactly: null.`;

  try {
    const response = await fetch("https://ai.hackclub.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: `${system_prompt}`,
          },
          {
            role: "user",
            content: `The user's message is ${message}, the context to the message is ${JSON.stringify(context.value)}, and the global memory is ${JSON.stringify(global_memory)}`,
          },
        ],
        stream: false,
      }),
    });

    const data = await response.json();
    const memory = JSON.stringify(data.choices[0].message.content);

    if (memory != "null" && memory != "" && memory != '"null"') {
      localforage.setItem("memory", memory).catch(function (err) {
        throw "Error updating global memory: " + err;
      });
    } else {
      localforage.removeItem("memory").catch(function (err) {
        throw "Error removing global memory: " + err;
      });
    }
  } catch (err) {
    throw "Error analyzing user message for global memory adjustments: " + err;
  }
}
