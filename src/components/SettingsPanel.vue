<script setup>
import { onMounted, ref } from 'vue';
import Settings from '@/composables/settings';

const emit = defineEmits(['reloadSettings']);

const isSettingsOpen = ref(false);
const sysPrompt = ref('');
const currTab = ref('sys-instructions'); // Default to the first tab

const settingsManager = new Settings();

// Define the tabs
const tabs = [
  { key: 'sys-instructions', label: 'Custom Instructions' },
  //{ key: 'visuals', label: 'Visuals' },
  { key: 'info', label: 'Info' },
];

onMounted(async () => {
  await settingsManager.loadSettings();
  sysPrompt.value = settingsManager.settings.system_prompt;
});

async function reset() {
  await settingsManager.resetSettings();
  sysPrompt.value = settingsManager.settings.system_prompt;
  emit('reloadSettings');
  location.reload(); // Provides interaction feedback
}

async function save() {
  settingsManager.settings['system_prompt'] = sysPrompt.value;
  sysPrompt.value = settingsManager.settings.system_prompt;
  await settingsManager.saveSettings();
  emit('reloadSettings');
  location.reload(); // Provides interaction feedback, loads settings
}
</script>

<template>
  <button class="settings-toggle" @click="isSettingsOpen = true">
    <svg xmlns="http://www.w3.org/2000/svg" width="48px" height="48px" viewBox="0 0 32 32" fill="currentColor"
      stroke="#currentColor">
      <path
        d="m9.752 9.489 2.302.705a7 7 0 0 1 1.81-.873l.885-2.239a9 9 0 0 1 2.433 0l.884 2.239c.649.204 1.258.5 1.81.873l2.302-.705c.588.56 1.1 1.2 1.519 1.901l-1.2 2.088a7 7 0 0 1 .446 1.959l1.987 1.361a9 9 0 0 1-.539 2.372l-2.383.364a7 7 0 0 1-1.253 1.57l.176 2.403a9 9 0 0 1-2.191 1.057l-1.77-1.636a7 7 0 0 1-2.01 0l-1.77 1.636A9 9 0 0 1 11 23.507l.175-2.403a7 7 0 0 1-1.253-1.57l-2.383-.364A9 9 0 0 1 7 16.798l1.987-1.361a7 7 0 0 1 .446-1.959L8.234 11.39a9 9 0 0 1 1.518-1.901ZM15.965 20a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    </svg>
  </button>

  <div v-if="isSettingsOpen" class="overlay" @click="isSettingsOpen = false"></div>

  <div v-if="isSettingsOpen" class="settings">
    <div class="settings-heading">
      <h1>Settings</h1>
      <button class="close-settings" @click="isSettingsOpen = false">
        <img src="../assets/close.svg" alt="close menu" width="48px" height="48px" />
      </button>
    </div>
    <div class="main-content">
      <div class="settings-selector">
        <!-- Loop through the tabs and render buttons -->
        <button v-for="tab in tabs" :key="tab.key" :class="{ active: tab.key === currTab }" @click="currTab = tab.key">
          {{ tab.label }}
        </button>
      </div>

      <!-- Conditional rendering based on the current tab -->
      <div v-if="currTab === 'sys-instructions'" class="custom-instructions">
        <h1>System Instructions</h1>
        <p class="disclaimer">
          This is the system prompt given to DeepSeek right after DeepSeek's default prompt.
          DeepSeek's default prompt is given by DeepSeek and cannot be modified by anyone. Our default system prompt
          is separate from DeepSeek's own prompt.
        </p>
        <textarea v-model="sysPrompt"></textarea>
      </div>

      <!--
      <div v-if="currTab === 'visuals'" class="visuals">
        <h1>Visual Settings</h1>
        <p>Customize the appearance of the application here.</p>
      </div> -->

      <div v-if="currTab === 'info'" class="info">
        <h1>Information</h1>
        <p>This is not an official Hack Club website or product.</p>
        <p>The API used on this site is generously provided by <a href="https://ai.hackclub.com">ai.hackclub.com</a>.
        </p>
        <br>
        <p>No data is stored on our servers. All data is stored locally on your device.</p>
        <p>This includes chat history, messages, and user preferences.</p>
        <br>
        <p>This project is developed solely by Karo Roghzai, also known as MostLime online.</p>
        <p>The project is open-source and available for viewing on its <a
            href="https://github.com/Mostlime12195/Hackclub-AI-Chatbot">GitHub page</a>.</p>
      </div>
    </div>
    <div class="settings-buttons">
      <button class="reset" type="button" @click="reset">Reset to Default</button>
      <button class="save" type="submit" @click="save">Save</button>
    </div>
  </div>
</template>

<style scoped>
.disclaimer {
  margin-top: -8px;
  margin-bottom: 8px;
  line-height: 14px;
  text-align: left;
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}


.settings-toggle {
  position: fixed;
  width: 48px;
  height: 48px;
  right: 12px;
  top: 18px;
  z-index: 11;
}

.settings {
  position: fixed;
  display: flex;
  flex-direction: column;
  background-color: #e0e6ed;
  top: 50%;
  left: 50%;
  margin-top: -250px;
  margin-left: -400px;
  width: 800px;
  height: 500px;
  border-radius: 24px;
  box-shadow: 0 0 12px #00000055;
  z-index: 1001;
}

.active {
  background-color: #3f4f6433;
}

.settings-heading {
  font-size: 24px;
  height: 74px;
  padding: 4.8px 18px;
}

.main-content {
  display: flex;
  flex: 1;
  flex-direction: row;
}

.settings-selector {
  display: flex;
  flex-direction: column;
  width: 150px;
  gap: 16px;
  padding: 18px;
}

.settings-selector button {
  width: 100px;
  height: 40px;
}

.settings-selector.active {
  background-color: #484e5633;
}

.custom-instructions {
  position: relative;
  padding: 18px;
  padding-top: 7.5px;
  height: 100%;
}

.visuals {
  position: relative;
  padding: 11.5px 18px 18px 3px;
  height: 100%;
}

.info {
  position: relative;
  padding: 12px 18px 18px 2px;
  height: 100%;
}

textarea {
  width: 400px;
  height: 228px;
  resize: none;
  padding: 4px 8px;
  border: none;
  background-color: #f9fafc;
  outline: none;
}

.settings-buttons {
  height: 100px;
}

.reset {
  background-color: #ec3750;
  color: #FFFFFF;
  position: absolute;
  left: 154px;
  bottom: 18px;
  width: 72px;
  height: 64px;
}

.reset:hover {
  background-color: #cb2c41;
}

.save {
  position: absolute;
  right: 18px;
  bottom: 18px;
  background-color: #33d6a6;
  width: 72px;
  height: 64px;
}

.save:hover {
  background-color: #2aac85;
}

.close-settings {
  position: absolute;
  background-color: #ec3750;
  top: 18px;
  right: 18px;
  width: 48px;
  height: 48px;
  z-index: 20;
}

.close-settings:hover {
  background-color: #cb2c41;
}

.dark .settings {
  background-color: #273444;
}

.dark button {
  color: #e0e0e0;
}

.dark .save {
  color: #1f2d3d;
}

.dark textarea {
  background-color: #252429;
  color: #e0e0e0;
}
</style>
