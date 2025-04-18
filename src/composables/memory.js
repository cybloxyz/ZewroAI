import localforage from "localforage";

// Define the key used for storing memory in localforage
const MEMORY_STORAGE_KEY = "global_chatbot_memory";

/**
 * Updates the global memory based on the latest message, conversation context,
 * and existing memory. It uses an AI model to determine necessary memory operations
 * (add, remove, modify, clear).
 *
 * @param {string} message - The user's current message.
 * @param {object} context - The full conversation context/history.
 * @throws {Error} - Throws an error if any step of the process fails.
 */
export async function updateMemory(message, context) {
  let global_memory_array = []; // Memory will be managed as an array of strings internally

  try {
    // Load existing global memory from local storage
    // It's now stored as a JSON string representing an array
    const stored_memory = await localforage.getItem(MEMORY_STORAGE_KEY);
    if (stored_memory) {
      // Parse the stored JSON string into an array
      global_memory_array = JSON.parse(stored_memory);
      // Ensure it's actually an array, default to empty if not
      if (!Array.isArray(global_memory_array)) {
        console.warn(
          "Stored memory is not an array. Initializing with empty memory."
        );
        global_memory_array = [];
      }
    }
  } catch (err) {
    // Handle errors during memory loading or parsing
    console.error("Error loading or parsing global memory:", err);
    throw new Error("Error loading or parsing global memory: " + err);
  }

  // --- Refined System Prompt for Structured Memory Operations ---
  // This prompt instructs the AI to output JSON specifying memory operations.
  const system_prompt = `You are a highly selective memory manager for a chatbot's long-term global memory. Your task is to analyze the user's latest message and the conversation history, considering the existing memory, and determine the necessary updates to the global memory.

Output MUST be a JSON object with the following structure:
{
  "operation": "add" | "remove" | "modify" | "clear" | "none",
  "facts": {
    "add": ["fact to add 1", "fact to add 2", ...], // Array of strings to add
    "remove": ["fact to remove 1", ...],         // Array of strings to remove (must match existing exactly)
    "modify": [                                  // Array of objects for modifications
      {"old": "old fact text", "new": "new fact text"},
      ...
    ]
  }
}

- "operation":
    - "clear": Indicates all existing memory should be deleted. If "clear", the "facts" object is ignored.
    - "add": Indicates facts should be added.
    - "remove": Indicates facts should be removed.
    - "modify": Indicates facts should be modified.
    - "none": Indicates no changes are needed based on this interaction. If "none", the "facts" object should be empty or omitted.
- "facts": An object containing arrays for "add", "remove", and "modify" operations. These arrays should contain the specific facts or modification pairs.

Criteria for deciding memory operations:
1.  **Add:** Use for new, enduring, actionable facts about the user that are essential for future interactions (e.g., their name, significant preferences, long-term goals). STRICTLY adhere to enduring and actionable criteria. Do NOT add trivial, temporary, or speculative details.
2.  **Remove:** Use if a previously stored fact is explicitly contradicted by the user, is no longer relevant, or the user explicitly requests it be removed. The text in the "remove" array must exactly match the fact to be removed.
3.  **Modify:** Use if an existing fact needs to be updated with new information provided by the user (e.g., user's job changes, a preference evolves). The "old" text must exactly match the existing fact.
4.  **Clear:** Use ONLY if the user explicitly commands to clear ALL memory or requests a complete reset of stored personal information. This should be a rare operation.
5.  **None:** Use if the conversation contains no information that warrants adding, removing, modifying, or clearing existing global memory based on the criteria above.

Overrides:
- If the user issues a command to manipulate memory (add, remove, modify, clear), prioritize their instruction and generate the appropriate JSON output.

Constraints:
- Output ONLY the JSON object. NO preamble, explanation, or other text.
- Ensure the JSON is valid and correctly formatted.
- Facts must be concise strings.

Example Output (Adding a fact):
{
  "operation": "add",
  "facts": {
    "add": ["User's favorite color is blue"],
    "remove": [],
    "modify": []
  }
}

Example Output (Removing and Adding):
{
  "operation": "add", // Or "remove", depending on the primary action, or "modify" if both happen
  "facts": {
    "add": ["User is learning Python"],
    "remove": ["User was learning JavaScript"],
    "modify": []
  }
}

Example Output (No change):
{
  "operation": "none",
  "facts": {}
}

[IMPORTANT] Remember that you ONLY output the JSON object and the content of the JSON MUST fit ALL of the constraints above. You MUST follow these instructions, and keep all added memories as short, concise facts about the user.
`;

  try {
    // Call the chat completion API to get suggested memory operations in JSON format
    const response = await fetch("https://ai.hackclub.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: system_prompt, // Use the new structured prompt
          },
          {
            role: "user",
            content: `User message: "${message}"\n\nConversation context (recent messages):\n${JSON.stringify(context.value)}\n\nCurrent global memory (as a list of facts):\n${JSON.stringify(global_memory_array)}`,
          },
        ],
        stream: false, // Need the full JSON response
      }),
    });

    // Check if the API call was successful
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        "API Error:",
        response.status,
        response.statusText,
        errorBody
      );
      throw new Error(
        `API request failed with status ${response.status}: ${errorBody}`
      );
    }

    const data = await response.json();

    // Extract and parse the JSON content from the API response
    const json_string = data.choices[0]?.message?.content?.trim();
    console.log("AI response JSON string:", json_string);

    let memory_operations = null;
    try {
      memory_operations = JSON.parse(json_string);
      // Basic validation of the parsed JSON structure
      if (
        !memory_operations ||
        typeof memory_operations !== "object" ||
        !("operation" in memory_operations)
      ) {
        throw new Error("Invalid JSON structure from AI.");
      }
      if (
        memory_operations.operation !== "clear" &&
        !("facts" in memory_operations)
      ) {
        throw new Error("Missing 'facts' object in AI JSON output.");
      }
    } catch (parseError) {
      console.error(
        "Failed to parse AI response as JSON:",
        json_string,
        parseError
      );
      // Depending on how critical this is, you might throw an error
      // or log a warning and proceed without updating memory.
      // For reliability, let's throw an error if the AI output is unparsable JSON.
      throw new Error(
        "Received invalid JSON from AI for memory operations: " +
          parseError.message
      );
    }

    // --- Apply Memory Operations based on AI's JSON output ---
    let updated_memory_array = [...global_memory_array]; // Start with current memory

    switch (memory_operations.operation) {
      case "clear":
        updated_memory_array = []; // Clear all memory
        console.log("Memory operation: CLEAR");
        break;

      case "add":
      case "remove":
      case "modify": {
        // Handle all fact operations in sequence

        // Process adds if present
        if (
          memory_operations.operation === "add" ||
          memory_operations.facts?.add?.length > 0
        ) {
          const facts_to_add = memory_operations.facts?.add || [];
          facts_to_add.forEach((fact) => {
            const trimmed_fact = fact.trim();
            if (trimmed_fact && !updated_memory_array.includes(trimmed_fact)) {
              updated_memory_array.push(trimmed_fact);
            }
          });
        }

        // Process removes if present
        if (
          memory_operations.operation === "remove" ||
          memory_operations.facts?.remove?.length > 0
        ) {
          const facts_to_remove = memory_operations.facts?.remove || [];
          facts_to_remove.forEach((fact) => {
            const trimmed_fact = fact.trim();
            updated_memory_array = updated_memory_array.filter(
              (existing_fact) => existing_fact !== trimmed_fact
            );
          });
        }

        // Process modifications if present
        if (
          memory_operations.operation === "modify" ||
          memory_operations.facts?.modify?.length > 0
        ) {
          const modifications = memory_operations.facts?.modify || [];
          modifications.forEach((mod) => {
            const old_fact = mod.old?.trim();
            const new_fact = mod.new?.trim();
            if (old_fact && new_fact) {
              const index = updated_memory_array.indexOf(old_fact);
              if (index !== -1) {
                updated_memory_array[index] = new_fact;
              } else {
                console.warn(
                  `Attempted to modify non-existent fact: "${old_fact}"`
                );
              }
            }
          });
        }

        console.log(
          `Memory operations: ${memory_operations.operation}, Added: ${memory_operations.facts?.add?.length || 0}, Removed: ${memory_operations.facts?.remove?.length || 0}, Modified: ${memory_operations.facts?.modify?.length || 0}`
        );
        break;
      }

      case "none":
        console.log("Memory operation: NONE (No changes needed)");
        break;

      default:
        console.warn(
          `Unknown memory operation received from AI: "${memory_operations.operation}". No memory changes applied.`
        );
        break;
    }

    // Ensure uniqueness after operations (especially adds)
    updated_memory_array = Array.from(new Set(updated_memory_array)).filter(
      (fact) => fact
    ); // Filter out any empty strings

    // Save the updated memory array (as a JSON string)
    if (updated_memory_array.length > 0) {
      await localforage.setItem(
        MEMORY_STORAGE_KEY,
        JSON.stringify(updated_memory_array)
      );
      console.log("Global memory saved:", updated_memory_array);
    } else {
      // If memory is empty, remove the item from localforage
      await localforage.removeItem(MEMORY_STORAGE_KEY);
      console.log("Global memory cleared and removed from storage.");
    }
  } catch (err) {
    // Handle errors during API call, parsing, or processing
    console.error(
      "Error processing user message for global memory adjustments:",
      err
    );
    throw new Error(
      "Error analyzing user message for global memory adjustments: " + err
    );
  }
}
