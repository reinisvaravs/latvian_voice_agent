import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check for required environment variables
if (!process.env.CLAUDE_API_KEY) {
  console.error("❌ CLAUDE_API_KEY is required in .env file");
  process.exit(1);
}

if (!process.env.AZURE_SPEECH_KEY) {
  console.error("❌ AZURE_SPEECH_KEY is required in .env file");
  process.exit(1);
}

if (!process.env.AZURE_SPEECH_REGION) {
  console.error("❌ AZURE_SPEECH_REGION is required in .env file");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Test Azure Speech Service endpoint
app.get("/test-azure", async (req, res) => {
  try {
    console.log("🧪 Testing Azure Speech Service...");

    // Test 1: Check if we can reach Azure
    console.log("🧪 Test 1: Testing Azure connectivity...");
    const testResponse = await fetch(
      `https://${process.env.AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=lv-LV`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY,
          "Content-Type": "audio/wav",
          Accept: "application/json",
        },
        body: Buffer.from("test"), // Send minimal test data
      }
    );

    console.log("🧪 Azure response status:", testResponse.status);
    console.log(
      "🧪 Azure response headers:",
      Object.fromEntries(testResponse.headers.entries())
    );

    if (testResponse.status === 401) {
      return res.json({
        error: "❌ API Key Authentication Failed",
        status: testResponse.status,
        message: "Your Azure Speech Service API key is invalid or expired",
      });
    }

    if (testResponse.status === 403) {
      return res.json({
        error: "❌ API Key Access Denied",
        status: testResponse.status,
        message: "Your API key doesn't have access to Speech Service",
      });
    }

    if (testResponse.status === 400) {
      return res.json({
        error: "❌ Bad Request",
        status: testResponse.status,
        message: "Azure received the request but rejected the audio format",
      });
    }

    return res.json({
      success: "✅ Azure Speech Service is accessible",
      status: testResponse.status,
      message: "API key is working, Latvian language should be supported",
      region: process.env.AZURE_SPEECH_REGION,
      language: "lv-LV (Latvian)",
    });
  } catch (error) {
    console.error("🧪 Azure test error:", error);
    return res.status(500).json({
      error: "❌ Azure test failed",
      message: error.message,
    });
  }
});

// Health check for Latvian speech recognition
app.get("/health-latvian", async (req, res) => {
  try {
    console.log("🏥 Health check for Latvian speech recognition...");

    // Test TTS with Latvian
    const ttsResponse = await fetch(
      `https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
        },
        body: `<speak version='1.0' xml:lang='lv-LV'>
          <voice xml:lang='lv-LV' xml:gender='Female' name='lv-LV-EveritaNeural'>
            Sveiki! Es esmu jūsu latviešu valodas palīgs.
          </voice>
        </speak>`,
      }
    );

    const status = {
      azure_region: process.env.AZURE_SPEECH_REGION,
      latvian_tts: ttsResponse.ok ? "✅ Working" : "❌ Failed",
      tts_status: ttsResponse.status,
      speech_recognition: "✅ Configured for lv-LV",
      claude_api: process.env.CLAUDE_API_KEY ? "✅ Configured" : "❌ Missing",
      overall: "✅ Healthy",
    };

    if (!ttsResponse.ok) {
      status.overall = "⚠️ TTS Issues";
      status.latvian_tts = `❌ Failed (${ttsResponse.status})`;
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({
      overall: "❌ Unhealthy",
      error: error.message,
      azure_region: process.env.AZURE_SPEECH_REGION,
    });
  }
});

// Test transcription endpoint for audio tester
app.post("/test-transcription", async (req, res) => {
  try {
    console.log("🧪 POST /test-transcription called (Audio Tester)");
    const { audio } = req.body;

    if (!audio) {
      return res.status(400).json({ error: "No audio provided" });
    }

    console.log("🧪 Converting test audio to buffer...");
    const audioBuffer = Buffer.from(audio, "base64");
    console.log("🧪 Test audio buffer size:", audioBuffer.length);

    if (audioBuffer.length < 1000) {
      console.log(
        "🧪 ⚠️ Test audio buffer very small, might be recording issue"
      );
    }

    console.log("🧪 Calling Azure Speech Service for test...");
    const transcription = await getAzureSpeechToText(audioBuffer);

    console.log("🧪 Test transcription result:", transcription);

    if (transcription && !transcription.includes("nevarēju saprast")) {
      console.log("🧪 ✅ Test transcription successful!");
      res.json({
        transcription: transcription,
        success: true,
        audioSize: audioBuffer.length,
      });
    } else {
      console.log("🧪 ❌ Test transcription failed");
      res.json({
        transcription: null,
        success: false,
        audioSize: audioBuffer.length,
        error: "No speech detected",
      });
    }
  } catch (err) {
    console.error("🧪 ❌ Error in test-transcription:", err);
    res.status(500).json({
      error: "Test transcription failed",
      details: err.message,
      success: false,
    });
  }
});

// Process audio endpoint
app.post("/process-audio", async (req, res) => {
  try {
    console.log("🔄 POST /process-audio called");
    const { audio } = req.body;

    if (!audio) {
      return res.status(400).json({ error: "No audio provided" });
    }

    console.log("🔄 Converting audio to buffer...");
    const audioBuffer = Buffer.from(audio, "base64");
    console.log("🔄 Audio buffer size:", audioBuffer.length);

    if (audioBuffer.length < 1000) {
      console.log("⚠️ Audio buffer very small, might be recording issue");
    }

    console.log("🔄 Calling getAzureSpeechToText...");
    const userMessage = await getAzureSpeechToText(audioBuffer);
    console.log("🎤 User said:", userMessage);

    if (userMessage.includes("nevarēju saprast")) {
      console.log("⚠️ Speech recognition failed, user message is fallback");
    }

    console.log("🔄 Calling getClaudeResponse...");
    const claudeResponse = await getClaudeResponse(userMessage);
    console.log("💬 Claude response:", claudeResponse);

    console.log("🔄 Calling getAzureSpeechVoice...");
    const azureAudio = await getAzureSpeechVoice(claudeResponse);
    console.log("🔊 Azure audio generated");

    if (!azureAudio) {
      console.log("❌ TTS failed, sending text-only response");
      return res.json({
        text: claudeResponse,
        audio: null,
        userMessage: userMessage,
        error: "TTS generation failed",
      });
    }

    console.log("🔄 Sending response...");
    res.json({
      text: claudeResponse,
      audio: azureAudio,
      userMessage: userMessage,
    });
    console.log("✅ Response sent successfully");
  } catch (err) {
    console.error("❌ Error in /process-audio:", err);
    res
      .status(500)
      .json({ error: "Failed to process audio", details: err.message });
  }
});

// Get response from Claude
async function getClaudeResponse(userMessage) {
  console.log("🔍 getClaudeResponse called with:", userMessage);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `Tu esi draudzīgs latviešu valodas palīgs. Lietotājs tev saka: "${userMessage}". Atbildi konkrēti uz to, ko viņš teica. Ja viņš sveicina, atbildi ar sveicienu. Ja viņš jautā kaut ko, atbildi uz jautājumu. Ja viņš pastāsta kaut ko, reaģē uz to. Būi draudzīgs, profesionāls un īss. Atbildi TIKAI latviešu valodā.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("🔍 Claude API response received");
    return data.content[0].text;
  } catch (error) {
    console.error("❌ Claude API error:", error);
    return "Atvainojiet, radās kļūda. Lūdzu mēģiniet vēlreiz.";
  }
}

// Get voice from Azure Speech Service
async function getAzureSpeechVoice(text) {
  console.log("🔍 getAzureSpeechVoice called with:", text);
  try {
    const response = await fetch(
      `https://${process.env.AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/speechsynthesis/synthesize`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
          "User-Agent": "LVVoiceAgent",
        },
        body: `<speak version='1.0' xml:lang='lv-LV'>
          <voice xml:lang='lv-LV' xml:gender='Female' name='lv-LV-EveritaNeural'>
            <prosody rate="+5%" pitch="+0%" volume="+0%">
              ${text}
            </prosody>
          </voice>
        </speak>`,
      }
    );

    if (!response.ok) {
      throw new Error(`Azure Speech API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    console.log("🔍 Azure TTS response received");
    return Buffer.from(audioBuffer).toString("base64");
  } catch (error) {
    console.error("❌ Azure Speech API error:", error);
    return null;
  }
}

// Get speech-to-text from Azure
async function getAzureSpeechToText(audioBuffer) {
  console.log(
    "🔍 getAzureSpeechToText called with buffer size:",
    audioBuffer.length
  );

  // Try Latvian first (primary language) with optimized settings
  console.log("🎯 Trying Latvian speech recognition...");

  const contentTypes = [
    "audio/webm;codecs=opus", // Best for Azure, matches frontend
    "audio/webm", // Good fallback
    "audio/wav", // Less compatible but worth trying
    "audio/raw", // Last resort
  ];

  for (const contentType of contentTypes) {
    try {
      console.log(`🎯 Trying ${contentType} for Latvian...`);

      const response = await fetch(
        `https://${process.env.AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=lv-LV&format=detailed&profanity=raw&punctuation=true&diarizationEnabled=false`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY,
            "Content-Type": contentType,
            Accept: "application/json",
          },
          body: audioBuffer,
        }
      );

      if (!response.ok) {
        console.log(`❌ ${contentType} failed with status: ${response.status}`);
        continue;
      }

      const data = await response.json();
      console.log(`✅ ${contentType} response:`, data);

      if (
        data.RecognitionStatus === "Success" &&
        data.DisplayText &&
        data.DisplayText.trim() !== ""
      ) {
        console.log("✅ Latvian speech recognized:", data.DisplayText);
        return data.DisplayText;
      } else if (
        data.RecognitionStatus === "Success" &&
        data.NBest &&
        data.NBest.length > 0 &&
        data.NBest[0].Display &&
        data.NBest[0].Display.trim() !== ""
      ) {
        console.log(
          "✅ Latvian speech recognized (NBest):",
          data.NBest[0].Display
        );
        return data.NBest[0].Display;
      } else if (
        data.RecognitionStatus === "Success" &&
        data.NBest &&
        data.NBest.length > 0 &&
        data.NBest[0].Lexical &&
        data.NBest[0].Lexical.trim() !== ""
      ) {
        console.log(
          "✅ Latvian speech recognized (Lexical):",
          data.NBest[0].Lexical
        );
        return data.NBest[0].Lexical;
      } else {
        console.log(`⚠️ ${contentType} succeeded but no speech detected`);
        continue;
      }
    } catch (error) {
      console.log(`❌ ${contentType} error:`, error.message);
      continue;
    }
  }

  // Fallback to English if Latvian fails
  console.log("🔄 Latvian failed, trying English as fallback...");
  try {
    const englishResponse = await fetch(
      `https://${process.env.AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed&profanity=raw&punctuation=true`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY,
          "Content-Type": "audio/webm;codecs=opus",
          Accept: "application/json",
        },
        body: audioBuffer,
      }
    );

    if (englishResponse.ok) {
      const englishData = await englishResponse.json();
      console.log("🧪 English fallback response:", englishData);

      if (
        englishData.RecognitionStatus === "Success" &&
        englishData.DisplayText &&
        englishData.DisplayText.trim() !== ""
      ) {
        console.log("✅ English speech recognized:", englishData.DisplayText);
        return englishData.DisplayText;
      }
    }
  } catch (error) {
    console.log("🧪 English fallback failed:", error.message);
  }

  console.log("❌ All language attempts failed");
  return "Es nevarēju saprast, ko jūs teicāt. Lūdzu, mēģiniet vēlreiz.";
}

// Serve static client files
app.use(express.static(path.join(__dirname, "public")));

// Fallback route - serve index.html for SPA
app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log("✅ Claude + Azure Speech Service MVP ready!");
});
