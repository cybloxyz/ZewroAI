<script setup>
import { ref, nextTick } from 'vue';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import MarkdownIt from 'markdown-it';
import markdownItFootnote from 'markdown-it-footnote';
import markdownItTaskLists from 'markdown-it-task-lists';
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch (_) { }
    }
    return '';
  }
})
  .use(markdownItFootnote)
  .use(markdownItTaskLists, { enabled: true, label: true, bulletMarker: '-' });

function safeRender(content, complete) {
  try {
    return md.render(content);
  } catch (error) {
    console.error("Markdown rendering error:", error);
    return `<pre>${content}</pre>`;
  }
}

const isAtBottom = ref(true);
const chatWrapper = ref(null);
const onScroll = () => {
  const { scrollTop, scrollHeight, clientHeight } = chatWrapper.value;
  isAtBottom.value = scrollHeight - (scrollTop + clientHeight) < 6;
};

const messages = ref([]);
const inputMessage = ref('');
const isLoading = ref(false);
const controller = ref(new AbortController());
const dummy = ref(0);

async function sendMessage() {
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

  chatWrapper.value.scrollTo({
    top: chatWrapper.value.scrollHeight,
    behavior: 'auto'
  });

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
            if (isAtBottom.value) {
              chatWrapper.value.scrollTo({
                top: chatWrapper.value.scrollHeight,
                behavior: 'auto'
              });
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
  <Analytics />
  <SpeedInsights />
  <a href="https://hackclub.com/"
    style="position: absolute; top: 0; left: 128px; border: 0; z-index: 999; background-color: transparent;"
    onmouseover="this.style.backgroundColor='transparent'" onmouseout="this.style.backgroundColor='transparent'">
    <img src="https://assets.hackclub.com/flag-orpheus-top.svg" alt="Hack Club"
      style="width: 228px; max-width: 100%;" />
  </a>
  <div class="app-container">
    <header>
      <h1>Hack Club AI ChatBot</h1>
      <div class="disclaimer">
        This is not an official HackClub website. API from
        <a href="https://ai.hackclub.com">ai.hackclub.com</a>
      </div>
      <div class="disclaimer">
        AI-generated content should always be fact-checked.
      </div>
    </header>

    <div class="chat-wrapper" ref="chatWrapper" @scroll.passive="onScroll">
      <div class="chat-container">
        <div v-for="(message, idx) in messages" :key="idx + '-' + dummy" class="message" :class="message.role">
          <div class="bubble" :class="{ typing: !message.complete }">
            <!-- Pass message.complete to safeRender -->
            <div class="markdown-content" v-html="safeRender(message.content, message.complete)"></div>
            <span v-if="!message.complete" class="cursor">▎</span>
          </div>
        </div>
      </div>
    </div>

    <form class="message-form" @submit.prevent="sendMessage">
      <textarea v-model="inputMessage" placeholder="Type your message..." :disabled="isLoading"
        @keydown.enter.exact.prevent="sendMessage" @keydown.ctrl.enter.exact.prevent="inputMessage += '\n'"></textarea>
      <button type="button" @click="isLoading ? controller.abort() : sendMessage()"
        :disabled="!inputMessage.trim() && !isLoading">
        <svg v-if="!isLoading" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
        <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </form>
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
  height: 100vh;
  width: 100vw;
  background: var(--hc-dark);
  color: #e0e0e0;
  font-family: var(--hc-font);
  overflow-x: hidden;
}

.app-container {
  display: flex;
  flex-direction: column;
  padding: var(--spacing-16);
  height: 100vh;
  max-width: 100vw;
  box-sizing: border-box;
}

header {
  background: var(--hc-dark);
  border-bottom: 2px solid var(--hc-red);
  padding: var(--spacing-8) var(--spacing-16);
  margin-bottom: var(--spacing-16);
  text-align: center;
}

header h1 {
  margin: 0;
  font-size: 1.8rem;
  font-weight: bold;
  color: #ececf1;
}

.disclaimer {
  font-size: 0.75rem;
  color: #8e8e8e;
  margin: var(--spacing-4) 0;
}

.chat-wrapper {
  flex: 1;
  overflow-y: auto;
  background: var(--hc-card);
  padding: var(--spacing-16);
  padding-bottom: 8rem;
  border-radius: var(--border-radius);
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  scroll-behavior: smooth;
  position: relative;
  z-index: 1;
}

.chat-wrapper::-webkit-scrollbar {
  width: 8px;
}

.chat-wrapper::-webkit-scrollbar-track {
  background: #2d2d2d;
  border-radius: 4px;
}

.chat-wrapper::-webkit-scrollbar-thumb {
  background: #555768;
  border-radius: 4px;
}

.chat-wrapper::-webkit-scrollbar-button:end:increment {
  height: 25%;
  display: block;
  background: transparent;
}

.chat-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-24);
  padding: 0 var(--spacing-16);
  overflow-anchor: none;
  scroll-behavior: smooth;
  margin: 0 auto var(--spacing-16);
  max-width: 800px;
}

.message {
  display: flex;
  margin: var(--spacing-16) var(--spacing-16);
  max-width: calc(100% - 32px);
}

.message.user {
  justify-content: flex-end;
}

.bubble {
  max-width: 90%;
  padding: var(--spacing-16) 20px;
  border-radius: var(--border-radius);
  line-height: 1.5;
  font-size: 1rem;
  position: relative;
}

.message.assistant .bubble {
  background: #444654;
  border: 1px solid #555768;
  color: #ececf1;
}

.message.user .bubble {
  background: var(--hc-red);
  border: 1px solid #c42d3a;
}

.markdown-content {
  overflow-x: auto;

  h1:first-child,
  h2:first-child,
  h3:first-child,
  h4:first-child,
  h5:first-child,
  h6:first-child {
    margin-top: 0.5em;
  }

  .katex-error {
    color: var(--hc-red);
  }

  .katex {
    font-size: 1.1em !important;
    padding: 0.5em 0;
    overflow-x: auto;
  }

  .katex-display {
    margin: 1em 0 !important;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 1.25em 0 0.75em;
    font-weight: 600;
  }

  h1 {
    font-size: 1.8em;
  }

  h2 {
    font-size: 1.6em;
  }

  h3 {
    font-size: 1.4em;
  }

  h4 {
    font-size: 1.2em;
  }

  strong {
    font-weight: 700;
    color: #fff;
  }

  em {
    font-style: italic;
  }

  blockquote {
    border-left: 4px solid #3b82f6;
    margin: 1em 0;
    padding: 0.5em 1em;
    background: #2d2d2d;
    border-radius: 4px;
    color: #a0a0a0;
  }

  hr {
    border: none;
    border-top: 1px solid #555768;
    margin: 1.5em 0;
  }

  .footnote-ref {
    font-size: 0.8em;
    vertical-align: super;
    margin-left: 2px;
  }

  .footnote-ref::before {
    content: '[';
    color: var(--hc-red);
  }

  .footnote-ref::after {
    content: ']';
    color: var(--hc-red);
  }

  .footnotes ol {
    padding-left: 1.5em;
  }

  .footnotes li {
    margin: 0.5em 0;
  }

  table {
    border-collapse: collapse;
    margin: 1em 0;
    width: 100%;
    background: #2d2d2d;
    border-radius: 6px;
    overflow: hidden;

    th,
    td {
      padding: 0.75em 1em;
      border: 1px solid #555768;
    }

    th {
      background: #3b82f6;
      color: white;
      font-weight: 600;
    }

    .math-display {
      padding: 1em;
      background: #2d2d2d;
      border-radius: 4px;
      margin: 1em 0;
      overflow-x: auto;
    }

    .footnotes {
      border-top: 1px solid #555768;
      margin-top: 2em;
      padding-top: 1em;
      font-size: 0.9em;
      color: #8e8e8e;
    }
  }

  code:not(.hljs) {
    background: #2d2d2d;
    padding: 0.2em 0.4em;
    border-radius: 4px;
    color: #f88b8b;
    font-size: 0.9em;
  }

  pre {
    background: #1e1e1e !important;
    border: 1px solid #555768 !important;
    border-radius: 8px;
    padding: 1.25rem !important;
    margin: 1.5em 0;

    code {
      background: none !important;
      padding: 0 !important;
      color: #d4d4d4 !important;
    }
  }
}

.hljs {
  border: 1px solid #e5e7eb !important;
  border-radius: 0.375rem;
  padding: 1rem !important;
  margin: 1rem 0;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.875em;

  background: #1e1e1e !important;
  color: #d4d4d4 !important;

  .hljs-keyword {
    color: #569cd6;
  }

  .hljs-built_in {
    color: #4ec9b0;
  }

  .hljs-string {
    color: #ce9178;
  }

  .hljs-number {
    color: #b5cea8;
  }

  .hljs-comment {
    color: #6a9955;
  }
}

pre {
  background: #1e1e1e;
  border: 1px solid #363636 !important;
  border-radius: 0.375rem;
  padding: 1rem;
  overflow-x: auto;
}

code {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  background: #f3f4f6;
  padding: 0.2em 0.4em;
  border-radius: 0.25em;
  font-size: 0.9em;
}

.cursor {
  color: #3b82f6;
  animation: blink 1.2s ease infinite;
  vertical-align: baseline;
  margin-left: var(--spacing-4);
  line-height: 1.2;
  display: inline-block;
  /* Removed vertical translation so the caret lines up with text */
}

@keyframes blink {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
}

.message-form {
  position: fixed;
  bottom: var(--spacing-16);
  left: var(--spacing-16);
  right: var(--spacing-16);
  background: var(--hc-card);
  padding: var(--spacing-16);
  display: flex;
  gap: var(--spacing-12);
  border: 2px solid #2d2d2d;
  justify-content: center;
  border-radius: var(--border-radius);
  max-width: 800px;
  margin: 0 auto;
  z-index: 10;
}

.message-form textarea {
  resize: none;
  min-height: 44px;
  max-height: 200px;
  line-height: 1.5;
  flex: 1;
  padding: var(--spacing-16);
  border-radius: var(--border-radius);
  border: 1px solid #555768;
  background: #40414f;
  color: #ececf1;
  font-size: 1rem;
}

.message-form button {
  padding: 0;
  border-radius: var(--border-radius);
  background: var(--hc-red);
  color: white;
  border: none;
  display: grid;
  place-items: center;
  transition: all 0.2s ease;
  min-width: 44px;
  width: 54px;
  height: 54px;
}

.message-form button:disabled {
  background: #555768;
  cursor: not-allowed;
}

.message-form button:not(:disabled):hover {
  background: #c42d3a;
}

.message-form button svg {
  color: currentColor;
}

.katex-error {
  color: var(--hc-red) !important;
  border-bottom: 1px dashed #cc0000;
  cursor: help;
}

@media (max-width: 768px) {
  .chat-wrapper {
    padding: var(--spacing-16);
  }

  .message-form {
    padding: var(--spacing-16);
  }

  .bubble {
    max-width: 88%;
  }
}
</style>
