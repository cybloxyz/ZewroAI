<script setup>
import { onMounted, ref, watch, reactive } from "vue";
import Settings from "@/composables/settings";
import { useDark, useToggle } from "@vueuse/core";
import { SwitchRoot, SwitchThumb } from "reka-ui";

// Define props and emits
const props = defineProps(["isOpen", "initialTab"]);
const emit = defineEmits(["reloadSettings", "close"]);

// --- Reactive State Variables ---
const settingsManager = reactive(new Settings());
const currTab = ref("general");
const isDark = useDark();
const toggleDark = useToggle(isDark);
const globalMemoryEnabled = ref(false);

// User profile fields
const userName = ref("");
const occupation = ref("");
const customInstructions = ref("");

// --- Constants for Navigation ---
const navItems = [
  {
    key: "general",
    label: "General",
    icon: "M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1ZM12 7C13.1 7 14 7.9 14 9S13.1 11 12 11 10 10.1 10 9 10.9 7 12 7ZM18 15C16.59 16.41 14.42 17.17 12 17.17S7.41 16.41 6 15C6.58 13.83 9.61 13.17 12 13.17S17.42 13.83 18 15Z"
  },
  {
    key: "customization",
    label: "Customization",
    icon: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
  },
  {
    key: "memory",
    label: "Memory",
    icon: "M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"
  },
  {
    key: "about",
    label: "About",
    icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
  }
];

// --- Lifecycle Hooks ---
onMounted(async () => {
  await settingsManager.loadSettings();
  userName.value = settingsManager.settings.user_name || "";
  occupation.value = settingsManager.settings.occupation || "";
  customInstructions.value = settingsManager.settings.custom_instructions || "";
  // Load global memory setting (placeholder for now)
  globalMemoryEnabled.value = false;
});

// Watch props.isOpen to set the initial tab when the modal opens
watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      currTab.value = props.initialTab || "general";
    }
  }
);

// --- Functions ---
function closeSettings() {
  emit("close");
}

function saveSettings() {
  // Save settings logic
  settingsManager.setSetting("user_name", userName.value);
  settingsManager.setSetting("occupation", occupation.value);
  settingsManager.setSetting("custom_instructions", customInstructions.value);
  settingsManager.saveSettings();
  closeSettings();
}
</script>

<template>
  <div class="settings-overlay" v-if="isOpen" @click.self="closeSettings">
    <div class="settings-panel">
      <!-- Header -->
      <div class="panel-header">
        <div class="header-content">
          <h1 class="panel-title">Settings</h1>
        </div>
        <button class="close-btn" @click="closeSettings" aria-label="Close settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="panel-content-wrapper">
        <!-- Vertical Navigation -->
        <NavigationMenuRoot class="settings-nav" v-model="currTab">
          <div class="nav-items">
            <NavigationMenuItem v-for="item in navItems" :key="item.key" class="nav-item">
              <NavigationMenuLink class="nav-link" :class="{ active: currTab === item.key }"
                @click="currTab = item.key">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path :d="item.icon" />
                </svg>
                <span class="nav-label">{{ item.label }}</span>
              </NavigationMenuLink>
            </NavigationMenuItem>
          </div>
        </NavigationMenuRoot>

        <!-- Content Area -->
        <div class="panel-content">
          <!-- General Tab -->
          <div v-show="currTab === 'general'" class="settings-section">
            <div class="settings-content">
              <div class="content-header">
                <h2>General Settings</h2>
                <p>Basic configuration options</p>
              </div>
              <div class="setting-item">
                <div class="setting-info">
                  <h3>Dark Mode</h3>
                  <p>Toggle between light and dark themes</p>
                </div>
                <div class="switch-container">
                  <SwitchRoot class="switch-root" :modelValue="isDark" @update:modelValue="toggleDark()">
                    <SwitchThumb class="switch-thumb" />
                  </SwitchRoot>
                </div>
              </div>
            </div>
          </div>

          <!-- Customization Tab -->
          <div v-show="currTab === 'customization'" class="settings-section">
            <div class="settings-content">
              <div class="content-header">
                <h2>Customization</h2>
                <p>Personalize your experience</p>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <h3>What should Aegis call you?</h3>
                  <p>Enter your name</p>
                </div>
                <div class="input-container">
                  <input v-model="userName" type="text" placeholder="Enter your name" class="custom-input" />
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <h3>What occupation do you have?</h3>
                  <p>Teacher, software engineer, student, etc.</p>
                </div>
                <div class="input-container">
                  <input v-model="occupation" type="text" placeholder="Teacher, software engineer, student, etc."
                    class="custom-input" />
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <h3>What custom instructions do you want Aegis to follow?</h3>
                  <p>Be precise, be witty, etc.</p>
                </div>
                <div class="input-container">
                  <textarea v-model="customInstructions" placeholder="Be precise, be witty, etc."
                    class="custom-textarea" rows="3"></textarea>
                </div>
              </div>
            </div>
          </div>

          <!-- Memory Tab -->
          <div v-show="currTab === 'memory'" class="settings-section">
            <div class="settings-content">
              <div class="content-header">
                <h2>Memory</h2>
                <p>Manage conversation memory</p>
              </div>
              <div class="setting-item">
                <div class="setting-info">
                  <h3>Global Memory</h3>
                  <p>Remember conversations across sessions</p>
                </div>
                <div class="switch-container">
                  <SwitchRoot class="switch-root" v-model:checked="globalMemoryEnabled">
                    <SwitchThumb class="switch-thumb" />
                  </SwitchRoot>
                </div>
              </div>
            </div>
          </div>

          <!-- About Tab -->
          <div v-show="currTab === 'about'" class="settings-section">
            <div class="settings-content">
              <div class="content-header">
                <h2>About</h2>
                <p>Information about Aegis AI Interface</p>
              </div>
              <div class="info-section">
                <p>
                  A modern Vue.js-powered interface for AI interactions with
                  support for Hack Club API.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="panel-footer">
        <div class="footer-actions">
          <button @click="closeSettings" class="cancel-btn">Cancel</button>
          <button @click="saveSettings" class="save-btn">Save Changes</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
}

.settings-panel {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  width: 100%;
  max-width: 900px;
  height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-primary);
  flex-shrink: 0;
}

.header-content h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* Main Content Layout */
.panel-content-wrapper {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Vertical Navigation */
.settings-nav {
  width: 200px;
  border-right: 1px solid var(--border);
  background: var(--bg-primary);
  flex-shrink: 0;
  overflow-y: auto;
}

.nav-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem;
}

.nav-item {
  width: 100%;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: none;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  font-size: 0.875rem;
  font-weight: 500;
  width: 100%;
  text-align: left;
}

.nav-link:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.nav-link.active {
  background: var(--bg-secondary);
  color: var(--primary);
}

.nav-label {
  flex: 1;
}

/* Content Area */
.panel-content {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-secondary);
}

.settings-section {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.content-header h2 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.content-header p {
  margin: 0 0 1.5rem;
  color: var(--text-secondary);
}

/* Settings row */
.setting-item {
  display: flex;
  flex-direction: column;
  padding: 1rem 0;
  gap: 0.75rem;
}

.setting-info h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-primary);
}

.setting-info p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.input-container {
  width: 100%;
  max-width: 400px;
}

.custom-input,
.custom-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.875rem;
  resize: vertical;
}

.custom-input:focus,
.custom-textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-a2);
}

.switch-root {
  width: 42px;
  height: 25px;
  background-color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 9999px;
  position: relative;
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  transition: background-color 100ms;
}

.switch-root[data-state='checked'] {
  background-color: var(--primary-600);
  border-color: var(--primary-600);
}

.switch-thumb {
  width: 21px;
  height: 21px;
  background-color: var(--border);
  border-radius: 9999px;
  box-shadow: 0 2px 2px var(--black-a7);
  transition: transform 100ms;
  transform: translateX(-8px);
  will-change: transform;
  position: relative;
  z-index: 1;
}

.dark .switch-thumb {
  background-color: var(--bg-primary);
}

.switch-thumb[data-state='checked'] {
  transform: translateX(8px);
  background-color: var(--bg-primary);
}

/* Info section */
.info-section h3 {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.version {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  color: var(--text-muted);
  font-weight: 500;
}

.info-section p {
  margin: 0 0 1.5rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* Footer */
.panel-footer {
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--border);
  background: var(--bg-primary);
  flex-shrink: 0;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.cancel-btn,
.save-btn {
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 2.5rem;
}

.cancel-btn {
  background: none;
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.cancel-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.save-btn {
  background: var(--primary);
  color: var(--primary-foreground);
  border: none;
}

.save-btn:hover {
  background: var(--primary-600);
}

/* Responsive */
@media (max-width: 768px) {
  .settings-nav {
    width: 60px;
  }

  .nav-label {
    display: none;
  }

  .settings-panel {
    height: 95vh;
  }

  .settings-content {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .input-container {
    max-width: 100%;
  }
}
</style>
