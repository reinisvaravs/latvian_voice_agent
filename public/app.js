// DOM Elements
const logEl = document.getElementById("log");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const muteBtn = document.getElementById("mute");

// Global Variables
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingStartTime = null;

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
        echoCancellation: true, // Enable for better quality
        noiseSuppression: true, // Enable for better quality
        autoGainControl: true, // Keep enabled
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

    // Use proper audio format for Azure compatibility
    let mimeType = "audio/webm;codecs=opus"; // Best for Azure
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/mp4";
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

      // Check recording duration
      const recordingDuration =
        audioChunks.length > 0
          ? (audioChunks.reduce((total, chunk) => total + chunk.size, 0) /
              128000) *
            8
          : 0;

      if (recordingDuration < 1.5) {
        log(
          "⚠️ Recording too short (" +
            recordingDuration.toFixed(1) +
            "s). Please record at least 2 seconds."
        );
        audioChunks = [];
        return;
      }

      const audioBlob = new Blob(audioChunks, { type: mimeType });
      await processAudio(audioBlob);
      audioChunks = [];
    };

    mediaRecorder.start();
    recordingStartTime = Date.now();

    // Start recording timer
    recordingTimer = setInterval(() => {
      if (isRecording) {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        log(`⏱️ Recording: ${elapsed}s (speak clearly!)`);
      }
    }, 1000);

    log("🎤 Started recording");
    log("💡 Speak clearly and loudly for best recognition!");
    log("🔊 Audio monitoring active - speak to see audio levels");
    log("⏱️ Record at least 2 seconds for best results");

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

    // Clear recording timer
    if (recordingTimer) {
      clearInterval(recordingTimer);
      recordingTimer = null;
    }

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

    // Convert audio to base64 properly
    log("🔄 Converting to base64...");
    const arrayBuffer = await audioBlob.arrayBuffer();

    // Use proper base64 encoding for binary data
    const base64Audio = arrayBufferToBase64(arrayBuffer);
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

// Proper base64 encoding for binary data
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
