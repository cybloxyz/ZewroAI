<script setup>
import { ref, nextTick, onMounted } from 'vue';
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
import SettingsPanel from './components/SettingsPanel.vue'


// Inject Vercel's analytics and performance insights
inject();
injectSpeedInsights();


const isDark = useDark();
const toggleDark = useToggle(isDark);

const messages = ref([]);
const isLoading = ref(false);
const controller = ref(new AbortController()); // Used to abort fetch requests
const triggerRerender = ref(0); // Used to force re-rendering of the chat panel
const inputMessage = ref('');
const chatPanel = ref(null);
const currConvo = ref('');
const conversationTitle = ref('');

const autoReasoningMode = ref(false); // If true, chooses between reasoning and regular models automatically.
const sidebarOpen = ref(window.innerWidth > 900); // Only enabled by default on larger screens, mobile users find it annoying to have to close the sidebar use the content.
const chatLoading = ref(false);

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
}

// Load settings (settings.js)
const settingsManager = new Settings();

// Loads settings on load
onMounted(async () => {
  await settingsManager.loadSettings();
  autoReasoningMode.value = settingsManager.settings.auto_reasoning_mode ?? true;
});

// Helper to generate unique IDs for messages
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

async function sendMessage(message, reasoningOverride) {
  if (!message.trim() || isLoading.value) return;

  // Create a new controller for each message
  controller.value = new AbortController();
  inputMessage.value = message;
  updateMemory(message, messages);

  const plainMessages = messages.value.map((msg) => ({
    role: msg.role,
    content: msg.content,
    complete: msg.complete,
  }));

  // Add user message with unique id
  const userMsg = {
    id: generateId(),
    role: "user",
    content: inputMessage.value,
    timestamp: new Date(),
    complete: true,
  };
  messages.value.push(userMsg);

  // Add assistant message with unique id
  const assistantMsg = {
    id: generateId(),
    role: "assistant",
    content: "",
    timestamp: new Date(),
    complete: false,
  };
  messages.value.push(assistantMsg);

  const promptText = inputMessage.value;
  inputMessage.value = "";
  isLoading.value = true;
  triggerRerender.value++;
  await nextTick();
  chatPanel.value.scrollToEnd("smooth");

  const global_memory = (await localforage.getItem("global_chatbot_memory")) || "";
  let useReasoning;
  if (reasoningOverride === true) {
    useReasoning = '"true"';
  } else if (autoReasoningMode.value) {
    useReasoning = await shouldUseReasoning(promptText, plainMessages);
  } else {
    useReasoning = '"false"';
  }
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
        // Update the last assistant message's content in-place
        messages.value[messages.value.length - 1].content += chunk;
        triggerRerender.value++;
        await nextTick();
        if (chatPanel.value.isAtBottom && !chatPanel.value.userScrolling) {
          chatPanel.value.scrollToEnd("instant");
        }
      }
      // Add completion time after reasoning is done
      messages.value[messages.value.length - 1].reasoningCompleted = new Date();
      messages.value[messages.value.length - 1].reasoningDuration = messages.value[messages.value.length - 1].reasoningCompleted - startTime;
    } else {
      // Regular message: read from a single API call.
      const response = await regularMsg(
        settingsManager.settings.system_prompt,
        global_memory,
        plainMessages,
        promptText,
        controller
      );
      // Use the async iterator interface for streaming chunks
      for await (const chunk of response) {
        if (chunk) {
          messages.value[messages.value.length - 1].content += chunk;
          triggerRerender.value++;
          await nextTick();
          if (chatPanel.value.isAtBottom && !chatPanel.value.userScrolling) {
            chatPanel.value.scrollToEnd("instant");
          }
        }
      }
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      messages.value[messages.value.length - 1].content = "Error: " + error.message;
    }
  } finally {
    messages.value[messages.value.length - 1].complete = true;
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
  chatLoading.value = true;
  messages.value = [];
  currConvo.value = id;

  const conv = await localforage.getItem(`conversation_${currConvo.value}`);
  messages.value = conv && conv.messages ? conv.messages : [];
  conversationTitle.value = conv?.title || '';
  chatLoading.value = false;
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
    <button class="global-menu-toggle" :class="{ dark: isDark }" @click="toggleSidebar" aria-label="Toggle menu">
      <img src="@/assets/menu.svg" alt="Menu" />
    </button>
    <Suspense>
      <AppSidebar :curr-convo="currConvo" :messages="messages" :is-open="sidebarOpen"
        @close-sidebar="sidebarOpen = false" @toggle-sidebar="toggleSidebar" @change-conversation="changeConversation"
        :is-dark="isDark" @delete-conversation="deleteConversation" @new-conversation="newConversation"
        @reload-settings="settingsManager.loadSettings" @toggle-dark="toggleDark" />
    </Suspense>
    <SettingsPanel />
    <!-- 
      .main-container always fills the available space.
      .main-content-inner centers and constrains the chat content for readability.
      This ensures the chat panel's scrollbar is always at the window edge.
    -->
    <div class="main-container" :class="{ 'sidebar-open': sidebarOpen }">
      <div class="main-content-inner">
        <Suspense>
          <ChatPanel ref="chatPanel" :curr-convo="currConvo" :curr-messages="messages" :isLoading="isLoading"
            :conversationTitle="conversationTitle" :trigger-rerender="triggerRerender" />
        </Suspense>
        <MessageForm :isLoading="isLoading" :autoReasoningMode="autoReasoningMode" @send-message="sendMessage"
          @abort-controller="controller.abort()" />
      </div>
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

a:hover {
  background-color: transparent;
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
  /* Prevents unwanted horizontal scrollbars */
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
  overflow: hidden;
  /* Prevent any overflow */
}

/* 
  .main-container fills the viewport height and available width.
  Uses flexbox to allow the chat panel to grow/shrink and keep the message form at the bottom.
*/
.main-container {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-width: 0;
  height: 100dvh;
  /* Fill viewport height so chat panel can scroll independently */
  transition: margin-left 0.3s cubic-bezier(.4, 1, .6, 1);
  margin-left: 0;
  box-sizing: border-box;
  overflow: hidden;
}

/* Sidebar open shifts main content right by sidebar width (280px) */
@media (min-width: 900px) {
  .main-container.sidebar-open {
    margin-left: 280px;
  }
}

/* 
  .main-content-inner is a flex column that fills the container height.
  Ensures chat panel and message form are stacked vertically.
*/
.main-content-inner {
  width: 100%;
  max-width: 800px;
  /* Arbitrary: 800px is a common readable width for chat */
  margin: 0 auto;
  padding: 0 8px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

/* On mobile, fill width and reduce padding */
@media (max-width: 900px) {
  .main-content-inner {
    max-width: 100vw;
    margin: 0;
    padding: 0;
  }

  .app-container {
    padding: 0;
  }

  #app {
    padding: 0;
  }
}

/* 
  Ensure the chat panel (ChatPanel.vue's .chat-wrapper) is the only scrollable area.
  The following styles should be in ChatPanel.vue, but are documented here for clarity:
  - .chat-wrapper { flex: 1 1 0; overflow-y: auto; overflow-x: hidden; min-height: 0; }
  This keeps the message form always visible at the bottom, and only the chat scrolls.
*/

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
    padding: 0;
    /* Remove padding that was causing scrollbar */
  }

  header {
    padding-top: 0px;
  }
}

.global-menu-toggle {
  position: fixed;
  top: 8px;
  left: 4px;
  z-index: 1002;
  background: transparent;
  border: none;
  box-shadow: none;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  transition: background 0.18s;
}

.global-menu-toggle img {
  width: 44px;
  height: 44px;
  display: block;
  filter: none;
}

.global-menu-toggle.dark img {
  filter: invert(1) brightness(1.2);
}
</style>
