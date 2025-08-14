# LV Voice Agent MVP - Claude + ElevenLabs

Simple Latvian voice agent using Claude for text generation and ElevenLabs for voice synthesis.

## Setup

1. **Get API Keys:**

   - [Claude API Key](https://console.anthropic.com/) (Anthropic)
   - [ElevenLabs API Key](https://elevenlabs.io/) (ElevenLabs)

2. **Configure Environment:**

   ```bash
   cp env-template.txt .env
   # Edit .env and add your API keys
   ```

3. **Install & Run:**

   ```bash
   npm install
   npm start
   ```

4. **Open Browser:**
   Navigate to `http://localhost:3000`

## How It Works

1. **Click "Start Agent"** - Starts recording
2. **Speak in Latvian** - Your voice is recorded
3. **Click "Stop"** - Audio is processed
4. **Claude generates text** - Best Latvian responses
5. **ElevenLabs creates voice** - Excellent pronunciation
6. **Audio plays back** - Instant response

## Features

- ✅ **Best Latvian text** (Claude 3.5 Sonnet)
- ✅ **Best Latvian voice** (ElevenLabs multilingual)
- ✅ **Simple recording** (no WebRTC complexity)
- ✅ **Instant responses** (streaming audio)
- ✅ **Mute functionality** (control your microphone)

## API Keys Required

- **CLAUDE_API_KEY**: Anthropic Claude API access
- **ELEVENLABS_API_KEY**: ElevenLabs voice synthesis

## Simple MVP

This is a minimal working version focused on:

- Getting it working quickly
- Best possible Latvian quality
- Simple, reliable code
- No unnecessary features
