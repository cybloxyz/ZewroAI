<script setup>
import { onMounted, ref } from 'vue'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import MarkdownIt from 'markdown-it'
import markdownItFootnote from 'markdown-it-footnote'
import markdownItTaskLists from 'markdown-it-task-lists'

const props = defineProps(['currConvo', 'currMessages', 'isLoading', 'conversationTitle', 'triggerRerender'])

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch (_) { }
      return ''
    }
  },
})
  .use(markdownItFootnote)
  .use(markdownItTaskLists, { enabled: true, label: true, bulletMarker: '-' })

// Safely render full Markdown (with code block handling).
function safeRender(content) {
  try {
    let rendered = md.render(content)
    rendered = rendered.replace(/<pre>([\s\S]*?)<\/pre>/g, (match, codeBlock) => {
      const innerCode = codeBlock.replace(/^<code[^>]*>|<\/code>$/g, '')
      return `
<div class="code-container">
  <div class="pre-wrapper">
    <pre><code>${innerCode}</code></pre>
    <button class="copy-button" onclick="copyCode(this)">Copy</button>
  </div>
</div>`
    })
    return rendered;
  } catch (error) {
    console.error("Markdown rendering error:", error)
    return `<pre>${content}</pre>`
  }
}

function isChainOfThought(content) {
  return content.includes('🤔 Let me think this through step by step');
}

function extractReasoningSteps(content) {
  if (!isChainOfThought(content)) return '';

  // Get everything before SUMMARIZE, but remove the thinking emoji
  return content
    .split('### SUMMARIZE ###')[0]
    .trim();
}


// Get only the final solution/summary
function getSolutionOnly(content) {
  if (!isChainOfThought(content)) return content;

  // Return empty string while waiting for summary
  if (!content.includes('### SUMMARIZE ###') && !content.includes('### SUMMARY ###')) {
    return '...thinking...';
  }

  // Try to get the summary section
  const summaryParts = content.split('### SUMMARY ###');
  if (summaryParts.length > 1) {
    return summaryParts[1].replace(/---+/g, '').trim();
  }

  // Fallback to SUMMARIZE section
  const summarizeParts = content.split('### SUMMARIZE ###');
  if (summarizeParts.length > 1) {
    return summarizeParts[1].replace(/---+/g, '').trim();
  }

  // If no summary found, show thinking message
  return '...thinking...';
}

// Calculate thinking time based on stored duration or timestamps
function getThinkingTime(message) {
  if (!message.timestamp) return '< 1s';

  if (message.reasoningDuration) {
    // Use stored duration if available
    const seconds = Math.round(message.reasoningDuration / 1000);
    return seconds < 60
      ? `${seconds}s`
      : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }

  // Fallback to completion timestamp if available
  if (message.reasoningCompleted) {
    const duration = new Date(message.reasoningCompleted) - new Date(message.timestamp);
    const seconds = Math.round(duration / 1000);
    return seconds < 60
      ? `${seconds}s`
      : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }

  // If neither is available (shouldn't happen), show current time difference
  const thinkingTime = (new Date() - new Date(message.timestamp)) / 1000;
  return thinkingTime < 60
    ? `${Math.round(thinkingTime)}s`
    : `${Math.round(thinkingTime / 60)}m ${Math.round(thinkingTime % 60)}s`;
}

const isAtBottom = ref(true)
const userScrolling = ref(false)
const chatWrapper = ref(null)
const isAutoScrolling = ref(false)
let scrollTimeout = null

const onScroll = () => {
  if (isAutoScrolling.value) return
  userScrolling.value = true
  clearTimeout(scrollTimeout)
  scrollTimeout = setTimeout(() => {
    userScrolling.value = false
  }, 200)
  const { scrollTop, scrollHeight, clientHeight } = chatWrapper.value
  isAtBottom.value = scrollHeight - (scrollTop + clientHeight) < 10
}

const scrollToEnd = (behavior) => {
  isAutoScrolling.value = true
  chatWrapper.value.scrollTo({
    top: chatWrapper.value.scrollHeight,
    behavior,
  })
  setTimeout(() => {
    isAutoScrolling.value = false
  }, 50)
}

defineExpose({ onScroll, scrollToEnd, isAtBottom, userScrolling })

window.copyCode = function (button) {
  const codeEl = button.parentElement.querySelector('pre code')
  const text = codeEl ? codeEl.innerText : button.parentElement.querySelector('pre').innerText
  navigator.clipboard.writeText(text).then(() => {
    button.textContent = 'Copied!'
    setTimeout(() => {
      button.textContent = 'Copy'
    }, 2000)
  }).catch(err => {
    console.error('Failed to copy text: ', err)
  })
}

onMounted(() => {
  scrollToEnd('instant')
})
</script>

<template>
  <div class="chat-wrapper" ref="chatWrapper" @scroll.passive="onScroll">
    <div class="chat-container">
      <div v-for="(message, idx) in currMessages" :key="message.id" class="message" :class="message.role">
        <div class="message-wrapper">
          <!-- Move details above the bubble -->
          <details v-if="message.role === 'assistant' && isChainOfThought(message.content)" class="reasoning-details">
            <summary>
              Reasoning process ({{ getThinkingTime(message) }})
            </summary>
            <div class="reasoning-steps">
              {{ extractReasoningSteps(message.content) }}
            </div>
          </details>

          <transition name="bubble-fade" appear>
            <span class="bubble" :class="{ typing: !message.complete }" :key="message.id">
              <div v-if="message.role == 'user'" :key="message.id + '-user'">{{ message.content }}</div>
              <div class="markdown-content" v-else v-html="safeRender(getSolutionOnly(message.content))"
                :key="message.id + '-assistant-' + triggerRerender">
              </div>
              <span v-if="!message.complete" class="cursor">｜</span>
            </span>
          </transition>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.chat-wrapper {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  margin: 8px 0;
}

.chat-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  max-width: 800px;
  /* Match the main container width */
  margin: 0 auto;
  padding: 16px 16px 16px 16px;
  box-sizing: border-box;
}

.message {
  display: flex;
  width: 100%;
}

.message-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.bubble {
  max-width: 90%;
  padding: 16px;
  border-radius: 24px;
  line-height: 1.5;
  font-size: 1rem;
  position: relative;
}

/* Remove margin-right from user bubble that was causing issues */
.message.user .bubble {
  background: #ec3750;
  color: #ffffff;
  white-space: pre-wrap;
}

::-webkit-scrollbar {
  width: 8px !important;
}

::-webkit-scrollbar-track {
  background: #f7f7f7 !important;
  border-radius: 4px !important;
}

::-webkit-scrollbar-thumb {
  background: #338eda !important;
  border-radius: 4px !important;
}

.chat-header {
  text-align: center;
}

.chat-header h2 {
  font-family: 'Inter', sans-serif;
  font-weight: bold;
  font-size: 1.4rem;
}

.message.user {
  justify-content: flex-end;
}

.message.user .message-wrapper {
  align-items: flex-end;
}

.message.assistant .bubble {
  background: #e0e6ed;
}

.message.assistant .reasoning-details {
  margin-left: 0;
}

.message.user .bubble {
  background: #ec3750;
  color: #ffffff;

  white-space: pre-wrap;
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
    background: #1e1e1e;
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

pre,
code {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

pre {
  background: #1e1e1e;
  border: 1px solid #363636 !important;
  border-radius: 0.375rem;
  padding: 1rem;
  overflow-x: auto;
}

code {
  background: #f3f4f6;
  padding: 0.2em 0.4em;
  border-radius: 0.25em;
  font-size: 0.9em;
}

.code-container {
  position: relative;
  margin: 1em 0;
}

.code-wrapper {
  display: flex;
  align-items: flex-start;
}

.pre-wrapper {
  position: relative;
}

.pre-wrapper pre {
  margin: 0;
  padding: 0rem;
  background: #1e1e1e !important;
  border: 1px solid #555768 !important;
  border-radius: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  transition: background 0.3s ease;
}

.copy-button {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  font-size: 0.8em;
  background: linear-gradient(145deg, #338eda, #2d7bd2);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  z-index: 2;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  transition: transform 0.2s ease, background 0.2s ease;
}

.copy-button:hover {
  background: linear-gradient(145deg, #2563eb, #1f5bb5);
  transform: scale(1.05);
}

.copy-button:focus {
  outline: 2px solid #ffffff;
}

/* Ensure the pre element has enough top padding to avoid overlap */
.code-container pre {
  padding-top: 1em !important;
}

.cursor {
  color: #3b82f6;
  animation: blink 1.2s ease infinite;
  vertical-align: middle;
  line-height: 1;
  display: inline;
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

.reasoning-details {
  width: 100%;
  max-width: 90%;
  margin-bottom: 8px;
  font-size: 0.9em;
  order: -1;
  /* Ensures it stays above the message bubble */
}

.reasoning-details summary {
  cursor: pointer;
  padding: 6px 12px;
  width: 300px;
  background-color: #f0f4f8;
  border-radius: 6px;
  color: #4a5568;
  font-size: 0.85em;
  user-select: none;
  transition: background-color 0.2s ease;
}

.reasoning-details summary:hover {
  background-color: #e2e8f0;
}

.reasoning-steps {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
  margin-top: 4px;
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 0.85em;
  color: #4a5568;
  overflow-x: auto;
  width: 100%;
}

/* Dark mode styles */

.dark .reasoning-details summary {
  background-color: #2d3748;
  color: #e2e8f0;
}

.dark .reasoning-details summary:hover {
  background-color: #2c3440;
}

.dark .reasoning-steps {
  background-color: #1a202c;
  border-color: #2d3748;
  color: #a0aec0;
}

.dark .chat-wrapper::-webkit-scrollbar-track {
  background: #252429 !important;
}

.dark .message.assistant .bubble {
  background: #3c4858 !important;
}

/* Other display sizes styles */

@media (max-width: 768px) {
  .chat-container {
    gap: var(--spacing-8);
    padding: 0 var(--spacing-4);
  }

  .reasoning-details {
    width: 100%;
    font-size: 0.85em;
  }

  .chat-wrapper {
    padding: var(--spacing-4);
    margin: var(--spacing-8) var(--spacing-4);
    border-radius: var(--border-radius);
  }

  .bubble {
    max-width: 88%;
    padding: var(--spacing-12) var(--spacing-12);
    font-size: smaller;
  }
}

.bubble-fade-enter-active,
.bubble-fade-leave-active {
  transition: opacity 0.35s cubic-bezier(.4, 1.6, .6, 1), transform 0.35s cubic-bezier(.4, 1.6, .6, 1);
}

.bubble-fade-enter-from {
  opacity: 0;
  transform: translateY(16px) scale(0.98);
}

.bubble-fade-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>
