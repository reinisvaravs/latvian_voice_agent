import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check for required environment variables
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY is required in .env file");
  console.error(
    "Please copy env-template.txt to .env and add your OpenAI API key"
  );
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

app.post(
  "/realtime/sdp",
  express.text({ type: "application/sdp" }),
  async (req, res) => {
    try {
      const offerSdp = req.body;
      if (!offerSdp || !offerSdp.includes("v=")) {
        return res.status(400).send("Invalid SDP offer");
      }

      const model =
        process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview-2024-10";
      const voice = process.env.OPENAI_TTS_VOICE || "alloy";

      const r = await fetch(
        `https://api.openai.com/v1/realtime?model=${encodeURIComponent(
          model
        )}&voice=${encodeURIComponent(voice)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/sdp",
            "OpenAI-Beta": "realtime=v1",
          },
          body: offerSdp,
        }
      );

      if (!r.ok) {
        const text = await r.text();
        console.error("OpenAI SDP error:", r.status, text);
        return res.status(502).send(text || "Upstream SDP exchange failed");
      }

      const answerSdp = await r.text();
      res.setHeader("Content-Type", "application/sdp");
      res.status(200).send(answerSdp);
    } catch (err) {
      console.error(err);
      res.status(500).send("SDP exchange failed");
    }
  }
);

// Serve static client files
app.use(express.static(path.join(__dirname, "public")));

// Fallback route - serve index.html for SPA
app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
