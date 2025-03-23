import localforage from "localforage";
import { toRaw } from "vue";
import { emitter } from "@/emitter";

export async function createConversation(messagesRef, lastUpdated) {
  const conversationId = crypto.randomUUID();

  const systemPrompt = `You are an AI with the task of shortening and summarising messages into a short title. You must summarise the given messages based on their content into a 20 character title. Each conversation is between a user and an AI. The messages provided to you are not the only messages of the conversation. The title must be general enough to apply to what you think the conversation will be about. Do not return any filler or extra words or characters.`;

  const messages = toRaw(messagesRef.value);
  const simplifiedMessages = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
  const userPrompt = JSON.stringify(simplifiedMessages);

  try {
    const response = await fetch("https://ai.hackclub.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const plainMessages = JSON.parse(JSON.stringify(messages));

    const data = await response.json();
    const title = data.choices?.[0]?.message?.content || "Untitled";

    // Store full conversation
    await localforage.setItem(`conversation_${conversationId}`, {
      title,
      lastUpdated,
      messages: plainMessages,
    });

    // Store metadata separately (only ID, title, and timestamp)
    const metadata =
      (await localforage.getItem("conversations_metadata")) || [];
    metadata.push({ id: conversationId, title, lastUpdated });
    await localforage.setItem("conversations_metadata", metadata);

    emitter.emit("updateConversations");

    console.log("Conversation saved successfully!");
    return conversationId;
  } catch (error) {
    console.error("Error creating conversation:", error);
  }
}

export async function storeMessages(conversationId, messagesRef, lastUpdated) {
  const messages = toRaw(messagesRef.value);

  // Attempt to get the existing conversation data.
  const data = await localforage.getItem(`conversation_${conversationId}`);
  if (!data) {
    console.warn(`No conversation found for id ${conversationId}.`);
    return;
  }
  const title = data.title || "Untitled";

  // Convert messages to plain objects to avoid DataCloneError
  const plainMessages = JSON.parse(JSON.stringify(messages));

  // Store full conversation
  await localforage.setItem(`conversation_${conversationId}`, {
    title,
    lastUpdated,
    messages: plainMessages,
  });

  // Optionally update metadata. If you want to replace existing metadata,
  // you can filter out the old entry before pushing the new one.
  const metadata = (await localforage.getItem("conversations_metadata")) || [];
  // Remove any existing entry with the same id (optional):
  const updatedMetadata = metadata.filter((m) => m.id !== conversationId);
  updatedMetadata.push({ id: conversationId, title, lastUpdated });
  await localforage.setItem("conversations_metadata", updatedMetadata);

  console.log("Conversation saved successfully!");
}

export async function deleteConversation(conversationId) {
  // Remove full conversation data
  await localforage.removeItem(`conversation_${conversationId}`);

  // Update metadata by filtering out the deleted conversation.
  const metadata = (await localforage.getItem("conversations_metadata")) || [];
  const updatedMetadata = metadata.filter((m) => m.id !== conversationId);
  await localforage.setItem("conversations_metadata", updatedMetadata);

  // Emit an event so that the sidebar updates its list.
  emitter.emit("updateConversations");

  console.log(`Conversation ${conversationId} deleted successfully!`);
}
