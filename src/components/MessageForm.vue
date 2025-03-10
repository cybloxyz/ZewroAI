<script setup>
import { ref, computed } from 'vue';

const props = defineProps(['isLoading']);
const emit = defineEmits(['send-message', 'abort-controller']);
const inputMessage = ref('');

// A computed that trims the input.
// This is required so that the app
// detects typing on mobile phones.
const trimmedMessage = computed(() => inputMessage.value.trim())

const submitMessage = () => {
  emit('send-message', inputMessage.value);
  inputMessage.value = '';
};

const handleEnterKey = () => {
  if (window.innerWidth < 768) {
    // On mobile, add a newline instead of submitting.
    inputMessage.value += "\n";
  } else {
    submitMessage();
  }
};

</script>

<template>
  <form class="message-form" @submit.prevent="submitMessage">

    <textarea ref="textarea" id="text-input" v-model="inputMessage" placeholder="Type your message..."
      :disabled="props.isLoading" @keydown.enter.prevent="handleEnterKey"
      @keydown.ctrl.enter.exact.prevent="inputMessage += '\n'"></textarea>

    <button type="submit" @click="props.isLoading ? $emit('abort-controller') : submitMessage"
      :disabled="!trimmedMessage && !props.isLoading">

      <!-- <svg v-if="!props.isLoading" target="../assets/send.svg" fill="currentColor" stroke="currentColor"></svg> -->
      <img v-if="!props.isLoading" src="../assets/send.svg" style="" width="40px" height="40px">

      <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 18L18 6M6 6l12 12" />
      </svg>

    </button>

  </form>
  <p class="disclaimer" id="disclaimer">
    AI-generated content should always be fact-checked.
  </p>
</template>

<style scoped>
.message-form {
  position: relative;
  bottom: var(--spacing-16);
  background: #e0e6ed;
  padding: var(--spacing-16);
  display: flex;
  gap: var(--spacing-12);
  justify-content: center;
  border-radius: calc(var(--border-radius) + var(--spacing-16));
  max-width: 800px;
  width: 100%;
  margin: 16px auto 0;
  z-index: 10;
}

.message-form textarea {
  resize: none;
  min-height: 44px;
  height: 54px;
  max-height: 100px;
  line-height: 1.5;
  flex: 1;
  padding: 14px;
  border-radius: var(--border-radius);
  border: 2px solid #8492a6;
  background: #273444;
  color: #ececf1;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.message-form textarea::-webkit-scrollbar {
  display: none;
}

.message-form textarea:focus {
  border-color: #338eda;
  height: 88px;
  outline: none;
}

.message-form button {
  padding: 0;
  border-radius: var(--border-radius);
  background: #ec3750;
  color: white;
  border: none;
  display: grid;
  place-items: center;
  transition: all 0.3s ease-out;
  min-width: 44px;
  width: 54px;
  height: 54px;
}

.message-form button:disabled {
  background: #273444;
  border: 2px solid #8492a6;
  cursor: not-allowed;
}

.message-form button:not(:disabled):hover {
  background: #dd3744;
  box-shadow: 0 0 12px rgba(240, 100, 100, 0.8);
}

.message-form button svg {
  color: currentColor;
}

/* Dark mode styles */

.dark .message-form {
  background-color: #1f2d3d;
}

.dark .message-form textarea {
  background-color: #17171d;
}

.dark .message-form button:disabled {
  background-color: #17171d;
}

/* Other resolutions styles */

@media (max-width: 768px) {
  .message-form {
    padding: var(--spacing-4);
    background-color: transparent;
    border: none;
    box-shadow: none;
  }

  .dark .message-form {
    background-color: transparent;
  }

  .message-form button {
    width: 44px;
    height: 44px;
  }

  .message-form textarea {
    height: 44px;
    padding: 8px;
  }
}
</style>
