<script setup>
import { ref, onBeforeUnmount, onMounted, nextTick } from 'vue';
import localforage from 'localforage';
import { emitter } from '@/emitter';

const emit = defineEmits(['changeConversation', 'deleteConversation', 'newConversation', 'reloadSettings', 'toggleDark', 'closeSidebar']);
const props = defineProps(['currConvo', 'messages', 'isDark', 'isOpen']);

const metadata = ref([]);
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200);
const conversationListRef = ref(null);

function handleResize() {
  windowWidth.value = window.innerWidth;
}

onMounted(() => {
  window.addEventListener('resize', handleResize);
  handleResize();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});

async function updateConversations() {
  const stored = await localforage.getItem("conversations_metadata");
  metadata.value = stored || [];

  await nextTick();
  if (conversationListRef.value) {
    conversationListRef.value.scrollTop = -conversationListRef.value.scrollHeight;
  }
}

updateConversations() // Initial load

emitter.on('updateConversations', updateConversations);

onBeforeUnmount(() => {
  emitter.off('updateConversations', updateConversations);
});

function closeSidebar() {
  emit('closeSidebar');
}
</script>

<template>
  <div>
    <div v-if="props.isOpen && windowWidth < 900" class="sidebar-overlay" @click="closeSidebar"></div>
    <div :class="['sidebar', { active: props.isOpen }]">
      <div class="sidebar-header">
        <span class="sidebar-title">Chats</span>
        <button class="dark-toggle" @click="$emit('toggleDark')" aria-label="Toggle light/dark mode">
          <img v-if="isDark" src="@/assets/dark.svg" width="28" height="28" alt="Dark mode" />
          <img v-else src="@/assets/light.svg" width="28" height="28" alt="Light mode" />
        </button>
      </div>
      <button id="new-chat-button" class="new-chat-btn" @click="$emit('newConversation')">
        <img src="@/assets/new-chat.svg" width="20" height="20" alt="New Chat" />
        <span>New Chat</span>
      </button>
      <div class="main-content">
        <div class="conversation-list" ref="conversationListRef" v-if="metadata.length">
          <div class="conversation-wrapper" v-for="data in metadata" :key="data.id">
            <button class="conversation-button" @click="$emit('changeConversation', data.id)"
              :class="{ active: data.id == currConvo }">
              {{ data.title }}
            </button>
            <button class="delete-button no-hover" @click.stop="$emit('deleteConversation', data.id)"
              aria-label="Delete chat">
              <img src="@/assets/delete.svg" width="16" height="16" alt="delete conversation">
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Karla:ital,wght@0,200..800;1,200..800&family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&family=Noticia+Text:ital,wght@0,400;0,700;1,400;1,700&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap');

.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  height: 100dvh;
  width: 280px;
  max-width: 90vw;
  z-index: 1001;
  background: #f8f9fa;
  color: #343a40;
  border-right: 1px solid #dee2e6;
  transform: translateX(-100%);
  transition: transform 0.3s ease;
}

.sidebar.active {
  transform: translateX(0);
}

.dark .sidebar {
  background: #1a1a1c;
  color: #e0e0e0;
  border-right: 1px solid #2c2c2e;
}

.sidebar-header {
  display: flex;
  align-items: center;
  height: 60px;
  background: #fff;
  color: #343a40;
  border-bottom: 1px solid #dee2e6;
  padding: 0;
  position: relative;
}

.dark .sidebar-header {
  background: #1f1f23;
  color: #e0e0e0;
  border-bottom: 1px solid #2c2c2e;
}

.sidebar-title {
  font-family: 'Inter', sans-serif;
  font-size: 1.1em;
  font-weight: 600;
  color: inherit;
  margin: 0 auto 0 0;
  padding-left: 60px;
}

.dark-toggle {
  background: none;
  border: none;
  border-radius: 8px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.18s;
  color: #6c757d;
  margin-right: 16px;
}

.dark-toggle img {
  width: 28px;
  height: 28px;
  display: block;
  filter: none;
}

.dark .dark-toggle img {
  filter: invert(1) brightness(1.2);
}

.dark-toggle:hover {
  background-color: #8492a633;
}

.dark .dark-toggle:hover {
  background: #343a40;
}

#new-chat-button {
  margin: 16px 16px 12px 16px;
  width: calc(100% - 32px);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #ec3750;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 0;
  font-size: 1em;
  font-weight: 600;
  transition: background 0.18s, box-shadow 0.18s, transform 0.15s;
  box-shadow: 0 2px 8px #ec375022;
}

#new-chat-button img {
  width: 20px;
  height: 20px;
  filter: none;
}

#new-chat-button:hover {
  background: #cb2c41;
  box-shadow: 0 4px 16px #ec375055;
  transform: scale(1.03);
}

.main-content {
  flex: 1 1 0;
  overflow-y: auto;
  padding: 0 16px;
  margin-bottom: 12px;
}

.conversation-list {
  display: flex;
  flex-direction: column-reverse;
  overflow-y: auto;
  max-height: 400px;
  gap: 4px;
}

.conversation-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.conversation-button {
  flex-grow: 1;
  text-align: left;
  background: none;
  color: #495057;
  border: none;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 0.95em;
  font-family: inherit;
  font-weight: 500;
  transition: background 0.18s, color 0.18s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conversation-button:hover {
  background: #338eda22;
  color: #338eda;
}

.conversation-button.active {
  background: #ec375011;
  color: #ec3750;
  font-weight: 700;
}

.dark .conversation-button {
  color: #adb5bd;
}

.dark .conversation-button.active {
  background: #ec375033;
  color: #ec3750;
}

.delete-button.no-hover {
  background: none;
  border: none;
  padding: 4px;
  opacity: 0.6;
}

.delete-button.no-hover:hover {
  opacity: 1;
}

.sidebar-overlay {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  opacity: 1;
  z-index: 1001;
  transition: opacity 0.2s ease-out;
  will-change: opacity;
  pointer-events: auto;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

@media (min-width: 900px) {
  .sidebar {
    position: fixed;
  }
}

@media (max-width: 900px) {
  .sidebar {
    width: 80vw;
    max-width: 340px;
    box-shadow: 4px 0 24px #0002;
  }

  .dark .sidebar {
    box-shadow: 4px 0 24px #0004;
  }
}

@media (max-width: 600px) {
  .sidebar-title {
    padding-left: 48px;
  }
}
</style>
