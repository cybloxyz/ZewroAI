<script setup>
import { ref } from "vue";

const emit = defineEmits(["setMessage"]);

const suggestedPrompts = ref([
  "Tell me about quantum computing",
  "Help me write better code",
  "Create a new project",
]);

function handlePromptClick(prompt) {
  emit("setMessage", prompt);
}
</script>

<template>
  <div class="welcome-overlay">
    <div class="welcome-content">
      <h1>Hey there!</h1>
      <div class="prompt-container">
        <button
          v-for="(prompt, idx) in suggestedPrompts"
          :key="idx"
          @click="handlePromptClick(prompt)"
          class="prompt-button"
          :class="{ 'with-separator': idx < suggestedPrompts.length - 1 }"
        >
          {{ prompt }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.welcome-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  z-index: 5;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.welcome-content {
  width: 100%;
  max-width: 800px;
  padding: 2rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 10;
}

.welcome-content h1 {
  font-size: 3rem;
  font-weight: 700;
  margin: 0 0 3rem;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  opacity: 0;
  transform: translateY(10px);
  animation: slide-up 0.3s ease-out forwards;
}

.prompt-button {
  flex: 1;
  background: transparent;
  padding: 0.75rem 2rem;
  font-size: 1.1rem;
  line-height: 1.4;
  color: var(--text-light);
  transition: all 0.2s ease;
  border: none;
  position: relative;
  max-width: fit-content;
}

.prompt-button.with-separator::after {
  content: "";
  position: absolute;
  right: 0;
  top: 20%;
  height: 60%;
  width: 1px;
  background: var(--primary);
  opacity: 0.2;
}

.prompt-button:hover {
  color: var(--primary);
  transform: translateY(-1px);
}

/* Dark mode */
.dark .welcome-overlay {
  background: transparent;
}

.dark .prompt-button {
  color: var(--text-dark);
}

.dark .prompt-button:hover {
  color: var(--primary);
}

/* Responsive design */
@media (max-width: 768px) {
  .welcome-content {
    padding: 1.5rem;
  }

  .welcome-content h1 {
    font-size: 2.5rem;
    margin-bottom: 2rem;
  }

  .prompt-container {
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .prompt-button {
    width: 100%;
    max-width: 100%;
    padding: 1rem;
    font-size: 1rem;
    text-align: center;
    border-bottom: 1px solid rgba(236, 55, 80, 0.1);
  }

  .prompt-button.with-separator::after {
    display: none;
  }

  .prompt-button:last-child {
    border-bottom: none;
  }
}
</style>
