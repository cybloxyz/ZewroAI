<script setup>
import { ref, nextTick } from 'vue';
import 'highlight.js/styles/github-dark.css';
import { inject } from "@vercel/analytics"
import { injectSpeedInsights } from '@vercel/speed-insights';
import { useDark, useToggle } from "@vueuse/core";
import localforage from 'localforage';

import { createConversation, storeMessages, deleteConversation as deleteConv } from './composables/storeConversations'
import { updateMemory } from './composables/memory';
import { shouldUseReasoning, regularMsg, streamChainOfThought } from './composables/message'
import Settings from './composables/settings';


import MessageForm from './components/MessageForm.vue';
import ChatPanel from './components/ChatPanel.vue';
import AppSidebar from './components/AppSidebar.vue'


// Inject analytics and performance insights
inject();
injectSpeedInsights();


const isDark = useDark();
const toggleDark = useToggle(isDark);

const messages = ref([]);
const isLoading = ref(false);
const controller = ref(new AbortController());
const triggerRerender = ref(0);
const inputMessage = ref('');
const chatPanel = ref(null);
const currConvo = ref('');
const conversationTitle = ref('');

// Load settings (settings.js)
const settingsManager = new Settings();

async function sendMessage(message) {
  // Set up and update memory
  inputMessage.value = message;
  updateMemory(message, messages);
  if (!inputMessage.value.trim() || isLoading.value) return;

  const plainMessages = messages.value.map((msg) => ({
    role: msg.role,
    content: msg.content,
    complete: msg.complete,
  }));

  // Add user message and create a blank assistant message.
  messages.value.push({
    role: "user",
    content: inputMessage.value,
    timestamp: new Date(),
    complete: true,
  });
  const assistantMessage = {
    role: "assistant",
    content: "",
    timestamp: new Date(),
    complete: false,
  };
  messages.value.push(assistantMessage);

  const promptText = inputMessage.value;
  inputMessage.value = "";
  isLoading.value = true;
  triggerRerender.value++;
  await nextTick();
  chatPanel.value.scrollToEnd("smooth");

  const global_memory = (await localforage.getItem("memory")) || "";
  const useReasoning = await shouldUseReasoning(promptText, plainMessages);
  console.log("useReasoning:", useReasoning);

  try {
    if (useReasoning === "\"true\"") {
      const startTime = new Date();
      // Chain-of-thought: iterate the stream generator.
      for await (const chunk of streamChainOfThought(
        settingsManager.settings.system_prompt,
        global_memory,
        plainMessages,
        promptText,
        controller
      )) {
        assistantMessage.content += chunk;
        triggerRerender.value++;
        await nextTick();
        if (chatPanel.value.isAtBottom && !chatPanel.value.userScrolling) {
          chatPanel.value.scrollToEnd("instant");
        }
      }
      // Add completion time after reasoning is done
      assistantMessage.reasoningCompleted = new Date();
      assistantMessage.reasoningDuration = assistantMessage.reasoningCompleted - startTime;
    } else {
      // Regular message: read from a single API call.
      const response = await regularMsg(
        settingsManager.settings.system_prompt,
        global_memory,
        plainMessages,
        promptText,
        controller
      );
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
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          try {
            const json = JSON.parse(trimmed.replace("data: ", ""));
            const content = json.choices[0].delta.content;
            if (content) {
              assistantMessage.content += content;
              triggerRerender.value++;
              await nextTick();
              if (chatPanel.value.isAtBottom && !chatPanel.value.userScrolling) {
                chatPanel.value.scrollToEnd("instant");
              }
            }
          } catch (err) {
            console.error("Error parsing chunk:", err);
          }
        }
      }
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      assistantMessage.content = "Error: " + error.message;
    }
  } finally {
    assistantMessage.complete = true;
    isLoading.value = false;
    // Create or store conversation
    if (messages.value.length === 2) {
      currConvo.value = await createConversation(messages, new Date());
    } else if (messages.value.length > 2) {
      await storeMessages(currConvo.value, messages, new Date());
    }
    if (currConvo.value) {
      const convData = await localforage.getItem(`conversation_${currConvo.value}`);
      conversationTitle.value = convData?.title || "";
    }
    triggerRerender.value++;
    await nextTick();
  }
}

async function changeConversation(id) {
  currConvo.value = id;

  const conv = await localforage.getItem(`conversation_${currConvo.value}`);
  messages.value = conv && conv.messages ? conv.messages : [];
  conversationTitle.value = conv.title;

  triggerRerender.value++;
  await nextTick();
  chatPanel.value.scrollToEnd("instant");
}

async function deleteConversation(id) {
  await deleteConv(id)
  // Optional:
  // If the current conversation is deleted, clear messages and currConvo,
  // or switch to another conversation as desired.
  if (currConvo.value === id) {
    currConvo.value = '';
    messages.value = [];
    conversationTitle.value = '';
  }
  // Force an update
  triggerRerender.value++;
  await nextTick();
  chatPanel.value.scrollToEnd("smooth");
}

async function newConversation() {
  currConvo.value = '';
  messages.value = [];
  conversationTitle.value = '';

  triggerRerender.value++;
  await nextTick();
}

</script>

<template>
  <div class="app-container">

    <Suspense>
      <AppSidebar :curr-convo="currConvo" :messages="messages" @change-conversation="changeConversation"
        :is-dark="isDark" @delete-conversation="deleteConversation" @new-conversation="newConversation"
        @reload-settings="settingsManager.loadSettings" @toggle-dark="toggleDark" />
    </Suspense>

    <div class="main-container">
      <Suspense>
        <ChatPanel ref="chatPanel" :curr-convo="currConvo" :curr-messages="messages" :isLoading="isLoading"
          :conversationTitle="conversationTitle" :trigger-rerender="triggerRerender" />
      </Suspense>

      <MessageForm :isLoading="isLoading" @send-message="sendMessage" @abort-controller="controller.abort()" />
    </div>
  </div>
</template>

<style>
@font-face {
  font-family: 'Phantom Sans';
  src: url('https://assets.hackclub.com/fonts/Phantom_Sans_0.7/Regular.woff') format('woff'),
    url('https://assets.hackclub.com/fonts/Phantom_Sans_0.7/Regular.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Phantom Sans';
  src: url('https://assets.hackclub.com/fonts/Phantom_Sans_0.7/Italic.woff') format('woff'),
    url('https://assets.hackclub.com/fonts/Phantom_Sans_0.7/Italic.woff2') format('woff2');
  font-weight: normal;
  font-style: italic;
  font-display: swap;
}

@font-face {
  font-family: 'Phantom Sans';
  src: url('https://assets.hackclub.com/fonts/Phantom_Sans_0.7/Bold.woff') format('woff'),
    url('https://assets.hackclub.com/fonts/Phantom_Sans_0.7/Bold.woff2') format('woff2');
  font-weight: bold;
  font-style: normal;
  font-display: swap;
}

:root {
  --hc-font: 'Phantom Sans';
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-24: 24px;
  --border-radius: 12px;
}

html,
body,
#app {
  margin: 0;
  padding: 0;
  height: 100dvh;
  width: 100vw;
  background: #FFFFFF;
  color: #1f2d3d;
  font-family: var(--hc-font);
  overflow-x: hidden;
}

img {
  user-select: none;
  -moz-user-select: none;
  -webkit-user-drag: none;
  -webkit-user-select: none;
  -ms-user-select: none;
}

button {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  outline: none;
  border-radius: 12px;
  transition: all 0.2s ease;
  color: #121217;
}

button:hover {
  background-color: #8492a633;
}

.app-container {
  display: flex;
  padding: 0;
  height: 100dvh;
  max-width: 100vw;
  box-sizing: border-box;
}

.main-container {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0 8px;
  flex: 1;
  transition: margin-left 0.3s ease;
}

header {
  background: var(--hc-dark);
  border-bottom: 2px solid var(--hc-red);
  padding: 0px var(--spacing-16);
  margin-bottom: var(--spacing-8);
  text-align: center;
}

.disclaimer {
  font-size: 0.75rem;
  color: #3c4858;
  margin: 0;
  text-align: center;
}

#disclaimer {
  margin-top: -8px;
}

/* Dark mode settings */

.dark #app {
  background: #121217;
  scrollbar-color: #252429 #3c4858;
  color: #E0E0E0;
}

.dark .disclaimer {
  color: #8e8e8e;
}

.dark button {
  color: #E0E0E0;
}

/* Other display size styles */

@media (max-width: 1024px) {
  .flag {
    display: none;
  }
}

@media (max-width: 768px) {

  #disclaimer {
    margin-top: -16px;
    font-size: smaller;
  }

  .app-container {
    padding: var(--spacing-12) 16px var(--spacing-8);
  }

  header {
    padding-top: 0px;
  }
}
</style>
