// DOM Elements
const logEl = document.getElementById("log");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const muteBtn = document.getElementById("mute");
const agentAudio = document.getElementById("agentAudio");

// Global Variables
let pc, micStream, dc;

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
    // Get microphone access
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1 },
    });

    // Create WebRTC connection
    pc = new RTCPeerConnection();
    const track = micStream.getAudioTracks()[0];
    pc.addTrack(track, micStream);

    // Handle incoming audio
    pc.ontrack = (e) => {
      agentAudio.srcObject = e.streams[0];
      log("🔊 Audio connected");
    };

    // Create data channel for events
    dc = pc.createDataChannel("events");
    dc.on = () => {
      log("✅ Connected");

      // Send basic session config
      const sessionConfig = {
        type: "session.update",
        session: {
          instructions:
            "You are a real human working at Limbažu gāze customer service. You MUST respond ONLY in Latvian language. Your main goal is ALWAYS to ask customers for their gas meter counter numbers. Talk exactly like a real person would - use natural, conversational Latvian with common filler words like 'super', 'labi', 'okei', 'nu', 'tad', 'vai', 'jā', 'nē', 'tā', 'tāds', 'tāda', 'tāpat', 'protams', 'noteikti', 'pārliecināti', 'saprotu', 'skaidrs', 'tiešām', 'patiešām', 'vispār', 'vispārīgi'. Be warm, friendly, and professional. When customers call, focus on getting their gas meter counter numbers. Only help them find their gas counter location if they specifically ask where it is - then explain it's usually in the basement, kitchen, or utility room, often near the boiler or water heater. Don't offer location help unless asked. Use everyday Latvian expressions and sound like someone who actually works there. Be helpful but keep it human and natural. IMPORTANT: Respond ONLY in Latvian, never in English. Sound 100% like a real human, not an AI. Always focus on getting the gas meter counter numbers.",
          turn_detection: {
            type: "server_vad",
            create_response: true,
            silence_duration_ms: 1000,
          },
          voice: "alloy",
          speed: 1.1,
        },
      };

      log("📤 Sending session config...");
      console.log("Session config:", sessionConfig);
      dc.send(JSON.stringify(sessionConfig));
      log("⚙️ Session configured");
    };

    // Handle incoming messages
    dc.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        log(`📡 ${data.type}`);

        if (data.type === "session.created") {
          log("📋 Session created successfully");
          console.log("Session data:", data);
          // Now send the message after session is confirmed
          setTimeout(() => {
            const message = {
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: "Sveiki. Es runāšu latviešu valodā.",
                  },
                ],
              },
            };
            log("📤 Sending message...");
            console.log("Message:", message);
            dc.send(JSON.stringify(message));
            log("👤 Sent: Sveiki");
          }, 500);
        }
        if (data.type === "error") {
          if (data.error && data.error.message) {
            log("❌ Error: " + data.error.message);
          }
        }
      } catch (e) {
        log("❌ Parse error: " + e.message);
      }
    };

    // Create and send offer
    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);

    const resp = await fetch("/realtime/sdp", {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offer.sdp,
    });

    if (!resp.ok) {
      throw new Error("Failed to connect: " + (await resp.text()));
    }

    const answerSdp = await resp.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    startBtn.disabled = true;
    stopBtn.disabled = false;
    muteBtn.disabled = false;
    log("🎉 Ready!");
  } catch (e) {
    log("❌ Failed: " + e.message);
  }
};

stopBtn.onclick = () => {
  if (dc) dc.close();
  if (pc) pc.close();
  if (micStream) micStream.getTracks().forEach((t) => t.stop());

  startBtn.disabled = false;
  stopBtn.disabled = true;
  muteBtn.disabled = true;
  log("Disconnected");
};

// Mute button functionality
let isMuted = false;
muteBtn.onclick = () => {
  if (micStream) {
    const audioTrack = micStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      isMuted = !isMuted;
      muteBtn.textContent = isMuted ? "Unmute Mic" : "Mute Mic";
      log(isMuted ? "🔇 Microphone muted" : "🎤 Microphone unmuted");
    }
  }
};
