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
      :disabled="props.isLoading" @keydown.enter.exact.prevent="handleEnterKey"></textarea>

    <button type="submit" @click="props.isLoading ? $emit('abort-controller') : submitMessage"
      :disabled="!trimmedMessage && !props.isLoading">

      <!-- <svg v-if="!props.isLoading" target="../assets/send.svg" fill="currentColor" stroke="currentColor"></svg> -->
      <svg v-if="!props.isLoading" xmlns="http://www.w3.org/2000/svg" stroke-width="0.5" width="40" height="40"
        viewBox="0 0 32 32">
        <path
          d="M16.044,15.012c-0.005,-0.104 -0.071,-0.205 -0.198,-0.232l-7.45,-1.579c-0.231,-0.049 -0.396,-0.253 -0.396,-0.489l0,-5.712c0,-0.73 0.698,-1.159 1.419,-0.908c4.295,1.497 12.081,5.408 15.616,8.025c0.34,0.252 0.515,0.573 0.52,0.895c-0.005,0.323 -0.18,0.644 -0.52,0.896c-3.535,2.617 -11.321,6.868 -15.616,8.365c-0.721,0.251 -1.419,-0.178 -1.419,-0.908l0,-6.052c0,-0.236 0.165,-0.44 0.396,-0.489l7.45,-1.579c0.127,-0.027 0.193,-0.129 0.198,-0.233Z"
          stroke="currentColor" fill="currentColor" />
      </svg>

      <img v-else src="../assets/close.svg" alt="cancel" width="48px" height="48px" />
    </button>

  </form>
  <p class="disclaimer" id="disclaimer">
    AI-generated content should always be fact-checked.
  </p>
</template>

<style scoped>
#disclaimer {
  letter-spacing: 1px;
  word-spacing: 2px;
  margin-bottom: 2px;
  margin-top: -12px;
}

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
  background: #ffffff;
  font-size: 1rem;
  transition: all 0.2s ease;
  overflow: hidden;
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
  color: #1f2d3d;
  border: none;
  display: grid;
  place-items: center;
  transition: all 0.3s ease-out;
  min-width: 44px;
  width: 54px;
  height: 54px;
}

.message-form button:disabled {
  background: #ffffff;
  border: 2px solid #8492a6;
  cursor: not-allowed;
}

.message-form button:not(:disabled) {
  color: #fff;
}

.message-form button:not(:disabled):hover {
  background: #dd3744;
  color: #e0e6ed;
  box-shadow: 0 0 12px rgba(240, 100, 100, 0.8);
}

/* Dark mode styles */

.dark .message-form {
  background-color: #1f2d3d;
}

.dark .message-form textarea {
  background-color: #17171d;
  color: #e0e0e0;
}

.dark .message-form button:disabled {
  background-color: #17171d;
  color: #e0e0e0;
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
