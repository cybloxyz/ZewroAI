<script setup>
import { ref, nextTick } from 'vue';
import 'highlight.js/styles/github-dark.css';
import { inject } from "@vercel/analytics"
import { injectSpeedInsights } from '@vercel/speed-insights';
import { useDark, useToggle } from "@vueuse/core";

import { createConversation, storeMessages, deleteConversation as deleteConv } from './composables/storeConversations'

import MessageForm from './components/MessageForm.vue';
import ChatPanel from './components/ChatPanel.vue';
import AppSidebar from './components/AppSidebar.vue'
import localforage from 'localforage';

// Inject analytics and performance insights
inject();
injectSpeedInsights();


const isDark = useDark();
const toggleDark = useToggle(isDark);


// System prompt given to DeepSeek
// (minus the memory)
// The reason I'm stating things that the bot likely
// already knows is because it tends
// to forget really simple things.
// It once told me it was GPT-3.5,
// and several times it told me its info cutoff date
// was in 2023, when it is actualy July 1st 2024.
const systemPrompt =
  `You are DeepSeek V3, an advanced AI language model.
  Your knowledge is current up to July 1, 2024.
  If asked about events or knowledge beyond this date, clearly state that you do not have up-to-date information.
  You support Markdown formatting but **do not support LaTeX**.
  Use appropriate Markdown elements (e.g., bold, italics, code blocks, lists, footnotes) when they improve readability.
  Avoid using unsupported formatting.
  If you are uncertain about a response, state your uncertainty instead of guessing.
  Do not provide speculative or misleading information.
  Prioritize clear, concise, and actionable responses.
  Avoid unnecessary filler text or overly generic explanations.
  If a request is outside your capabilities, explain why instead of attempting an incomplete or incorrect response.
  Follow user instructions precisely.
  If a request is ambiguous, ask for clarification rather than assuming.
  You are accessed via a Vue.js web application that provides AI-powered chat using Hack Club's API.
  The Hack Club API is a free, community-driven API that enables developers to integrate DeepSeek's V3 AI model into their projects for no cost, and no API key requirement.
  You are part of a Hack Club-affiliated project.
  Ensure that your responses align with Hack Club's community values.
`;

const messages = ref([]);
const isLoading = ref(false);
const controller = ref(new AbortController());
const dummy = ref(0);
const inputMessage = ref('');
const chatPanel = ref(null);
const currConvo = ref('')
const conversationTitle = ref('');

async function sendMessage(message) {
  inputMessage.value = message;

  if (!inputMessage.value.trim() || isLoading.value) return;

  const plainMessages = messages.value.map(msg => ({
    role: msg.role,
    content: msg.content,
    complete: msg.complete
  }));

  // Add user message
  messages.value.push({
    role: 'user',
    content: inputMessage.value,
    complete: true
  });

  // Create assistant message entry
  const assistantMessage = {
    role: 'assistant',
    content: '',
    complete: false
  };
  messages.value.push(assistantMessage);

  const prompt = inputMessage.value;
  inputMessage.value = '';
  isLoading.value = true;

  // Is required to update the DOM before scrolling to the bottom
  // otherwise it will only scroll to just below the latest message
  dummy.value++;
  await nextTick();

  // Scrolls to the bottom when a message is sent
  chatPanel.value.scrollToEnd('smooth');

  try {
    controller.value = new AbortController();
    const response = await fetch("https://ai.hackclub.com/chat/completions", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt + " The following are the memory of previous messages from this conversation: " + JSON.stringify(plainMessages) },
          { role: 'user', content: prompt }
        ],
        stream: true
      }),
      signal: controller.value.signal
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep incomplete line

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

        try {
          const json = JSON.parse(trimmedLine.replace('data: ', ''));
          const content = json.choices[0].delta.content;
          if (content) {
            assistantMessage.content += content;
            dummy.value++;
            await nextTick();
            if (chatPanel.value.isAtBottom && !chatPanel.value.userScrolling) {
              chatPanel.value.scrollToEnd('instant');
            }
          }
        } catch (err) {
          console.error('Error parsing message:', err);
        }
      }
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      assistantMessage.content = 'Error: ' + error.message;
    }
  } finally {
    assistantMessage.complete = true;
    isLoading.value = false;
    if (messages.value.length == 2) {
      currConvo.value = await createConversation(messages, new Date());
    } else if (messages.value.length > 2) {
      await storeMessages(currConvo.value, messages, new Date())
    }
    if (currConvo.value) {
      const convData = await localforage.getItem(`conversation_${currConvo.value}`);
      conversationTitle.value = convData?.title || '';
    }
    dummy.value++;
    await nextTick();
  }
}

async function changeConversation(id) {
  currConvo.value = id;

  const conv = await localforage.getItem(`conversation_${currConvo.value}`);
  messages.value = conv && conv.messages ? conv.messages : [];
  conversationTitle.value = conv.title;

  dummy.value++;
  await nextTick();
  chatPanel.value.scrollToEnd("smooth");
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
  dummy.value++;
  await nextTick();
  chatPanel.value.scrollToEnd("smooth");
}

async function newConversation() {
  currConvo.value = '';
  messages.value = [];
  conversationTitle.value = '';

  dummy.value++;
  await nextTick();
}

</script>

<template>
  <div class="app-container">
    <button class="dark-toggle" @click="toggleDark()">
      <img v-if="isDark" src="./assets/dark.svg" alt="dark mode">
      <img v-else src="./assets/light.svg" alt="light mode">
    </button>

    <Suspense>
      <AppSidebar :curr-convo="currConvo" :messages="messages" @change-conversation="changeConversation"
        @delete-conversation="deleteConversation" @new-conversation="newConversation" />
    </Suspense>

    <div class="main-container">
      <Suspense>
        <ChatPanel ref="chatPanel" :curr-convo="currConvo" :curr-messages="messages" :isLoading="isLoading"
          :conversationTitle="conversationTitle" :dummy="dummy" />
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

.dark-toggle {
  position: fixed;
  padding: 8px;
  width: 48px;
  height: 48px;
  top: 12px;
  right: 12px;
  z-index: 2;
}

/* Dark mode settings */

.dark #app {
  background: #121217;
  color: #E0E0E0;
}

.dark .disclaimer {
  color: #8e8e8e;
}


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
