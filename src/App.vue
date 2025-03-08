<script setup>
import { ref, nextTick } from 'vue';
import 'highlight.js/styles/github-dark.css';
import { inject } from "@vercel/analytics"
import { injectSpeedInsights } from '@vercel/speed-insights';

import MessageForm from './components/MessageForm.vue';
import ChatPanel from './components/ChatPanel.vue';

// Inject analytics and performance insights
inject();
injectSpeedInsights();

const messages = ref([]);
const isLoading = ref(false);
const controller = ref(new AbortController());
const dummy = ref(0);
const inputMessage = ref('');
const chatPanel = ref(null);

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
          { role: 'system', content: "The following are the memory of previous messages from this conversation: " + JSON.stringify(plainMessages) },
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
    dummy.value++;
    await nextTick();
  }
}


</script>

<template>
  <a href="https://hackclub.com/"
    style="position: absolute; top: 0px; left: 60px; border: 0; z-index: 999; background-color: transparent;"
    onmouseover="this.style.backgroundColor='transparent'" onmouseout="this.style.backgroundColor='transparent'"
    class="flag">
    <img src="https://assets.hackclub.com/flag-orpheus-top.svg" alt="Hack Club"
      style="width: 140px; max-width: 100%;" />
  </a>
  <div class="app-container">
    <header>
      <div class="disclaimer" style="margin-bottom: 8px;">
        This is not an official HackClub website. API provided by <a href="https://ai.hackclub.com">ai.hackclub.com</a>
      </div>

    </header>

    <ChatPanel ref="chatPanel" :messages="messages" :isLoading="isLoading" :dummy="dummy" />

    <MessageForm :isLoading="isLoading" @send-message="sendMessage" @abort-controller="controller.abort()" />
    <p class="disclaimer" id="disclaimer">
      AI-generated content should always be fact-checked.
    </p>
  </div>
</template>

<style>
@import url('https://cdn.jsdelivr.net/npm/hack-font@3.3.0/dist/web/hack.css');

:root {
  --hc-red: #ec3750;
  --hc-yellow: #fcd34d;
  --hc-dark: #0d0d0d;
  --hc-card: #1a1a1a;
  --hc-font: 'Hack', monospace;
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
  background: var(--hc-dark);
  color: #e0e0e0;
  font-family: var(--hc-font);
  overflow-x: hidden;
}

.app-container {
  display: flex;
  flex-direction: column;
  padding: var(--spacing-12) 0 var(--spacing-8);
  height: 100dvh;
  max-width: 100vw;
  box-sizing: border-box;
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
  color: #8e8e8e;
  margin: 0;
  text-align: center;
}

#disclaimer {
  margin-top: -8px;
}

@media (max-width: 1024px) {
  .flag {
    display: none;
  }
}

@media (max-width: 768px) {

  #disclaimer {
    margin-top: -16px;
  }

  .app-container {
    padding: var(--spacing-4) 0 var(--spacing-4);
  }

  header {
    padding-top: 0px;
  }
}
</style>
