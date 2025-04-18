<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  isLoading: Boolean,
  autoReasoningMode: { type: Boolean, default: true }
});
const emit = defineEmits(['send-message', 'abort-controller']);

const inputMessage = ref('');
const reasoningOn = ref(false);
const trimmedMessage = computed(() => inputMessage.value.trim()); // Used to check if the input is empty

function submitMessage() {
  // Sends the message and the reasoning state to the parent component
  emit('send-message', inputMessage.value, reasoningOn.value ? true : null);
  inputMessage.value = ''; // Clear input text after sending
}

function handleClick() {
  if (props.isLoading) {
    emit('abort-controller');
  } else {
    submitMessage();
  }
}

function handleEnterKey() {
  if (window.innerWidth < 768) {
    /*
    # On mobile, there isn't any other way to make a new line, therefore
    # we replace the enter key with a new line.
    */
    inputMessage.value += '\n';
  } else {
    submitMessage();
  }
}
</script>

<template>
  <div class="input-section">
    <div class="input-container">
      <!-- Reasoning Toggle -->
      <button type="button" class="reasoning-btn" :class="{ active: reasoningOn }" @click="reasoningOn = !reasoningOn"
        :aria-pressed="reasoningOn.toString()" aria-label="Toggle reasoning">
        <svg class="reasoning-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M9 21h6v-2H9v2zm3-19a7 7 0 00-7 7c0 3.866 3.134 7 7 7s7-3.134 7-7a7 7 0 00-7-7zm-1 13h2v2h-2v-2zm1-11a5 5 0 00-5 5h10a5 5 0 00-5-5z" />
          <path
            d="M12 2C8.13 2 5 5.13 5 9c0 2.69 1.42 5.06 3.54 6.36L9 18h6l.46-2.64A6.978 6.978 0 0019 9c0-3.87-3.13-7-7-7zm0 2c2.76 0 5 2.24 5 5a5.002 5.002 0 01-4.44 4.95l-.56.03-.56-.03A5.002 5.002 0 017 9c0-2.76 2.24-5 5-5z" />
        </svg>
        <span>Reasoning</span>
      </button>

      <!-- Message Input and Send/Stop Button -->
      <div class="input-area-wrapper">
        <textarea v-model="inputMessage" :disabled="isLoading" @keydown.enter.exact.prevent="handleEnterKey"
          placeholder="Type your message..." class="chat-textarea"></textarea>
        <button type="submit" class="send-btn" :disabled="!trimmedMessage && !isLoading" @click="handleClick"
          :aria-label="isLoading ? 'Stop generation' : 'Send message'">
          <!-- Send icon -->
          <svg v-if="!isLoading" class="icon-send" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 2L11 13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          <!-- Stop icon -->
          <svg v-else class="icon-stop" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"
            stroke-linecap="round" stroke-linejoin="round">
            <rect x="7" y="7" width="10" height="10" rx="2" />
          </svg>
        </button>
      </div>
    </div>
    <!-- Disclaimer -->
    <p class="disclaimer">AI-generated content may be inaccurate. Please verify facts.</p>
  </div>
</template>

<style scoped>
.input-section {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  max-width: 800px;
  width: 800px;
  margin: 0px auto;
  padding: 0 16px;
}

.input-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reasoning-btn {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  font-size: 1rem;
  font-weight: 600;
  background: var(--reason-bg);
  color: var(--reason-text);
  border: 2px solid var(--reason-border);
  border-radius: 32px;
  cursor: pointer;
  transition: background 0.3s ease, transform 0.2s ease, border-color 0.3s ease;
}

.reasoning-btn .reasoning-icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.reasoning-btn:hover {
  transform: translateY(-2px);
}

.reasoning-btn.active {
  background: var(--reason-active-bg);
  border-color: var(--reason-active-border);
  color: var(--reason-active-text);
}

.input-area-wrapper {
  display: flex;
  align-items: center;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 36px;
  padding: 10px 14px;
  box-shadow: var(--input-shadow);
  transition: box-shadow 0.3s ease, background 0.3s ease;
}

.input-area-wrapper:focus-within {
  background: var(--input-focus-bg);
  box-shadow: var(--input-focus-shadow);
}

.chat-textarea {
  flex: 1;
  min-height: 48px;
  max-height: 160px;
  resize: none;
  background: transparent;
  border: none;
  padding: 12px;
  font-size: 1rem;
  line-height: 1.4;
  color: var(--textarea-text);
  transition: min-height 0.3s ease;
}

.chat-textarea::placeholder {
  color: var(--textarea-placeholder);
}

.chat-textarea:focus {
  outline: none;
  min-height: 96px;
}

.send-btn {
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  margin-left: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--send-bg);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.3s ease, transform 0.2s ease;
}

.send-btn:disabled {
  background: var(--send-disabled);
  cursor: not-allowed;
  transform: none;
}

.send-btn:not(:disabled):hover {
  background: var(--send-hover);
  transform: scale(1.1);
}

.icon-send {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.icon-stop {
  width: 24px;
  height: 24px;
  fill: currentColor;
}

.disclaimer {
  margin: 8px 0 8px;
  font-size: 0.8rem;
  color: var(--disclaimer-text);
  text-align: center;
}

/* Light Mode */
.input-section {
  --reason-bg: #f5f5f5;
  --reason-text: #333333;
  --reason-border: #bbbbbb;
  --reason-active-bg: #ec3750;
  --reason-active-border: #ec3750;
  --reason-active-text: #ffffff;
  --input-bg: #f2f2f7;
  --input-border: #dddddd;
  --input-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  --input-focus-bg: #ffffff;
  --input-focus-shadow: 0 0 0 3px rgba(60, 125, 255, 0.2);
  --textarea-text: #333333;
  --textarea-placeholder: #888888;
  --send-bg: #3c7dff;
  --send-hover: #335fc4;
  --send-disabled: #cccccc;
  --disclaimer-text: #555555;
}

/* Dark Mode */
.dark .input-section {
  --reason-bg: #2a2e3d;
  --reason-text: #e0e6ed;
  --reason-border: #4a4e5c;
  --reason-active-bg: #ec3750;
  --reason-active-border: #ec3750;
  --reason-active-text: #ffffff;
  --input-bg: #1e2230;
  --input-border: transparent;
  --input-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  --input-focus-bg: #272b3b;
  --input-focus-shadow: 0 0 0 3px rgba(60, 125, 255, 0.3);
  --textarea-text: #e0e6ed;
  --textarea-placeholder: #888888;
  --send-bg: #3c7dff;
  --send-hover: #2d63d0;
  --send-disabled: #555555;
  --disclaimer-text: #999999;
}
</style>
