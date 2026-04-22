import "dotenv/config";
import express from "express";
import { processEmail } from "./agent.js";

const app = express();
app.use(express.json());

app.post("/process", async (req, res) => {
  const { from, fromName, subject, body, messageId, threadId } = req.body;

  if (!from || !subject || !body) {
    return res.status(400).json({ error: "from, subject, and body are required" });
  }

  try {
    const result = await processEmail({ from, fromName, subject, body, messageId, threadId });
    res.json(result);
  } catch (err) {
    console.error("[processEmail error]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`InboxAI server running on :${PORT}`));
