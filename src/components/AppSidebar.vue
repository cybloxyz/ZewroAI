<script setup>
import { ref, onBeforeUnmount } from 'vue';
import localforage from 'localforage';
import { emitter } from '@/emitter';

const emit = defineEmits(['changeConversation', 'deleteConversation', 'newConversation'])
const props = defineProps(['currConvo', 'messages'])

const metadata = ref([]);
const isOpen = ref(true);

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
    <img src="../assets/menu.svg" width="48px" alt="toggle menu">
  </button>
  <div class="sidebar" :class="{ active: isOpen }">
    <div class="sidebar-content-wrapper"> <!-- This is so that the items inside the sidebar appear stationary.-->
      <button id="new-chat-button"><img src="../assets/new-chat.svg" width="48px" alt="create new chat"
          @click="$emit('newConversation')"></button>
      <div class="main-content">
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
        <p class="disclaimer">API generously provided by <a href="ai.hackclub.com">ai.hackclub.com</a>.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Karla:ital,wght@0,200..800;1,200..800&family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&family=Noticia+Text:ital,wght@0,400;0,700;1,400;1,700&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap');

.menu-toggle {
  padding: 0;
  align-items: center;
  display: grid;
  position: fixed;
  left: 12px;
  top: 12px;
  width: 48px;
  height: 48px;
  z-index: 999;
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
  right: 12px;
  top: 12px;
  width: 48px;
  height: 48px;
}

.main-content {
  margin-top: 128px;
  padding: 0 12px;
  overflow: hidden;
}

.main-content h1 {
  font-family: "Inter", sans-serif;
  font-weight: bold;
}

.conversation-list {
  display: grid;
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
}

.conversation-button.active {
  background-color: #8492a6;
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
