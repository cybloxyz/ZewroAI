# Aegis AI

Aegis AI is an AI ChatBot that uses LLaMA 3.3 70b through [HackClub's free API](https://ai.hackclub.com).

## Features

- Chat data is stored locally on your device. No data is stored on the internet.
- Full Markdown Support (excluding math LaTex syntax).
- Supports for multiple chats.
- Detailed code-blocks, including syntax highlighting based on the language and a quick-copy button.
- Customizeable system prompt.
- Cross-chat memory (similar to ChatGPT's functionality).

## Todo

Please suggest more ideas in the Issues tab.

### V1

- [x] ~~Memory and chat persistence~~
- [x] ~~Multiple chats at any one time~~
- [x] ~~Customizable system prompt~~
- [x] ~~Working memory between conversations~~
- [x] ~~Better code support (copy button, etc.)~~

### V2

- [x] ~~Reasoning/Chain-of-Thought functionality~~ (Is implemented through prompt-chaining & CoT prompting)
- [ ] Search capabilities

## VSCode Setup

[VSCode](https://code.visualstudio.com/).

### Clone Project and Move into Its Folder

```sh
git clone https://github.com/Mostlime12195/Quasar-AI-Chatbot.git
cd quasar-ai-chatbot
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```
