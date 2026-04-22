import Anthropic from "@anthropic-ai/sdk";
import { PAUL_SMITH_KB } from "../knowledge/paul-smith-kb.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `${PAUL_SMITH_KB}

## Your Task
When given an incoming email, you must:
1. Classify it into exactly one category
2. Score urgency 1–5 (5 = most urgent, 1 = no urgency)
3. Assign an urgency label
4. Draft a reply in Paul's voice

## Categories
- lead_inquiry — new potential buyer or seller who hasn't worked with Paul before
- existing_client — someone currently in a transaction or past client following up
- agent_colleague — another realtor, broker, or someone from the industry
- listing_related — builder, developer, inspector, stager, photographer, vendor
- spam — newsletter, cold outreach, irrelevant, automated

## Urgency Labels
- hot (score 4–5) — new buyer/seller lead, time-sensitive decision, active client emergency
- warm (score 2–3) — existing client question, follow-up needed within 24–48h
- cold (score 1) — general inquiry, no rush
- skip (score 0) — spam, newsletters, no reply needed

## Output Format
Respond ONLY with a valid JSON object, no markdown, no explanation:
{
  "category": "lead_inquiry|existing_client|agent_colleague|listing_related|spam",
  "urgencyScore": 0-5,
  "urgencyLabel": "hot|warm|cold|skip",
  "reasoning": "one sentence explaining the classification",
  "draft": "the full email reply text, including greeting and Paul's signature"
}

For spam/skip emails, set draft to an empty string "".
`;

export async function processEmail({ from, fromName, subject, body, messageId, threadId }) {
  const emailContent = `
FROM: ${fromName ? `${fromName} <${from}>` : from}
SUBJECT: ${subject}
---
${body}
`.trim();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Process this incoming email:\n\n${emailContent}`,
      },
    ],
  });

  const raw = response.content[0].text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    const result = JSON.parse(raw);
    return {
      ...result,
      inputTokens: response.usage.input_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
      outputTokens: response.usage.output_tokens,
    };
  } catch {
    throw new Error(`Claude returned invalid JSON: ${raw.slice(0, 200)}`);
  }
}
