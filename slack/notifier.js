const URGENCY_EMOJI = {
  hot: "🔴",
  warm: "🟡",
  cold: "🟢",
  skip: "⚪",
};

const CATEGORY_LABEL = {
  lead_inquiry: "New Lead",
  existing_client: "Existing Client",
  agent_colleague: "Agent / Colleague",
  listing_related: "Listing / Vendor",
  spam: "Spam",
};

export async function postSlackCard({ from, fromName, subject, category, urgencyScore, urgencyLabel, reasoning, draft, emailId }) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("SLACK_WEBHOOK_URL not set");

  const emoji = URGENCY_EMOJI[urgencyLabel] ?? "⚪";
  const catLabel = CATEGORY_LABEL[category] ?? category;
  const sender = fromName ? `${fromName} <${from}>` : from;
  const draftPreview = draft ? draft.slice(0, 280) + (draft.length > 280 ? "…" : "") : "_No draft — marked as skip._";

  const payload = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${emoji} ${subject || "(no subject)"}`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*From:*\n${sender}` },
          { type: "mrkdwn", text: `*Classification:*\n${catLabel}` },
          { type: "mrkdwn", text: `*Urgency:*\n${emoji} ${urgencyLabel.toUpperCase()} (${urgencyScore}/5)` },
          { type: "mrkdwn", text: `*Why:*\n${reasoning}` },
        ],
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Draft Preview:*\n\`\`\`${draftPreview}\`\`\``,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Email ID: \`${emailId}\` · Review in Gmail Drafts`,
          },
        ],
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status} ${await res.text()}`);
  }
}
