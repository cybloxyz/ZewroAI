import localforage from "localforage";

export async function updateMemory(message, context) {
  let global_memory;
  try {
    global_memory = (await localforage.getItem("memory")) || "";
  } catch (err) {
    throw "Error loading global memory: " + err;
  }

  const system_prompt = `You are a memory extractor for long-term global conversation insights, part of a web application. You receive three inputs: the user’s current message, the full conversation history, and the existing global memory. Analyze these inputs and update the global memory with only enduring, significant facts that will shape future interactions. Discard any trivial or ephemeral details—such as greetings, timestamps, conversation initiations, or casual small talk—that do not provide long-term value.

Your output must be exactly the updated global memory: • A list of concise, significant facts (one fact per line) that are clear to both AI and non-experts. • If no lasting or meaningful details are found, output exactly: null • If a situation changes in which a memory is no longer relevant, remove that memory from the list.

Do not use extra punctuation like points or quotation marks, as these are added automatically.

Do not include any additional commentary, notes, or formatting beyond this list.`;

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
