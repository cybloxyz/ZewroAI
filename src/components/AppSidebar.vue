<script setup>
import { ref, onBeforeUnmount } from 'vue';
import localforage from 'localforage';
import { emitter } from '@/emitter';

const emit = defineEmits(['changeConversation', 'deleteConversation', 'newConversation'])
const props = defineProps(['currConvo', 'messages'])

const metadata = ref([]);
const isOpen = ref(true);

if (window.innerWidth < 768) {
  isOpen.value = false;
}

async function updateConversations() {
  const stored = await localforage.getItem("conversations_metadata");
  metadata.value = stored || []
}

updateConversations() // Initial load

function toggle() {
  isOpen.value = !isOpen.value;
}

// Subscribe to emitter event so that when a new conversation is created, we update
emitter.on('updateConversations', updateConversations);

onBeforeUnmount(() => {
  emitter.off('updateConversations', updateConversations);
});
</script>

<template>
  <button @click="toggle" class="menu-toggle">
    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" stroke="currentColor" width="32px" height="32px"
      viewBox="0 0 32 32">
      <path
        d="M9 10a1 1 0 0 1 1-1h12a1 1 0 0 1 0 2H10a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h12a1 1 0 0 1 0 2H10a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h12a1 1 0 0 1 0 2H10a1 1 0 0 1-1-1Z" />
    </svg>
  </button>
  <div class="sidebar" :class="{ active: isOpen }">
    <div class="sidebar-content-wrapper"> <!-- This is so that the items inside the sidebar appear stationary.-->
      <button id="new-chat-button" @click="$emit('newConversation')"><svg xmlns="http://www.w3.org/2000/svg"
          width="48px" height="48px" viewBox="0 0 32 32">
          <path
            d="M26.957 4.886a1 1 0 0 0-1.414 0L14.647 15.782a6.8 6.8 0 0 0-1.407 2.058l-.003.006c-.307.7.403 1.413 1.104 1.11a6.7 6.7 0 0 0 2.083-1.416L27.31 6.653a1 1 0 0 0 0-1.414zm-8.039 3.245c.311.032.622-.071.843-.292l.737-.737c.274-.274.145-.736-.236-.804C19.078 6.088 17.67 6 16 6 8 6 6 8 6 16s2 10 10 10 10-2 10-10c0-1.507-.071-2.801-.24-3.909-.059-.39-.53-.529-.808-.251l-.757.757a1.03 1.03 0 0 0-.293.821c.064.734.098 1.587.098 2.582 0 4.015-.55 5.722-1.414 6.586S20.014 24 16 24s-5.722-.55-6.586-1.414S8 20.015 8 16c0-4.014.55-5.721 1.414-6.585S11.986 8 16 8c1.151 0 2.112.046 2.918.131"
            fill="currentColor" />
        </svg></button>
      <div class=" main-content">
        <h1>Recent</h1>
        <div class="conversation-list" v-if="metadata.length">
          <div class="conversation-wrapper" v-for="data in metadata" :key="data.id">
            <button class="conversation-button" @click="$emit('changeConversation', data.id)"
              :class="{ active: data.id == currConvo }">
              {{ data.title }}
            </button>
            <button class="delete-button" @click.stop="$emit('deleteConversation', data.id)">
              <img src="../assets/delete.svg" width="16px" alt="delete conversation">
            </button>

          </div>
        </div>
      </div>
      <div class="sidebar-footer">
        <a href="https://hackclub.com" class="hc-flag">
          <img src="../assets/flag-standalone.svg" alt="hackclub logo" width="180px" />
        </a>
        <p class="disclaimer">This is not an official HackClub website or product.</p>
        <p class="disclaimer">API generously provided by <a href="https://ai.hackclub.com">ai.hackclub.com</a>.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Karla:ital,wght@0,200..800;1,200..800&family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&family=Noticia+Text:ital,wght@0,400;0,700;1,400;1,700&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap');

.menu-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: fixed;
  left: 12px;
  top: 18px;
  width: 48px;
  height: 48px;
  z-index: 999;
}

.menu-toggle svg {
  position: relative;
  width: 150%;
  height: 100%
}

.sidebar {
  top: 0;
  left: 0;
  bottom: 0;
  width: 0;
  height: 100dvh;
  background-color: #ededed;
  position: relative;
  overflow: hidden;
  z-index: 998;
  box-shadow: 0 0 24px rgba(0, 0, 0, 0.2);
  transition: width 0.4s ease;
  text-wrap-mode: nowrap;
}

.sidebar.active {
  width: 300px;
}

.sidebar-content-wrapper {
  position: absolute;
  left: 0;
  width: 300px;
  height: 100%;
}

.sidebar button {
  display: block;
}

#new-chat-button {
  padding: 0;
  position: absolute;
  right: 21px;
  top: 18px;
  width: 48px;
  height: 48px;
}

.main-content {
  margin-top: 128px;
  padding: 0 3px 0 24.5px;
  overflow: hidden;
}

.main-content h1 {
  font-family: "Inter", sans-serif;
  font-weight: bold;
  margin-left: -1.5px;
}

.conversation-list {
  display: flex;
  flex-direction: column-reverse;
  max-height: calc(100dvh - 320px);
  overflow-y: auto;
}

.conversation-button {
  width: 100%;
  height: 36px;
  border-radius: 4px;
  padding: 0 8px;
  text-align: left;
  font-size: 16px;
  margin-right: 3px;
}

.conversation-button.active {
  background-color: #484e5633;
}

.sidebar-footer {
  position: absolute;
  bottom: 0;
  width: 100%;
  text-align: center;
  padding: 12px 8px;
}

.sidebar-footer .hc-flag {
  padding: 8px;
  margin: 28px auto 4px;
  display: inline-block;
  width: auto;
}

.sidebar-footer .hc-flag:hover {
  background-color: transparent;
}

.conversation-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Make delete button small and unobtrusive */
.delete-button {
  background: transparent;
  border: none;
  padding: 0 4px;
  cursor: pointer;
}

.delete-button img {
  display: block;
}

/* Dark mode styles */

.dark .sidebar {
  background-color: #242529;
}

.dark .conversation-button {
  color: #E0E0E0;
}

.dark .conversation-button.active {
  background-color: #d4e0f333;
}

/* Different display size styles */

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
  }

  .sidebar.active {
    width: 300px;
  }
}
</style>
