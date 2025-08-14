// DOM Elements
const logEl = document.getElementById("log");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const muteBtn = document.getElementById("mute");

// Global Variables
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];

// Utility Functions
function log(msg) {
  console.log(msg);
  const now = new Date();
  const time = now.toLocaleTimeString();
  const formattedMsg = `[${time}] ${msg}`;
  logEl.textContent += formattedMsg + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

// Event Handlers
startBtn.onclick = async () => {
  try {
    log("🎤 Starting recording...");

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: false, // Disable echo cancellation for better quality
        noiseSuppression: false, // Disable noise suppression for better quality
        autoGainControl: true, // Enable auto gain control
        volume: 1.0, // Maximum volume
      },
    });

    // Add audio level monitoring
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    source.connect(analyser);

    // Monitor audio levels
    const checkAudioLevel = () => {
      if (isRecording) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

        if (average > 10) {
          log("🔊 Audio detected - speaking detected");
        }

        setTimeout(checkAudioLevel, 1000);
      }
    };
    checkAudioLevel();

    // Try different audio formats for better Azure compatibility
    let mimeType = "audio/wav";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/webm";
      }
    }

    log("🎵 Using audio format: " + mimeType);

    mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      audioBitsPerSecond: 128000, // Higher bitrate for better quality
    });
    isRecording = true;

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      log("⏹️ Recording stopped, processing...");
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      await processAudio(audioBlob);
      audioChunks = [];
    };

    mediaRecorder.start();
    log("🎤 Started recording");
    log("💡 Speak clearly and loudly for best recognition!");
    log("🔊 Audio monitoring active - speak to see audio levels");

    startBtn.disabled = true;
    stopBtn.disabled = false;
    muteBtn.disabled = false;
  } catch (e) {
    log("❌ Failed to start: " + e.message);
  }
};

stopBtn.onclick = () => {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;

    if (mediaRecorder.stream) {
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    }

    startBtn.disabled = false;
    stopBtn.disabled = true;
    muteBtn.disabled = true;
    log("⏹️ Stopped recording");
  }
};

// Mute button functionality
let isMuted = false;
muteBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.stream) {
    const audioTrack = mediaRecorder.stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      isMuted = !isMuted;
      muteBtn.textContent = isMuted ? "Unmute Mic" : "Mute Mic";
      log(isMuted ? "🔇 Microphone muted" : "🎤 Microphone unmuted");
    }
  }
};

// Process audio and get response
async function processAudio(audioBlob) {
  try {
    log("🔄 Processing audio...");
    log("📊 Audio blob size: " + audioBlob.size + " bytes");

    // Convert audio to base64
    log("🔄 Converting to base64...");
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer))
    );
    log("✅ Base64 conversion complete");

    log("📤 Sending to server...");

    // Send to server for processing
    const response = await fetch("/process-audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: base64Audio }),
    });

    log("📥 Response received: " + response.status);

    if (!response.ok) {
      throw new Error("Failed to process audio: " + response.status);
    }

    const result = await response.json();
    log("📥 JSON parsed successfully");

    if (result.userMessage) {
      log("👤 You said: " + result.userMessage);
    }

    if (result.text) {
      log("💬 AI: " + result.text);
    }

    if (result.audio) {
      log("🔊 Playing audio response...");
      const audio = new Audio("data:audio/mp3;base64," + result.audio);
      audio.onerror = (e) => log("❌ Audio playback error: " + e.message);
      audio.onplay = () => log("🔊 Playing AI response");
      audio.play();
    } else {
      log("⚠️ No audio received from server");
    }

    log("✅ Audio processing complete");
  } catch (e) {
    log("❌ Error processing audio: " + e.message);
    console.error("Full error:", e);
  }
}
