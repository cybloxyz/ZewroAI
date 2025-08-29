# Aegis AI

Aegis AI is a **free, unlimited** AI ChatBot that uses various models through [Hack Club's free API](https://ai.hackclub.com).
Aegis AI does **not** sell your user information, and all chat & user data is stored locally, on your device. However, Hack Club does log all API usage.

## Features

- All data is stored locally on your device. No data is stored on the internet (outside of Hack Club's logs).
- Full Markdown Support.
- Support for multiple chats.
- Detailed code-blocks, including syntax highlighting, downloading, and a copy button.
- Customizable with name, occupation, and custom instructions.
- Reasoning is visible.

## Todo

Please suggest more ideas in the Issues tab.

- Improved Reasoning/Chain-of-Thought
- Canvas/Code Panel
- Tree-of-Thought (Split a reasoning thought into multiple seperate Chain-of-Thoughts, each running asynchronously)
- Tools (mainly search & code execution for the GPT-OSS models, which are handled automatically by Groq)
- Memory (used to be a feature, no longer available)

## VSCode Setup

[VSCode](https://code.visualstudio.com/).

### Clone Project and Move into Its Folder

```sh
git clone https://github.com/Mostlime12195/Quasar-AI-Chatbot.git
cd quasar-ai-chatbot
```

### Install Dependencies

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```
