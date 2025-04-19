<script setup>
import { onMounted, ref, watch } from 'vue'; // Import watch for reacting to tab changes
import Settings from '@/composables/settings'; // Assuming this composable handles other settings
import localforage from 'localforage'; // Local storage library

// Define the key used for storing memory in localforage
// This should match the key used in your memory.js file
const MEMORY_STORAGE_KEY = "global_chatbot_memory";

// Define component emits (events it can send to its parent)
const emit = defineEmits(['reloadSettings']);

// --- State Variables ---
const isSettingsOpen = ref(false); // Controls the visibility of the settings modal
const sysPrompt = ref(''); // Holds the value for the system prompt textarea
const resetConfirmation = ref(false); // Controls visibility of the "Are you sure?" reset button
const globalMemory = ref([]); // Holds the global memory facts. Now an array!
const currTab = ref('general'); // Controls which settings tab is currently active (default: 'general')
const autoReasoning = ref(false); // Holds the state of the auto reasoning toggle

// Initialize the Settings composable
const settingsManager = new Settings();

// --- Constants ---
// Define the available tabs for the settings modal
const tabs = [
  { key: 'general', label: 'General', icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>' },
  { key: 'sys-instructions', label: 'Prompt', icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A1.875 1.875 0 0 1 18 22.5H6A1.875 1.875 0 0 1 4.501 20.118z"/></svg>' },
  { key: 'memory', label: 'Memory', icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>' },
  { key: 'info', label: 'Info', icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="8" r="0.5"/><line x1="12" y1="12" x2="12" y2="16"/></svg>' },
];

// --- Lifecycle Hooks ---
// Called after the component is mounted to the DOM
onMounted(async () => {
  // Load general settings when the component mounts
  await settingsManager.loadSettings();
  sysPrompt.value = settingsManager.settings.system_prompt;
  // Use nullish coalescing to default auto_reasoning_mode to true if it's null or undefined
  autoReasoning.value = settingsManager.settings.auto_reasoning_mode ?? true;
});

// --- Watchers ---
// Watch for changes in the current tab
watch(currTab, async (newTab) => {
  // If the memory tab is selected, load the global memory
  if (newTab === 'memory') {
    await loadGlobalMemory();
  }
  // Reset confirmation state when changing tabs
  resetConfirmation.value = false;
});


// --- Functions ---

/**
 * Toggles the visibility of the settings modal.
 * When opening, it also loads the global memory.
 */
async function openSettings() {
  isSettingsOpen.value = !isSettingsOpen.value;
  // Load memory only when opening the settings and the memory tab might be viewed
  // A watcher is also used now to load specifically when the memory tab is clicked
  if (isSettingsOpen.value && currTab.value === 'memory') {
    await loadGlobalMemory();
  }
}

/**
 * Loads the global memory from localforage.
 * Expects the memory to be stored as a JSON string representing an array of strings.
 */
async function loadGlobalMemory() {
  try {
    const stored_memory_json = await localforage.getItem(MEMORY_STORAGE_KEY);

    if (stored_memory_json) {
      // Attempt to parse the JSON string
      const parsed_memory = JSON.parse(stored_memory_json);

      // Check if the parsed result is an array
      if (Array.isArray(parsed_memory)) {
        // Filter out any potential empty strings that might have been stored
        globalMemory.value = parsed_memory.filter(item => typeof item === 'string' && item.trim() !== '');
      } else {
        // If stored data is not an array, log a warning and initialize with empty memory
        console.warn("Stored global memory is not an array. Initializing with empty memory.");
        globalMemory.value = [];
      }
    } else {
      // If no memory is stored, initialize with an empty array
      globalMemory.value = [];
    }
  } catch (err) {
    // Handle errors during localforage retrieval or JSON parsing
    console.error("Error loading or parsing global memory from localforage:", err);
    // Initialize with empty memory on error to prevent app crash
    globalMemory.value = [];
  }
}

/**
 * Resets all settings to their default values.
 * Confirms with the user first.
 */
async function reset() {
  await settingsManager.resetSettings(); // Reset settings via the composable
  sysPrompt.value = settingsManager.settings.system_prompt; // Update prompt state
  autoReasoning.value = settingsManager.settings.auto_reasoning_mode ?? true; // Update auto reasoning state
  resetConfirmation.value = false; // Hide confirmation buttons
  emit('reloadSettings'); // Emit event to notify parent component (e.g., to reload chat settings)
  // Note: location.reload() forces a full page refresh, which might be disruptive.
  // Consider if emitting 'reloadSettings' and having the parent update is sufficient.
  location.reload();
}

/**
 * Saves the current settings from the form fields.
 */
async function save() {
  // Update settings object with current form values
  settingsManager.settings['system_prompt'] = sysPrompt.value;
  settingsManager.settings['auto_reasoning_mode'] = autoReasoning.value;

  // Save settings via the composable
  await settingsManager.saveSettings();

  // Update state from saved settings (redundant here as we just set them, but good practice)
  sysPrompt.value = settingsManager.settings.system_prompt;
  autoReasoning.value = settingsManager.settings.auto_reasoning_mode ?? true;

  resetConfirmation.value = false // Hide reset confirmation

  emit('reloadSettings'); // Emit event to notify parent component
  // Note: location.reload() forces a full page refresh.
  // Consider if emitting 'reloadSettings' and having the parent update is sufficient.
  location.reload();
}

function handleSystemPromptChange(event) {
  sysPrompt.value = event.target.value;
  // When the user edits the system prompt, it's no longer using the default
  if (sysPrompt.value.trim() !== settingsManager.defaultSettings.system_prompt.trim()) {
    settingsManager.settings.is_default_system_prompt = false;
  }
}

/**
 * Closes the settings modal and resets the reset confirmation state.
 */
function closeSettings() {
  isSettingsOpen.value = false;
  resetConfirmation.value = false;
}

</script>

<template>
  <div class="settings-header-btn">
    <button class="settings-toggle" @click="openSettings" aria-label="Open settings">
      <img src="@/assets/gear.svg" width="28" height="28" alt="Settings" />
    </button>
  </div>

  <div v-if="isSettingsOpen" class="overlay" @click="closeSettings"></div>

  <div v-if="isSettingsOpen" class="settings-modal">
    <div class="settings-card">
      <div class="settings-header">
        <h2>Settings</h2>
        <button class="close-settings hc-btn-flat" @click="closeSettings" aria-label="Close settings">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 32 32" fill="none"
            stroke="#ec3750" stroke-width="2">
            <line x1="8" y1="8" x2="24" y2="24" />
            <line x1="24" y1="8" x2="8" y2="24" />
          </svg>
        </button>
      </div>

      <div class="settings-tabs">
        <button v-for="tab in tabs" :key="tab.key" :class="['settings-tab', { active: tab.key === currTab }]"
          @click="currTab = tab.key">
          <span v-if="tab.icon" v-html="tab.icon" class="tab-icon"></span>
          {{ tab.label }}
        </button>
      </div>

      <div class="settings-content">
        <section v-if="currTab === 'general'" class="settings-section">
          <div class="setting-row">
            <div class="setting-labels">
              <label for="auto-reasoning-toggle">Auto Reasoning</label>
              <span class="setting-desc">Automatically choose Reasoning/Regular for each message. Recommended for most
                users.</span>
            </div>
            <label class="switch-wrapper">
              <input id="auto-reasoning-toggle" type="checkbox" v-model="autoReasoning" class="switch-input" />
              <span class="switch-slider"></span>
            </label>
          </div>
        </section>

        <section v-if="currTab === 'sys-instructions'" class="settings-section">
          <label for="sys-prompt" class="section-label">System Prompt</label>
          <span class="setting-desc">This prompt guides the AI's behavior. Customize carefully.</span>
          <textarea id="sys-prompt" v-model="sysPrompt" @input="handleSystemPromptChange" class="settings-textarea"
            rows="8"></textarea>
        </section>

        <section v-if="currTab === 'memory'" class="settings-section">
          <label class="section-label">Global Memory</label>
          <span class="setting-desc">Facts remembered across chats. This view is read-only. Memory is managed
            automatically by the AI.</span>
          <ul class="memory-list">
            <li v-if="!globalMemory || globalMemory.length === 0">No memories stored yet.</li>
            <li v-for="(memoryFact, index) in globalMemory" :key="index">{{ memoryFact }}</li>
          </ul>
        </section>

        <section v-if="currTab === 'info'" class="settings-section info-section">
          <h3>About Aegis AI</h3>
          <p>API by <a href="https://ai.hackclub.com" target="_blank" rel="noopener noreferrer">ai.hackclub.com</a>.</p>
          <p>Data stored locally on your device.</p>
          <p>Developed by Karo Roghzai, known as MostLime on the internet.</p>
          <p><a href="https://github.com/Mostlime12195/Hackclub-AI-Chatbot" target="_blank"
              rel="noopener noreferrer">View on GitHub</a></p>
        </section>
      </div>

      <div class="settings-actions">
        <button v-if="!resetConfirmation" class="hc-btn-flat reset-btn" @click="resetConfirmation = true">Reset</button>
        <button v-else class="hc-btn-red reset-confirm-btn" @click="reset">Are you sure?</button>
        <button class="hc-btn-red save-btn" @click="save">Save</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* --- Settings Button --- */
.settings-header-btn {
  position: fixed;
  bottom: 32px;
  right: 32px;
  z-index: 1000;
  /* Ensure it's above most content but below the modal/overlay */
  pointer-events: auto;
  /* Allow mouse events */
}

.settings-toggle {
  background: #fff;
  /* White background */
  color: #ec3750;
  /* Hack Club red color */
  border-radius: 50%;
  /* Circular button */
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  /* Soft shadow */
  border: none;
  transition: all 0.2s ease;
  /* Smooth transitions for hover effects */
  outline: none;
  /* Remove default outline */
  padding: 0;
  cursor: pointer;
  /* Indicate it's clickable */
}

/* Dark mode styles for the settings toggle button */
.dark .settings-toggle {
  background: #2d3748;
  /* Darker background */
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  /* Darker shadow */
}

.dark .settings-toggle img {
  filter: invert(1);
  /* Invert gear icon color in dark mode */
}

.settings-toggle:hover {
  background: #ffe6ea44;
  /* Light red background on hover */
  box-shadow: 0 8px 32px rgba(236, 55, 80, 0.34);
  /* More prominent shadow on hover */
  transform: scale(1.08);
  /* Slightly enlarge button on hover */
}

.settings-toggle img {
  width: 32px;
  height: 32px;
  display: block;
}

/* Responsive adjustments for smaller screens */
@media (max-width: 600px) {
  .settings-header-btn {
    bottom: 12px;
    right: 12px;
  }

  .settings-toggle {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    /* Make it slightly rounded square on small screens */
  }

  .settings-toggle img {
    width: 22px;
    height: 22px;
  }
}

/* --- Modal Overlay --- */
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.25);
  /* Semi-transparent black background */
  z-index: 1003;
  /* Below the modal but above other content */
}

/* --- Settings Modal --- */
.settings-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 1004;
  transform-origin: center;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
}

.settings-card {
  background: #fff;
  /* White background */
  border-radius: 18px;
  /* Rounded corners */
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  /* Soft shadow */
  width: 520px;
  /* Fixed width */
  max-width: 98vw;
  /* Max width to fit on small screens */
  min-height: 420px;
  max-height: 85vh;
  /* Max height relative to viewport */
  display: flex;
  flex-direction: column;
  padding: 0 0 18px 0;
  /* Padding at bottom */
  pointer-events: all;
  /* Capture pointer events inside the card */
  animation: popIn 0.22s cubic-bezier(.4, 1.6, .6, 1);
  transform-origin: center;
}

/* Dark mode styles for the settings card */
.dark .settings-card {
  background: #23232a;
  /* Dark background */
  color: #e0e0e0;
  /* Light text color */
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  /* Darker shadow */
}

/* --- Modal Header --- */
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 0 24px;
  border-radius: 18px 18px 0 0;
  /* Match card top corners */
}

.settings-header h2 {
  font-size: 1.5em;
  font-weight: 700;
  margin: 0;
  color: #ec3750;
  /* Hack Club red color */
  letter-spacing: 1px;
}

/* Dark mode styles for header title */
.dark .settings-header h2 {
  color: #fff;
  /* White title in dark mode */
}

.close-settings {
  background: none;
  border: none;
  border-radius: 8px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.18s;
  /* Smooth background transition on hover */
  cursor: pointer;
  padding: 0;
}

.close-settings:hover {
  background: #ffe6ea;
  /* Light red background on hover */
}

/* --- Tab Navigation --- */
.settings-tabs {
  display: flex;
  gap: 8px;
  /* Space between tabs */
  padding: 0 24px;
  margin-top: 12px;
  /* Allow tabs to wrap if necessary on smaller screens */
  flex-wrap: wrap;
}

.settings-tab {
  background: none;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 1em;
  font-weight: 500;
  color: #495057;
  /* Default tab text color */
  transition: background 0.18s, color 0.18s;
  /* Smooth transitions */
  display: flex;
  align-items: center;
  gap: 8px;
  /* Space between icon and label */
  cursor: pointer;
}

.settings-tab.active,
.settings-tab:hover {
  background: #ec375011;
  /* Light red background for active/hover */
  color: #ec3750;
  /* Hack Club red text color for active/hover */
}

/* Dark mode styles for tabs */
.dark .settings-tab {
  color: #e0e0e0;
  /* Light text color */
}

.dark .settings-tab.active,
.dark .settings-tab:hover {
  background: #ec375033;
  /* More visible red background */
  color: #ec3750;
  /* Hack Club red text color */
}

.tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* --- Tab Content Area --- */
.settings-content {
  flex: 1 1 0;
  /* Allows content to grow and shrink, takes minimum 0 height */
  min-height: 0;
  /* Essential for flex items with overflow */
  padding: 24px 24px 0 24px;
  overflow-y: auto;
  /* Enable vertical scrolling if content exceeds height */
  display: flex;
  flex-direction: column;
  gap: 24px;
  /* Space between sections */
  max-height: calc(85vh - 160px);
  /* Calculate max height based on modal height */
  /* Custom scrollbar styles */
  scrollbar-width: thin;
  scrollbar-color: #bbb #f7f7f7;
}

/* Webkit scrollbar styles */
.settings-content::-webkit-scrollbar {
  width: 7px;
  background: #f7f7f7;
  border-radius: 8px;
}

.settings-content::-webkit-scrollbar-thumb {
  background: #bbb;
  border-radius: 8px;
}

/* Dark mode scrollbar styles */
.dark .settings-content {
  scrollbar-color: #444 #23232a;
}

.dark .settings-content::-webkit-scrollbar {
  background: #23232a;
}

.dark .settings-content::-webkit-scrollbar-thumb {
  background: #444;
}

/* --- Individual Settings Sections --- */
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 0;
  /* Removed margin-bottom as gap handles spacing */
}

.settings-section h3,
.section-label {
  font-size: 1.15em;
  font-weight: 600;
  color: #343a40;
  /* Dark grey color */
  margin-bottom: 4px;
}

/* Dark mode section titles */
.dark .settings-section h3,
.dark .section-label {
  color: #e0e0e0;
  /* Light grey color */
}

.setting-row {
  display: flex;
  align-items: flex-start;
  /* Align items to the top */
  justify-content: space-between;
  gap: 16px;
  background: #f8f9fa;
  /* Light background */
  padding: 16px;
  border-radius: 12px;
  border: 1px solid #dee2e6;
  /* Light border */
}

/* Dark mode setting rows */
.dark .setting-row {
  background: #23232a;
  /* Dark background */
  border: 1px solid #343a40;
  /* Darker border */
}

.setting-labels {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-labels label {
  font-weight: 600;
  font-size: 1em;
  color: #343a40;
  /* Dark grey color */
}

.dark .setting-labels label {
  color: #e0e0e0;
  /* Light grey color */
}

.setting-desc {
  font-size: 0.9em;
  color: #6c757d;
  /* Muted grey color */
}

/* Dark mode setting descriptions */
.dark .setting-desc {
  color: #adb5bd;
  /* Lighter grey color */
}

/* --- Toggle Switch Styles --- */
.switch-wrapper {
  position: relative;
  width: 42px;
  height: 24px;
  /* Ensure switch doesn't shrink in flex layout */
  flex-shrink: 0;
}

.switch-input {
  display: none;
  /* Hide the actual checkbox input */
}

.switch-slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #e9ecef;
  /* Light grey background when off */
  border-radius: 24px;
  /* Pill shape */
  cursor: pointer;
  transition: 0.2s ease;
  /* Smooth transition for background */
}

.switch-slider:before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  top: 3px;
  background: white;
  /* White circle (the thumb) */
  border-radius: 50%;
  /* Circular thumb */
  transition: 0.2s ease;
  /* Smooth transition for thumb movement */
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  /* Soft shadow on thumb */
}

.switch-input:checked+.switch-slider {
  background: #ec3750;
  /* Hack Club red background when on */
}

.switch-input:checked+.switch-slider:before {
  transform: translateX(18px);
  /* Move thumb to the right */
}

/* Dark mode switch slider */
.dark .switch-slider {
  background: #2d3748;
  /* Darker background */
}

/* --- Textarea Styles --- */
.settings-textarea {
  width: 100%;
  min-height: 120px;
  max-height: 240px;
  /* Limit max height to prevent excessive scrolling */
  border-radius: 8px;
  border: 1px solid #ced4da;
  /* Light border */
  padding: 12px;
  font-size: 0.95em;
  background: #fff;
  /* White background */
  color: #212529;
  /* Dark text color */
  transition: border 0.18s, background 0.18s;
  /* Smooth transitions on focus */
  resize: vertical;
  /* Allow vertical resizing */
  line-height: 1.5;
  /* Improved readability */
  font-family: inherit;
  /* Use inherited font */
}

.settings-textarea:focus {
  border-color: #ec3750;
  /* Hack Club red border on focus */
  background: #fff;
  outline: none;
  /* Remove default outline */
  box-shadow: 0 0 0 2px rgba(236, 55, 80, 0.2);
  /* Red glow effect on focus */
}

/* Dark mode textarea */
.dark .settings-textarea {
  background: #212529;
  /* Dark background */
  color: #e0e0e0;
  /* Light text color */
  border: 1px solid #495057;
  /* Darker border */
}

.dark .settings-textarea:focus {
  border-color: #ec3750;
  /* Hack Club red border */
  background: #212529;
  box-shadow: 0 0 0 2px rgba(236, 55, 80, 0.34);
  /* Red glow effect */
}

/* --- Memory List Styles --- */
.memory-list {
  background: #f8f9fa;
  /* Light background */
  border: 1px solid #dee2e6;
  /* Light border */
  border-radius: 8px;
  padding: 12px 16px;
  margin-top: 8px;
  max-height: 200px;
  /* Limit height and enable scrolling */
  overflow-y: auto;
  font-size: 0.95em;
  color: #495057;
  /* Dark grey text color */
  list-style: none;
  /* Remove default list bullets */
  margin-left: 0;
  /* Ensure no default padding/margin */
}

.memory-list li {
  padding: 8px 0;
  border-bottom: 1px solid #e9ecef;
  /* Separator line between items */
  line-height: 1.4;
  word-break: break-word;
  /* Prevent long words from overflowing */
}

.memory-list li:last-child {
  border-bottom: none;
  /* No border after the last item */
}

/* Dark mode memory list */
.dark .memory-list {
  background: #2d3748;
  /* Dark background */
  border-color: #4a5568;
  /* Darker border */
  color: #e2e8f0;
  /* Light text color */
}

.dark .memory-list li {
  border-color: #4a5568;
  /* Darker separator */
}

/* --- Info Section Styles --- */
.info-section p {
  margin: 4px 0;
  line-height: 1.6;
  color: #495057;
  /* Dark grey text color */
}

/* Dark mode info section text */
.dark .info-section p {
  color: #adb5bd;
  /* Lighter grey text color */
}

.info-section a {
  color: #ec3750;
  /* Hack Club red link color */
  text-decoration: none;
  font-weight: 500;
}

.info-section a:hover {
  text-decoration: underline;
  /* Underline on hover */
}

/* --- Action Buttons --- */
.settings-actions {
  padding: 18px 24px 0 24px;
  border-top: 1px solid #dee2e6;
  /* Separator line above buttons */
  margin-top: 16px;
  display: flex;
  gap: 12px;
  /* Space between buttons */
  justify-content: flex-end;
  /* Align buttons to the right */
}

/* Dark mode action buttons border */
.dark .settings-actions {
  border-top: 1px solid #2c2c2e;
  /* Darker border */
}

/* Base styles for action buttons */
.reset-btn,
.reset-confirm-btn,
.save-btn {
  background: #fff;
  /* White background */
  color: #ec3750;
  /* Hack Club red text */
  border: 1.5px solid #ec3750;
  /* Red border */
  border-radius: 8px;
  padding: 8px 18px;
  font-size: 1em;
  font-weight: 600;
  transition: background 0.18s, color 0.18s, border 0.18s;
  /* Smooth transitions */
  cursor: pointer;
  /* Ensure buttons don't shrink in flex layout */
  flex-shrink: 0;
}

/* Hover styles for reset buttons */
.reset-btn:hover,
.reset-confirm-btn:hover {
  background: #ffe6ea;
  /* Light red background */
  color: #cb2c41;
  /* Darker red text */
  border-color: #cb2c41;
  /* Darker red border */
}

/* Save button specific styles */
.save-btn {
  background: #ec3750;
  /* Hack Club red background */
  color: #fff;
  /* White text */
  border: 1.5px solid #ec3750;
  /* Red border */
}

/* Hover styles for save button */
.save-btn:hover {
  background: #cb2c41;
  /* Darker red background */
  border-color: #cb2c41;
  /* Darker red border */
}

/* Dark mode styles for action buttons */
.dark .reset-btn,
.dark .reset-confirm-btn {
  background: #23232a;
  /* Dark background */
  color: #ec3750;
  /* Hack Club red text */
  border: 1.5px solid #ec3750;
  /* Red border */
}

.dark .save-btn {
  background: #ec3750;
  /* Hack Club red background */
  color: #fff;
  /* White text */
  border: 1.5px solid #ec3750;
  /* Red border */
}

.dark .save-btn:hover {
  background: #cb2c41;
  /* Darker red background */
  border-color: #cb2c41;
  /* Darker red border */
}


/* --- Responsive Adjustments for Modal --- */
@media (max-width: 600px) {

  .settings-card {
    width: 95vw;
    /* Make card take up more width on small screens */
    max-height: 95vh;
    /* Allow taller modal */
  }

  .settings-header {
    padding: 16px 16px 0 16px;
    /* Reduce padding */
  }

  .settings-content {
    padding: 16px 16px 0 16px;
    /* Reduce padding */
    max-height: calc(95vh - 150px);
    /* Adjust max height calculation */
    gap: 16px;
    /* Reduce gap between sections */
  }

  .settings-tabs {
    padding: 0 16px;
    /* Reduce padding */
    gap: 4px;
    /* Reduce gap between tabs */
  }

  .settings-tab {
    padding: 6px 10px;
    /* Reduce tab padding */
    font-size: 0.9em;
    /* Reduce font size */
    gap: 4px;
    /* Reduce icon/label gap */
  }

  .settings-actions {
    padding: 16px 16px 0 16px;
    /* Reduce padding */
    gap: 8px;
    /* Reduce gap between buttons */
    flex-direction: column;
    /* Stack buttons vertically */
    align-items: stretch;
    /* Stretch buttons to full width */
  }

  .reset-btn,
  .reset-confirm-btn,
  .save-btn {
    padding: 10px;
    /* Adjust button padding when stacked */
    text-align: center;
    /* Center text in buttons */
  }

  .setting-row {
    flex-direction: column;
    /* Stack setting label/desc and toggle vertically */
    align-items: stretch;
    /* Stretch items */
    gap: 10px;
    /* Space between stacked items */
    padding: 10px;
    /* Reduce padding */
  }

  .switch-wrapper {
    align-self: flex-end;
    /* Keep toggle aligned to the right */
  }

  .memory-list {
    padding: 10px;
    /* Reduce padding */
  }

  .memory-list li {
    padding: 6px 0;
    /* Reduce padding between list items */
  }
}


/* --- Animation --- */
@keyframes popIn {
  0% {
    opacity: 0;
    transform: scale(0.95);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
