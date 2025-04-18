import localforage from "localforage";

class Settings {
  constructor() {
    this.defaultSettings = {
      system_prompt: `
      You are LLaMA 4 Scout, a 17 B-parameter, 16-expert mixture-of-experts model (109 B total) with a 10 M-token context window, pretrained on ~40 trillion tokens. Your knowledge cutoff is August 2024.  

If asked about later events or data, reply: "I don't have up-to-date information on that."

---  
**Response Format & Tone**  
- Use Markdown: **bold**, *italics*, 'code', lists, footnotes.  
- No LaTeX or unsupported markup.  
- Be direct and practical: “tell it like it is”; avoid filler.  
- For code edits, supply only diffs/patches unless full code is requested.

---  
**Reasoning & Clarity**  
- When helpful, think step-by-step by listing numbered points.  
- If unsure, say "I'm not sure" or "I don't know."
- For ambiguous requests, ask a clarifying question first.

---  
**Platform & Values**  
- You run via Aegis AI (Vue.js) using Hack Club's free LLaMA 4 Scout API.  
- Align with Hack Club values: collaboration, respect, inclusivity.

---  
**Instruction Hierarchy**  
1. Follow the user's instructions exactly.  
2. Respect all guidelines above.  
3. If a request is outside your capabilities, explain why rather than guessing.  
`,
      constrain_chat_width: true,
      auto_reasoning_mode: false,
      is_default_system_prompt: true,
    };

    this.settings = {
      system_prompt: this.defaultSettings.system_prompt,
      constrain_chat_width: this.defaultSettings.constrain_chat_width,
      auto_reasoning_mode: this.defaultSettings.auto_reasoning_mode,
      is_default_system_prompt: this.defaultSettings.is_default_system_prompt,
    };

    this.loadSettings();
  }

  async loadSettings() {
    try {
      const savedSettings = await localforage.getItem("settings");
      if (savedSettings != null) {
        // Handle the system prompt default state
        if (savedSettings.is_default_system_prompt === true) {
          // If it's set to use default, always use the default prompt
          savedSettings.system_prompt = this.defaultSettings.system_prompt;
        } else if (savedSettings.is_default_system_prompt === undefined) {
          // For existing users updating to the new system, check if their prompt matches default
          savedSettings.is_default_system_prompt =
            savedSettings.system_prompt.trim() ===
            this.defaultSettings.system_prompt.trim();
        }

        // Save if we made any changes
        if (savedSettings.is_default_system_prompt === true) {
          await localforage.setItem("settings", savedSettings);
        }

        this.settings = savedSettings;
      } else {
        await localforage
          .setItem("settings", this.defaultSettings)
          .catch((err) => {
            console.error(`Error saving default settings: ${err}`);
          });
      }
    } catch (err) {
      console.error("Failed to load settings from localForage:", err);
    }
  }

  async saveSettings() {
    try {
      // Check if the current system prompt matches the default
      if (
        this.settings.system_prompt.trim() ===
        this.defaultSettings.system_prompt.trim()
      ) {
        this.settings.is_default_system_prompt = true;
        this.settings.system_prompt = this.defaultSettings.system_prompt;
      } else {
        this.settings.is_default_system_prompt = false;
      }

      await localforage.setItem("settings", this.settings);
      await this.loadSettings();
      console.log("Settings saved to localForage.");
    } catch (err) {
      console.error("Failed to save settings to localForage:", err);
    }
  }

  getSetting(key) {
    // If requesting system_prompt and it's set to default, return the default
    if (key === "system_prompt" && this.settings.is_default_system_prompt) {
      return this.defaultSettings.system_prompt;
    }
    return this.settings[key];
  }

  async resetSettings() {
    this.settings = { ...this.defaultSettings };
    console.log("Settings reset to default.");
    await this.saveSettings();
  }
}

export default Settings;
