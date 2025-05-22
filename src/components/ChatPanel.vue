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
            <summary class="reasoning-summary">
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
  scrollbar-width: thin;
  /* For Firefox */
  -ms-overflow-style: none;
  /* For IE and Edge */
}

/* Hide scrollbar for Chrome/Safari/Opera */
.chat-wrapper::-webkit-scrollbar {
  display: none;
}

.chat-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  /* Adjusted gap */
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
  padding: 14px 18px;
  /* Adjusted padding */
  border-radius: 20px;
  /* Adjusted border-radius */
  line-height: 1.6;
  /* Adjusted line height */
  font-size: 1rem;
  position: relative;
  word-break: break-word;
  /* Ensure long words break */
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
  color: #1a202c;
  /* Added text color for light mode */
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
  /* Added padding to prevent content touching bubble edge */
  padding: 0;

  h1:first-child,
  h2:first-child,
  h3:first-child,
  h4:first-child,
  h5:first-child,
  h6:first-child {
    margin-top: 0.5em;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 1.5em 0 0.8em;
    /* Adjusted heading margins */
    font-weight: 600;
    line-height: 1.3;
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

  p {
    margin: 0.8em 0;
    /* Added margin for paragraphs */
  }

  ul,
  ol {
    margin: 1em 0;
    /* Added margin for lists */
    padding-left: 1.5em;
    /* Added padding for list bullets/numbers */
  }

  li {
    margin-bottom: 0.5em;
    /* Added margin between list items */
  }

  strong {
    font-weight: 700;
  }

  em {
    font-style: italic;
  }

  blockquote {
    border-left: 4px solid #3b82f6;
    margin: 1.2em 0;
    /* Adjusted margin */
    padding: 0.8em 1.2em;
    /* Adjusted padding */
    background: #f0f4f8;
    /* Light mode background */
    border-radius: 4px;
    color: #4a5568;
    /* Light mode text color */
  }

  hr {
    border: none;
    border-top: 1px solid #d1d5db;
    /* Light mode border color */
    margin: 2em 0;
    /* Adjusted margin */
  }

  a {
    color: #3b82f6;
    /* Link color */
    text-decoration: underline;
  }

  .footnote-ref {
    font-size: 0.8em;
    vertical-align: super;
    margin-left: 2px;
  }

  .footnotes {
    border-top: 1px solid #d1d5db;
    /* Light mode border color */
    margin-top: 2em;
    padding-top: 1em;
    font-size: 0.9em;
    color: #6b7280;
    /* Light mode text color */
  }

  .footnotes ol {
    padding-left: 1.5em;
  }

  .footnotes li {
    margin: 0.5em 0;
  }

  table {
    border-collapse: collapse;
    margin: 1.5em 0;
    /* Adjusted margin */
    width: 100%;
    background: #ffffff;
    /* Light mode background */
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    /* Added subtle shadow */

    th,
    td {
      padding: 0.8em 1em;
      /* Adjusted padding */
      border: 1px solid #e5e7eb;
      /* Light mode border color */
    }

    th {
      background: #eff6ff;
      /* Light mode header background */
      color: #1e40af;
      /* Light mode header text color */
      font-weight: 600;
      text-align: left;
    }

    tr:nth-child(even) {
      background-color: #f9fafb;
      /* Zebra striping */
    }
  }


  code:not(.hljs) {
    background: #f3f4f6;
    /* Light mode background */
    padding: 0.2em 0.4em;
    border-radius: 4px;
    color: #b91c1c;
    /* Light mode text color */
    font-size: 0.9em;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  }

  pre {
    /* Removed direct pre styles here, handled by .code-container .pre-wrapper pre */
    margin: 1.5em 0;
    /* Keep margin for pre outside .code-container */

    code {
      padding: 0 !important;
      color: #d4d4d4 !important;
      background: none !important;
    }
  }
}

.hljs {
  /* Styles moved/refined within .code-container .pre-wrapper pre */
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.875em;
}

pre,
code {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

/* Removed redundant pre/code styles */


.code-container {
  position: relative;
  margin: 1.5em 0;
  /* Adjusted margin */
  border-radius: 8px;
  /* Match pre border-radius */
  overflow: hidden;
  /* Ensure border-radius clips content */
}

.code-wrapper {
  display: flex;
  align-items: flex-start;
}

.pre-wrapper {
  position: relative;
  width: 100%;
  /* Ensure pre-wrapper takes full width */
}

.pre-wrapper pre {
  margin: 0;
  padding: 1.5rem 1rem 1rem 1rem !important;
  /* Adjusted padding to make space for button */
  background: #1e1e1e !important;
  /* Dark background for code */
  border: 1px solid #363636 !important;
  /* Subtle border */
  border-radius: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  color: #d4d4d4 !important;
  /* Code text color */
  font-size: 0.875em;
  line-height: 1.5;
}

.copy-button {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  font-size: 0.8em;
  background: rgba(255, 255, 255, 0.1);
  /* Semi-transparent background */
  color: rgba(255, 255, 255, 0.8);
  /* Semi-transparent text */
  border: none;
  border-radius: 4px;
  cursor: pointer;
  z-index: 2;
  transition: background 0.2s ease, color 0.2s ease;
}

.copy-button:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.copy-button:active {
  background: rgba(255, 255, 255, 0.3);
}

.copy-button:focus {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
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

.katex {
  font-size: 1.1em !important;
  padding: 0.5em 0;
  overflow-x: auto;
}

.katex-display {
  margin: 1em 0 !important;
}


.reasoning-details {
  width: 100%;
  max-width: 90%;
  margin-bottom: 12px;
  /* Adjusted margin */
  font-size: 0.9em;
  order: -1;
  /* Ensures it stays above the message bubble */
}

.reasoning-summary {
  cursor: pointer;
  padding: 6px 12px;
  width: fit-content;
  /* Make summary width fit content */
  background-color: #e2e8f0;
  /* Light mode background */
  border-radius: 16px;
  /* More rounded */
  color: #4a5568;
  /* Light mode text color */
  font-size: 0.85em;
  user-select: none;
  transition: background-color 0.2s ease, color 0.2s ease;
  display: inline-block;
  /* Allow padding and margin */
  margin-bottom: 4px;
  /* Space between summary and steps */
}

.reasoning-summary:hover {
  background-color: #cbd5e0;
  /* Darker hover */
}

.reasoning-steps {
  background-color: #f8fafc;
  /* Light mode background */
  border: 1px solid #e2e8f0;
  /* Light mode border */
  border-radius: 6px;
  padding: 12px;
  margin-top: 0;
  /* Removed top margin */
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 0.85em;
  color: #4a5568;
  /* Light mode text color */
  overflow-x: auto;
  width: 100%;
  box-sizing: border-box;
  /* Include padding and border in width */
}

/* Dark mode styles */

.dark .chat-wrapper::-webkit-scrollbar-track {
  background: #252429 !important;
}

.dark .message.assistant .bubble {
  background: #3c4858 !important;
  color: #e2e8f0;
  /* Dark mode text color */
}

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

.dark .markdown-content {
  blockquote {
    background: #2d3748;
    /* Dark mode background */
    color: #a0aec0;
    /* Dark mode text color */
    border-left-color: #4299e1;
    /* Dark mode border color */
  }

  hr {
    border-top-color: #4a5568;
    /* Dark mode border color */
  }

  a {
    color: #63b3ed;
    /* Dark mode link color */
  }

  .footnotes {
    border-top-color: #4a5568;
    /* Dark mode border color */
    color: #a0aec0;
    /* Dark mode text color */
  }

  table {
    background: #1a202c;
    /* Dark mode background */
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    /* Darker shadow */

    th,
    td {
      border-color: #2d3748;
      /* Dark mode border color */
    }

    th {
      background: #2b6cb0;
      /* Dark mode header background */
      color: #e2e8f0;
      /* Dark mode header text color */
    }

    tr:nth-child(even) {
      background-color: #2d3748;
      /* Dark mode zebra striping */
    }
  }

  code:not(.hljs) {
    background: #2d3748;
    /* Dark mode background */
    color: #fbd38d;
    /* Dark mode text color */
  }

  /* HLJS styles are already dark mode compatible */
}


/* Other display sizes styles */

@media (max-width: 768px) {
  .chat-container {
    gap: 16px;
    /* Adjusted gap */
    padding: 12px 8px;
  }

  .bubble {
    max-width: 95%;
    /* Increased max-width on mobile */
    padding: 12px 16px;
    /* Adjusted padding */
    font-size: 0.95rem;
    line-height: 1.4;
  }

  .message {
    margin-bottom: 0;
    /* Rely on gap */
  }

  .reasoning-details {
    width: 100%;
    max-width: 95%;
    /* Match bubble max-width */
    font-size: 0.85em;
    margin-bottom: 8px;
    /* Adjusted margin */
  }

  .reasoning-summary {
    width: auto;
    padding: 4px 10px;
    /* Adjusted padding */
    font-size: 0.8em;
  }

  .reasoning-steps {
    padding: 10px;
    /* Adjusted padding */
  }

  /* Adjust heading sizes for mobile */
  .markdown-content {
    h1 {
      font-size: 1.5em;
      /* Slightly smaller */
    }

    h2 {
      font-size: 1.4em;
    }

    h3 {
      font-size: 1.3em;
    }

    h4 {
      font-size: 1.2em;
    }

    pre {
      padding: 1rem 0.75rem 0.75rem 0.75rem !important;
      /* Adjusted padding */
      font-size: 0.85em;
    }

    code:not(.hljs) {
      font-size: 0.85em;
    }

    table {
      font-size: 0.9em;

      /* Smaller table text */
      th,
      td {
        padding: 0.6em 0.8em;
        /* Smaller table padding */
      }
    }
  }

  .copy-button {
    top: 6px;
    /* Adjusted position */
    right: 6px;
    /* Adjusted position */
    padding: 3px 6px;
    /* Smaller padding */
    font-size: 0.75em;
    /* Smaller font */
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
