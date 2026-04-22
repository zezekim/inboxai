import "dotenv/config";
import { processEmail } from "../claude/agent.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fromName, subject, body, messageId, threadId } = req.body ?? {};
  const from = (req.body?.from || "").trim() || "unknown@unknown.com";

  if (!body) {
    return res.status(400).json({ error: "body is required" });
  }

  try {
    const result = await processEmail({ from, fromName, subject: subject || "(no subject)", body, messageId, threadId });
    res.json(result);
  } catch (err) {
    console.error("[processEmail error]", err.message);
    res.status(500).json({ error: err.message });
  }
}
