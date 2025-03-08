<script setup>
import { onMounted, ref } from 'vue';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import MarkdownIt from 'markdown-it';
import markdownItFootnote from 'markdown-it-footnote';
import markdownItTaskLists from 'markdown-it-task-lists';

const props = defineProps(['messages', 'isLoading', 'dummy']);

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

function safeRender(content) {
  try {
    return md.render(content);
  } catch (error) {
    console.error("Markdown rendering error:", error);
    return `<pre>${content}</pre>`;
  }
}

const isAtBottom = ref(true);
const userScrolling = ref(false);
const chatWrapper = ref(null);
const isAutoScrolling = ref(false);
let scrollTimeout = null;

const onScroll = () => {
  // Ignore scroll events during auto-scrolling
  if (isAutoScrolling.value) return;

  userScrolling.value = true;
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    userScrolling.value = false;
  }, 1000);

  const { scrollTop, scrollHeight, clientHeight } = chatWrapper.value;
  isAtBottom.value = scrollHeight - (scrollTop + clientHeight) < 10;
};

const scrollToEnd = (behavior) => {
  isAutoScrolling.value = true;
  chatWrapper.value.scrollTo({
    top: chatWrapper.value.scrollHeight,
    behavior,
  });
  // Reset isAutoScrolling flag after a short delay
  setTimeout(() => {
    isAutoScrolling.value = false;
  }, 50);
};

onMounted(() => {
  scrollToEnd('smooth');
});

defineExpose({ onScroll, scrollToEnd, isAtBottom, userScrolling });
</script>

<template>
  <div class="chat-wrapper" ref="chatWrapper" @scroll.passive="onScroll">
    <div class="chat-container">
      <div v-for="(message, idx) in messages" :key="idx + '-' + dummy" class="message" :class="message.role">
        <div class="bubble" :class="{ typing: !message.complete }">

          <div class="markdown-content" v-html="safeRender(message.content)"></div>
          <span v-if="!message.complete" class="cursor">｜</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-wrapper {
  flex: 1;
  overflow-y: auto;
  background: var(--hc-card);
  padding: var(--spacing-16);
  border-radius: 28px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  box-shadow: 0 4px 16px rgb(0, 0, 0, 0.8);
  scroll-behavior: smooth;
  position: relative;
  z-index: 1;
  margin-bottom: var(--spacing-8);
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
  padding: 20px;
  border-radius: 24px;
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

.katex-error {
  color: var(--hc-red) !important;
  border-bottom: 1px dashed #cc0000;
  cursor: help;
}

@media (max-width: 768px) {
  .chat-container {
    gap: var(--spacing-16);
    padding: 0 var(--spacing-8);
  }

  .chat-wrapper {
    padding: var(--spacing-4);
    margin: var(--spacing-8) var(--spacing-4) var(--spacing-8) var(--spacing-4);
    border-radius: var(--border-radius);
  }

  .bubble {
    max-width: 88%;
    padding: var(--spacing-12) var(--spacing-8);
    font-size: smaller;
  }
}
</style>
