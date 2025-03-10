# Unofficial HackClub AI ChatBot

An AI ChatBot that uses DeepSeek V3 through [HackClub's free API](https://ai.hackclub.com).

## Features

- Chat data is stored locally on your device. No data is stored on the internet.
- Full Markdown Support (excluding math LaTex syntax).
- Supports for multiple chats.
- Detailed code-blocks, including syntax highlighting based on the language and a quick-copy button.

## Todo

- [x] Memory and chat persistence
- [x] Multiple chats at any one time
- [ ] Customizable system prompt
- [ ] Working memory between conversations
- [x] Better code support (copy button, etc.)

## VSCode Setup

[VSCode](https://code.visualstudio.com/).

### Clone Project and Move into Its Folder

```sh
git clone https://github.com/Mostlime12195/Hackclub-AI-Chatbot.git
cd hackclub-ai-chatbot
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
