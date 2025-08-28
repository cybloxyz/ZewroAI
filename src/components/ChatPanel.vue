<script setup>
import { onMounted, ref, watch, nextTick, computed, reactive } from "vue";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import MarkdownIt from "markdown-it";
import markdownItFootnote from "markdown-it-footnote";
import markdownItTaskLists from "markdown-it-task-lists";
import WelcomeOverlay from "./WelcomeOverlay.vue";
// Replace Element Plus icons with Phosphor Icons
import { PhDownloadSimple, PhCopy, PhSun } from "@phosphor-icons/vue";

const props = defineProps([
  "currConvo",
  "currMessages",
  "isLoading",
  "conversationTitle",
  "showWelcome",
]);
const emit = defineEmits(["send-message", "set-message"]);

const shouldShowWelcome = computed(() => {
  return (
    props.showWelcome &&
    (!props.currMessages || props.currMessages.length === 0)
  );
});

const langExtMap = {
  python: "py",
  javascript: "js",
  typescript: "ts",
  html: "html",
  css: "css",
  vue: "vue",
  json: "json",
  markdown: "md",
  shell: "sh",
  bash: "sh",
  java: "java",
  c: "c",
  cpp: "cpp",
  csharp: "cs",
  go: "go",
  rust: "rs",
  ruby: "rb",
  php: "php",
  sql: "sql",
  xml: "xml",
  yaml: "yml",
};

// --- 2. Code Block Redesign: Use markdown-it's fence rule for full control ---
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
})
  .use(markdownItFootnote)
  .use(markdownItTaskLists, { enabled: true, label: true, bulletMarker: "-" });

// Store original rule to fall back to
const defaultFence =
  md.renderer.rules.fence ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

// Override the fence rule to inject custom wrapper and header
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const code = token.content.trim();
  const lang = token.info ? token.info.split(/(\s+)/g)[0] : "text";
  const langDisplay = lang || "text";

  let highlightedCode;
  if (lang && hljs.getLanguage(lang)) {
    try {
      highlightedCode = hljs.highlight(code, {
        language: lang,
        ignoreIllegals: true,
      }).value;
    } catch (__) {
      highlightedCode = md.utils.escapeHtml(code);
    }
  } else {
    highlightedCode = md.utils.escapeHtml(code);
  }

  // This structure prevents markdown-it from adding extra <p> tags and gives us full control.
  return `
  <div class="code-block-wrapper">
    <div class="code-block-header">
      <span class="code-language">${langDisplay}</span>
      <div class="code-actions">
        <button class="code-action-button" onclick="downloadCode(event.currentTarget, '${langDisplay}')" title="Download file">
          <PhDownloadSimple />
          <span>Download</span>
        </button>
        <button class="code-action-button" onclick="copyCode(event.currentTarget)" title="Copy code">
          <PhCopy />
          <span>Copy</span>
        </button>
      </div>
    </div>
  <pre><code class="hljs ${lang}">${highlightedCode}</code></pre>
</div>`;
};

const liveReasoningTimers = reactive({});
const timerIntervals = {};

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const isAtBottom = ref(true);
const chatWrapper = ref(null);
// Add timestamps and debug markers to messages for visualization
const messages = computed(() => {
  if (!props.currMessages) return [];

  return props.currMessages.map((msg) => {
    const isNew = !msg.timestamp || Date.now() - msg.timestamp < 5000;

    return { ...msg, isNew };
  });
});

const scrollToEnd = (behavior = "smooth") => {
  if (!chatWrapper.value) return;
  chatWrapper.value.scrollTo({
    top: chatWrapper.value.scrollHeight,
    behavior,
  });
};

const handleScroll = () => {
  if (!chatWrapper.value) return;
  isAtBottom.value =
    Math.abs(
      chatWrapper.value.scrollHeight -
      chatWrapper.value.scrollTop -
      chatWrapper.value.clientHeight,
    ) < 10;
};

// Watch for changes in the messages array
watch(
  messages,
  (newMessages) => {
    if (isAtBottom.value) {
      nextTick(() => scrollToEnd("smooth"));
    }

    // Process each message
    newMessages.forEach((msg) => {
      // Clear any existing timer for this message to prevent duplicates
      if (timerIntervals[msg.id]) {
        clearInterval(timerIntervals[msg.id]);
        delete timerIntervals[msg.id];
      }

      // Handle assistant messages with reasoning
      if (msg.role === "assistant" && msg.reasoning) {
        // For completed messages, show the final duration
        if (msg.complete) {
          // If we already have a calculated duration, use it
          if (msg.reasoningDuration) {
            liveReasoningTimers[msg.id] =
              `Thought for ${formatDuration(msg.reasoningDuration)}`;
          }
          // If we have start and end times, calculate the duration
          else if (msg.reasoningStartTime && msg.reasoningEndTime) {
            const duration =
              msg.reasoningEndTime.getTime() - msg.reasoningStartTime.getTime();
            liveReasoningTimers[msg.id] =
              `Thought for ${formatDuration(duration)}`;
          }
          // If we only have a start time, but the message is complete,
          // it means the message was completed before we could set the end time
          else if (msg.reasoningStartTime) {
            // This shouldn't happen in normal operation, but let's handle it
            liveReasoningTimers[msg.id] = "Thought for a moment";
          }
          return;
        }

        // For incomplete messages that are still thinking
        // Only start a timer if one doesn't already exist
        if (!timerIntervals[msg.id]) {
          const startTime = msg.reasoningStartTime || new Date();
          timerIntervals[msg.id] = setInterval(() => {
            const elapsed = new Date().getTime() - startTime.getTime();
            liveReasoningTimers[msg.id] =
              `Thinking for ${formatDuration(elapsed)}...`;
          }, 100);
        }
      }
    });

    // Clean up timers for messages that no longer exist
    const currentMessageIds = newMessages.map((msg) => msg.id);
    Object.keys(timerIntervals).forEach((timerId) => {
      if (!currentMessageIds.includes(timerId)) {
        clearInterval(timerIntervals[timerId]);
        delete timerIntervals[timerId];
        delete liveReasoningTimers[timerId];
      }
    });
  },
  { deep: true, immediate: true },
);

watch(
  () => props.currConvo,
  (newConvo, oldConvo) => {
    if (newConvo && newConvo !== oldConvo) {
      // When conversation changes, scroll to bottom after next tick
      nextTick(() => {
        requestAnimationFrame(() => {
          scrollToEnd("instant");
        });
      });
    }
  }
);

onMounted(() => {
  nextTick(() => scrollToEnd("instant"));
});

function copyCode(button) {
  const codeEl = button
    .closest(".code-block-wrapper")
    .querySelector("pre code");
  const text = codeEl.innerText;
  navigator.clipboard.writeText(text).then(() => {
    const textEl = button.querySelector("span");
    textEl.textContent = "Copied!";
    button.classList.add("copied");
    setTimeout(() => {
      textEl.textContent = "Copy";
      button.classList.remove("copied");
    }, 2000);
  });
};

function downloadCode(button, lang) {
  const codeEl = button
    .closest(".code-block-wrapper")
    .querySelector("pre code");
  const code = codeEl.innerText;
  const extension = langExtMap[lang.toLowerCase()] || "txt";
  const filename = `code-${Date.now()}.${extension}`;
  const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

defineExpose({ scrollToEnd, isAtBottom });
</script>

<template>
  <div class="chat-wrapper" ref="chatWrapper" @scroll="handleScroll">
    <div class="chat-container">
      <WelcomeOverlay v-if="shouldShowWelcome" @setMessage="(msg) => emit('set-message', msg)" />
      <div class="messages-layer">
        <template v-for="message in messages" :key="message.id">
          <div class="message" :class="message.role">
            <div class="message-content">
              <!-- 1. Redesigned Reasoning Display -->
              <details v-if="message.role === 'assistant' && message.reasoning" class="reasoning-details" open>
                <summary class="reasoning-summary">
                  <span class="reasoning-toggle-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256">
                      <path fill="currentColor"
                        d="m181.66 133.66l-80 80a8 8 0 0 1-11.32-11.32L164.69 128L90.34 53.66a8 8 0 0 1 11.32-11.32l80 80a8 8 0 0 1 0 11.32Z" />
                    </svg>
                  </span>
                  <span class="reasoning-text">
                    <span v-if="liveReasoningTimers[message.id]">{{
                      liveReasoningTimers[message.id]
                      }}</span>
                    <span v-else-if="message.reasoningDuration > 0">Thought for
                      {{ formatDuration(message.reasoningDuration) }}</span>
                    <span v-else-if="
                      message.reasoningStartTime && message.reasoningEndTime
                    ">Thought for a moment</span>
                    <span v-else-if="message.reasoning && message.complete">Thought for a moment</span>
                    <span v-else>Reasoning</span>
                  </span>
                </summary>
                <div class="reasoning-content-wrapper">
                  <div class="reasoning-content markdown-content" v-html="md.render(message.reasoning)"></div>
                </div>
              </details>

              <span class="bubble">
                <div v-if="message.role == 'user'">{{ message.content }}</div>
                <div class="markdown-content" v-else v-html="md.render(message.content)"></div>
                <span v-if="!message.complete && !message.reasoning" class="cursor">|</span>
              </span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style>
/* Define CSS variables for this component */
.chat-wrapper {
  /* Bubble colors */
  --bubble-user-bg: var(--primary);
  --bubble-user-text: var(--primary-foreground);

  /* Text colors for light mode */
  --text-primary-light: var(--text-primary);
  --text-secondary-light: var(--text-secondary);

  /* Text colors for dark mode */
  --text-primary-dark: var(--text-primary);
  --text-secondary-dark: var(--text-secondary);

  /* Reasoning border colors */
  --reasoning-border-light: var(--border);
  --reasoning-border-dark: var(--border);

  /* Code block colors */
  --code-bg: #0d1117;
  --code-header-bg: #161b22;
  --code-border: #30363d;
  --code-text: #c9d1d9;
  --code-action-text: #8b949e;
  --code-action-hover-bg: rgba(173, 186, 199, 0.1);
  --code-action-hover-text: #c9d1d9;

  /* Base layout */
  flex: 1;
  overflow-y: auto;
  position: relative;
  padding-bottom: 120px;
  /* Add padding for fixed message form */
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  scrollbar-gutter: stable both-edges;
}

.chat-container {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 12px;
  box-sizing: border-box;
  position: relative;
  transition: all 0.3s cubic-bezier(.4, 1, .6, 1);
}

.message {
  display: flex;
  width: 100%;
  max-width: 800px;
  margin: 1.5rem auto;
  position: relative;
  transition: all 0.3s cubic-bezier(.4, 1, .6, 1);
}

.message.user {
  justify-content: flex-end;
}

.message-content {
  max-width: 100%;
  display: flex;
  flex-direction: column;
  width: 100%;
  transition: all 0.3s cubic-bezier(.4, 1, .6, 1);
}

.message.user .message-content {
  align-items: flex-end;
  max-width: 85%;
}

.bubble {
  padding: 12px 16px;
  border-radius: 18px;
  line-height: 1.5;
  font-size: 1rem;
  width: 100%;
  transition: all 0.3s cubic-bezier(.4, 1, .6, 1);
}

.message.user .bubble {
  background: var(--bubble-user-bg);
  color: var(--bubble-user-text);
  white-space: pre-wrap;
  border-bottom-right-radius: 4px;
  margin-left: auto;
  max-width: calc(800px * 0.85);
  width: fit-content;
  transition: all 0.3s cubic-bezier(.4, 1, .6, 1);
}

.message.assistant .bubble {
  padding: 0;
  color: var(--text-primary-light);
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  transition: all 0.3s cubic-bezier(.4, 1, .6, 1);
}

.dark .message.assistant .bubble {
  color: var(--text-primary-dark);
}

/* --- 1. Reasoning Display Styling --- */
.reasoning-details {
  background: none;
  border: none;
  padding: 0;
  margin-bottom: 0.75rem;
  order: -1;
  width: 100%;
  max-width: 800px;
  margin: 0 auto 0.75rem auto;
  transition: all 0.3s cubic-bezier(.4, 1, .6, 1);
}

.reasoning-summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary-light);
  font-size: 0.9em;
  font-weight: 500;
  margin-bottom: 0.5rem;
  user-select: none;
}

.dark .reasoning-summary {
  color: var(--text-secondary-dark);
}

.reasoning-summary::-webkit-details-marker {
  display: none;
}

.reasoning-toggle-icon {
  transition: transform 0.2s ease-in-out;
  display: flex;
  align-items: center;
  transform: rotate(0deg);
}

.reasoning-details[open] .reasoning-toggle-icon {
  transform: rotate(90deg);
}

.reasoning-content-wrapper {
  padding-left: 1.25rem;
  border-left: 2px solid var(--reasoning-border-light);
}

.dark .reasoning-content-wrapper {
  border-left-color: var(--reasoning-border-dark);
}

.reasoning-content {
  color: var(--text-secondary-light);
}

.dark .reasoning-content {
  color: var(--text-secondary-dark);
}

.reasoning-details:not([open]) .reasoning-content-wrapper {
  display: none;
}

/* --- 2. Code Block Styling --- */
.markdown-content .code-block-wrapper {
  background-color: var(--code-bg);
  border: 1px solid var(--code-border);
  border-radius: 8px;
  margin: 1em 0;
  overflow: hidden;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
  box-sizing: border-box;
  transition: all 0.3s cubic-bezier(.4, 1, .6, 1);
}

.code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--code-header-bg);
  padding: 8px 8px 8px 16px;
  border-bottom: 1px solid var(--code-border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.code-language {
  font-family: monospace;
  font-size: 0.85em;
  color: var(--code-action-text);
  text-transform: lowercase;
}

.code-actions {
  display: flex;
  gap: 4px;
}

.code-action-button {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--code-action-text);
  padding: 4px 8px;
  font-size: 0.8em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.code-action-button:hover {
  background-color: var(--code-action-hover-bg);
  color: var(--code-action-hover-text);
}

.code-action-button.copied {
  color: #3fb950;
}

.code-action-button svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.code-block-wrapper pre {
  margin: 0;
  padding: 0;
  overflow-x: auto;
  /* Horizontal scroll only */
}

.code-block-wrapper pre code.hljs {
  display: block;
  padding: 16px;
  background: transparent;
  color: var(--code-text);
  font-size: 0.9em;
  line-height: 1.6;
}

/* Generic Markdown Content Styling */
.markdown-content {
  color: var(--text-primary-light);
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  box-sizing: border-box;
  transition: all 0.3s cubic-bezier(.4, 1, .6, 1);
}

.dark .markdown-content {
  color: var(--text-primary-dark);
}

.markdown-content>*:first-child {
  margin-top: 0;
}

.markdown-content>*:last-child {
  margin-bottom: 0;
}

.markdown-content h1,
.markdown-content h2,
.markdown-content h3 {
  border-bottom: 1px solid var(--reasoning-border-light);
  padding-bottom: 0.3em;
  margin-top: 1.5em;
  margin-bottom: 1em;
}

.dark .markdown-content h1,
.dark .markdown-content h2,
.dark .markdown-content h3 {
  border-bottom-color: var(--reasoning-border-dark);
}

.markdown-content p {
  margin: 1em 0;
}

.markdown-content ul,
.markdown-content ol {
  margin: 1em 0;
  padding-left: 2em;
}

.markdown-content blockquote {
  border-left: 4px solid var(--reasoning-border-dark);
  margin: 1.5em 0;
  padding: 0.5em 1.2em;
  background: var(--code-header-bg);
  color: var(--code-action-text);
  border-radius: 4px;
}

.markdown-content code:not(.hljs) {
  background-color: var(--code-header-bg);
  color: var(--code-text);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.85em;
}

.cursor {
  display: inline-block;
  animation: blink 1s step-end infinite;
  color: var(--text-primary-light);
}

.dark .cursor {
  color: var(--text-primary-dark);
}

@keyframes blink {

  from,
  to {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
}
</style>
