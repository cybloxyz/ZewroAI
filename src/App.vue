<script setup>
import { ref, nextTick } from 'vue';

const messages = ref([]);
const inputMessage = ref('');
const isLoading = ref(false);
const chatContainer = ref(null);
const controller = ref(new AbortController());

async function sendMessage() {
  if (!inputMessage.value.trim() || isLoading.value) return;

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

  // Clear input and set loading state
  const prompt = inputMessage.value;
  inputMessage.value = '';
  isLoading.value = true;

  try {
    controller.value = new AbortController();

    const response = await fetch("https://ai.hackclub.com/chat/completions",
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          stream: true
        }),
        signal: controller.value.signal
      }
    );

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines only
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

        try {
          const json = JSON.parse(trimmedLine.replace('data: ', ''));
          const content = json.choices[0].delta.content;

          if (content) {
            assistantMessage.content += content;
            // Update scroll position
            await nextTick();
            chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
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
  }
}

function stopGeneration() {
  controller.value.abort();
  isLoading.value = false;
}
</script>

<template>
  <header>
    <div class="wrapper">
      <h1>Hack Club AI ChatBot</h1>
    </div>
  </header>

  <main>
    <div class="chat-container" ref="chatContainer">
      <div v-for="(message, index) in messages" :key="index" class="message" :class="message.role">
        <div class="bubble" :class="{ typing: !message.complete }">
          {{ message.content }}
          <span v-if="!message.complete" class="cursor">|</span>
        </div>
      </div>
    </div>

    <form @submit.prevent="sendMessage">
      <input v-model="inputMessage" placeholder="Type your message..." :disabled="isLoading" />
      <button type="submit" :disabled="isLoading || !inputMessage.trim()">
        {{ isLoading ? 'Stop' : 'Send' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
header {
  background: #2c3e50;
  color: white;
  padding: 1rem;
  text-align: center;
}

header h1 {
  margin: 0;
  font-size: 1.5rem;
}

main {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background: #f5f5f5;
}

.message {
  margin: 0.5rem 0;
  display: flex;
}

.message.user {
  justify-content: flex-end;
}

.message.assistant {
  justify-content: flex-start;
}

.bubble {
  max-width: 70%;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  line-height: 1.4;
}

.user .bubble {
  background: #007bff;
  color: white;
  border-radius: 1rem 1rem 0 1rem;
}

.assistant .bubble {
  background: white;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 1rem 1rem 1rem 0;
}

form {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  background: white;
  border-top: 1px solid #ddd;
}

input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  font-size: 1rem;
}

button {
  padding: 0.75rem 1.5rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background 0.2s;
}

button:disabled {
  background: #cccccc;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .bubble {
    max-width: 85%;
  }
}

.typing {
  position: relative;
}

.cursor {
  animation: blink 1s infinite;
  opacity: 1;
}

@keyframes blink {
  0% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }

  100% {
    opacity: 1;
  }
}

.message.assistant .bubble {
  white-space: pre-wrap;
  word-break: break-word;
}

button {
  min-width: 80px;
}
</style>
