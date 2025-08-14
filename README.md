# LV Voice Agent MVP

A Latvian language voice agent built with OpenAI's Realtime API.

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment variables:**

   - Copy `env-template.txt` to `.env`
   - Add your OpenAI API key to `OPENAI_API_KEY`
   - Optionally customize other settings

3. **Start the server:**

   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## Requirements

- OpenAI API key with access to Realtime API
- Modern browser with WebRTC support
- Microphone access

## Troubleshooting

### "Unknown event" errors

The app now properly handles `response.created` and `response.done` events. If you still see unknown events, check the browser console for full event data.

### Connection issues

- Ensure your `.env` file has a valid `OPENAI_API_KEY`
- Check that the OpenAI Realtime API is available in your account
- Verify microphone permissions in your browser

### Audio issues

- Check browser console for WebRTC errors
- Ensure microphone is not being used by other applications
- Try refreshing the page and granting microphone permissions again

## Features

- Real-time voice conversation in Latvian
- Automatic turn detection
- Configurable AI personality and settings
- WebRTC-based audio streaming
