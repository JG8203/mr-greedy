# Inwosent - Canvas Quiz Helper

> A Chrome extension that enhances your Canvas quiz experience with tracking prevention and AI-powered answers

## What is Inwosent?

Inwosent (pronounced "innocent") is a Chrome extension designed to help students with Canvas quizzes in two main ways:

1. **Tracking Prevention**: Disables various tracking mechanisms that Canvas uses to monitor student activity during quizzes
2. **AI-Powered Answers**: Integrates with OpenRouter API to provide AI-generated answers to quiz questions

## Features

### Tracking Prevention
- Blocks window event tracking (mouseleave, beforeunload, focus, blur)
- Prevents page visibility API tracking
- Works on any Canvas instance you specify

### AI Answer Integration
- Connects to OpenRouter API to access various AI models
- Supports multiple AI models including:
  - OpenAI (o1-preview, GPT-4o, o3-mini-high)
  - DeepSeek (R1, Chat)
  - Qwen (32B, Max)
  - Google Gemini 2.0 Flash
  - Anthropic Claude 3.7 Sonnet
- Injects AI-generated answers directly into the quiz page
- Formats answers with markdown support
- Answers are invisible to Canvas but selectable by you

## Installation

1. Check if your `Node.js` version is >= **14**
2. Clone this repository
3. Run `npm install` to install the dependencies
4. Run `npm run build` to build the extension

### Loading the Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top-right corner
3. Click "Load unpacked" and select the `build` folder from this project

## Usage

1. Click on the Inwosent extension icon in your browser
2. Enter your Canvas URL (e.g., "canvas.university.edu")
3. Toggle "Disable Tracking" to prevent Canvas from monitoring your activity
4. Enter your OpenRouter API key (get one at [openrouter.ai](https://openrouter.ai))
5. Select your preferred AI model
6. Toggle "Inject API Response" to enable AI-generated answers
7. Click "Save Preferences"
8. When taking a quiz, click "Get AI Answers" to generate answers for all questions

## Development

Run the development server:

```shell
$ npm run dev
```

### Development Modes

#### Chrome Extension Developer Mode
1. Set your Chrome browser 'Developer mode' up
2. Click 'Load unpacked', and select the `build` folder

#### Frontend Developer Mode
1. Access `http://0.0.0.0:3000/`
2. For debugging popup page, open `http://0.0.0.0:3000/popup.html`
3. For debugging options page, open `http://0.0.0.0:3000/options.html`

## Building for Production

```shell
$ npm run build
```

The content of the `build` folder will be the extension ready to be submitted to the Chrome Web Store.

## Legal Disclaimer

This extension is provided for educational purposes only. Users are responsible for ensuring compliance with their institution's academic integrity policies and applicable laws. The developers of Inwosent do not endorse or encourage academic dishonesty.

---

Built with Vite + React and Manifest v3
