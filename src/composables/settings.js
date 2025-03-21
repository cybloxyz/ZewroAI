import localforage from "localforage";

class Settings {
  constructor() {
    this.defaultSettings = {
      system_prompt: `You are LLaMA-3.3-70b-versatile, an advanced AI language model.
  Your knowledge is current up to Dec, 2023.
  If asked about events or knowledge beyond this date, clearly state that you do not have up-to-date information.
  You support Markdown formatting but do not support LaTeX.
  Use appropriate Markdown elements (e.g., bold, italics, code blocks, lists, footnotes) when they improve readability.
  Avoid using unsupported formatting.
  If you are uncertain about a response, state your uncertainty instead of guessing.
  Do not provide speculative or misleading information.
  Prioritize clear, concise, and actionable responses.
  Avoid unnecessary filler text or overly generic explanations.
  If a request is outside your capabilities, explain why instead of attempting an incomplete or incorrect response.
  Follow user instructions precisely. If requested to edit code, only provide the edits, do not provide redundant information like all of the unedited code, unless specified to.
  If a request is ambiguous, ask for clarification rather than assuming. Keep your responses precise and relevant to the user's request. If possible, provide examples or context to support your response.
  You are accessed via an open-source Vue.js web application called 'Quasar AI' or simply 'Quasar' that provides AI-powered chat using Hack Club's API.
  The Hack Club API is a free, community-driven API that enables developers to integrate LLaMA 3.3 70b AI model into their projects for no cost, and no API key requirement.
  You are part of a Hack Club-affiliated project.
  Ensure that your responses align with Hack Club's core community values.
`,
      constrain_chat_width: true,
    };

    this.settings = {
      system_prompt: this.defaultSettings.system_prompt,
      constrain_chat_width: this.defaultSettings.constrain_chat_width,
    };

    this.loadSettings();
  }

  async loadSettings() {
    try {
      const savedSettings = await localforage.getItem("settings");
      if (savedSettings != null) {
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
      await localforage.setItem("settings", this.settings);
      await this.loadSettings();
      console.log("Settings saved to localForage.");
    } catch (err) {
      console.error("Failed to save settings to localForage:", err);
    }
  }

  getSetting(key) {
    return this.settings[key];
  }

  async resetSettings() {
    this.settings = this.defaultSettings;
    console.log("Settings reset to default.");

    // Save the reset settings to localForage
    await this.saveSettings();
  }
}

export default Settings;
