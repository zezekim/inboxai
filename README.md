# InboxAI

An AI-powered email triage and draft generation system for real estate professionals. InboxAI connects to Gmail via n8n, classifies incoming emails with Claude, generates personalized draft replies, stores everything in Supabase, and presents a review dashboard — all without touching your inbox until you say send.

---

## Overview

InboxAI was built for **Paul Smith, GRI** at **Twelve Rivers Realty** in Austin, Texas. Every unread Gmail is automatically:

1. Pulled from Gmail every 5 minutes via n8n
2. Classified into one of 5 categories with an urgency score
3. Drafted by Claude in Paul's voice using a detailed knowledge base
4. Stored in Supabase
5. Saved as a Gmail draft (unsent)
6. Sent as a Slack notification for immediate awareness
7. Available for review and editing in the web dashboard

---

## Features

- **5-Category Email Classification** — `lead_inquiry`, `existing_client`, `agent_colleague`, `listing_related`, `spam`
- **Urgency Scoring (0–5)** — `hot` (4–5), `warm` (2–3), `cold` (1), `skip` (0/spam)
- **AI Draft Generation** — Claude writes replies in Paul's voice, with reasoning and full signature
- **Prompt Caching** — Knowledge base is cached with Anthropic's ephemeral cache for efficient token use
- **Gmail Draft Creation** — Drafts are saved in Gmail (not auto-sent) and linked to the original thread
- **Slack Notifications** — Real-time alerts with classification, urgency, reasoning, and draft preview
- **Web Dashboard** — Side-by-side view of original email and AI draft; edit, approve, or discard; auto-saves
- **Status Tracking** — `pending → reviewed → sent / discarded`

---

## Tech Stack

| Layer | Technology |
|---|---|
| AI / LLM | Anthropic Claude API (`claude-sonnet-4-6`) |
| Backend | Node.js (v20+, ES modules), Express.js |
| Serverless | Vercel (API functions) |
| Workflow | n8n (self-hosted or cloud) |
| Database | Supabase (PostgreSQL + RLS) |
| Frontend | Vanilla JS, Tailwind CSS (CDN), Supabase JS v2 |
| Notifications | Slack Incoming Webhooks |
| Email | Gmail API (via n8n OAuth2) |

---

## Architecture

```
Gmail (unread emails, every 5 min)
        │
        ▼
   n8n Workflow
        │
        ├─► Normalize email (from, subject, body, date)
        │
        ├─► POST /api/process ──► Claude API
        │       │                   ├─ Classify category + urgency
        │       │                   └─ Generate draft reply
        │       │
        │       └─► Supabase
        │               ├─ emails table
        │               ├─ classifications table
        │               └─ drafts table (status: pending)
        │
        ├─► Gmail Draft (saved, not sent)
        │
        └─► Slack notification (urgency + preview)

Dashboard (browser)
    └─► triage_summary view (Supabase)
            └─ Edit / approve / discard drafts
```

---

## Project Structure

```
inboxai/
├── api/
│   ├── process.js          # Vercel serverless function — main email processing endpoint
│   └── health.js           # Health check endpoint
├── claude/
│   ├── agent.js            # Claude API integration (classification + draft generation)
│   └── server.js           # Express.js server for local/production use
├── knowledge/
│   └── paul-smith-kb.js    # Paul's voice profile, market expertise, communication style
├── n8n/
│   └── workflow.json       # n8n automation workflow (import this into n8n)
├── public/
│   └── index.html          # Web dashboard (React-like SPA, Tailwind CSS)
├── slack/
│   └── notifier.js         # Slack webhook notification helper
├── supabase/
│   └── schema.sql          # PostgreSQL schema — tables, indexes, triage_summary view
├── .env.example            # Environment variable template
├── vercel.json             # Vercel deployment config
└── package.json
```

---

## Setup

### Prerequisites

- Node.js v20+
- A [Supabase](https://supabase.com) project
- An [Anthropic API key](https://console.anthropic.com)
- An n8n instance (self-hosted or [n8n Cloud](https://n8n.io))
- A Slack app with an Incoming Webhook URL
- Gmail account with OAuth2 credentials configured in n8n

### 1. Clone and install

```bash
git clone https://github.com/zezekim/inboxai.git
cd inboxai
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...              # Service role key (bypasses RLS)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
PORT=3000
```

### 3. Set up the database

Run the schema in your Supabase SQL editor:

```bash
# Copy contents of supabase/schema.sql and run it in the Supabase Dashboard > SQL Editor
```

This creates:
- `emails` — raw email data
- `classifications` — Claude's analysis per email
- `drafts` — generated replies with status tracking
- `triage_summary` — view joining all three for the dashboard

### 4. Import the n8n workflow

1. Open your n8n instance
2. Go to **Workflows → Import**
3. Upload `n8n/workflow.json`
4. Configure credentials in n8n:
   - **Gmail OAuth2** — connect your Gmail account
   - **HTTP Request** — set the `Authorization` header or use the endpoint URL for `/api/process`
5. Activate the workflow

### 5. Run locally

```bash
npm run dev     # with --watch (auto-restarts on changes)
# or
npm start
```

The server starts on `http://localhost:3000`.

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| `POST` | `/process` | Classify and draft an email |
| `GET` | `/health` | Health check |

### 6. Deploy to Vercel

```bash
vercel deploy
```

Update your n8n workflow's HTTP Request node to point to your Vercel URL (`https://your-project.vercel.app/api/process`).

---

## API Reference

### `POST /process` (or `/api/process` on Vercel)

Classifies an email and generates a draft reply.

**Request body:**

```json
{
  "from": "buyer@example.com",
  "fromName": "Jane Doe",
  "subject": "Interested in 2415 S Lamar",
  "body": "Hi Paul, I saw your listing on Zillow...",
  "messageId": "18abc123def456",
  "threadId": "18abc123000000"
}
```

**Response:**

```json
{
  "category": "lead_inquiry",
  "urgencyScore": 5,
  "urgencyLabel": "hot",
  "reasoning": "New buyer lead on an active listing — immediate follow-up required.",
  "draft": "Hi Jane, Thanks for reaching out...\n\nPaul Smith, GRI\n...",
  "inputTokens": 2400,
  "cacheReadTokens": 1800,
  "cacheCreationTokens": 600,
  "outputTokens": 310
}
```

---

## Email Categories

| Category | Description |
|---|---|
| `lead_inquiry` | New potential buyers or sellers |
| `existing_client` | Current or past clients |
| `agent_colleague` | Industry peers, cooperating agents |
| `listing_related` | Vendors, inspectors, title, builders |
| `spam` | Newsletters, cold outreach, irrelevant |

## Urgency Labels

| Label | Score | Response Time |
|---|---|---|
| `hot` | 4–5 | Immediate — new leads, time-sensitive decisions |
| `warm` | 2–3 | Within 24–48 hours |
| `cold` | 1 | No rush, general inquiry |
| `skip` | 0 | Spam — no reply needed, no draft created |

---

## Dashboard

Open `public/index.html` in a browser (or serve it via Vercel). The dashboard:

- Fetches from the `triage_summary` Supabase view
- Filters by urgency and draft status
- Shows the original email and AI draft side-by-side in a modal
- Allows editing the draft (auto-saves after 2 seconds)
- Lets you mark emails as reviewed, sent, or discarded
- Links directly to the Gmail draft for one-click sending

The Supabase URL and anon key are configured at the top of `public/index.html`. For production use, restrict access with Supabase RLS policies and an authenticated session.

---

## Knowledge Base

`knowledge/paul-smith-kb.js` contains a detailed profile used in every Claude system prompt:

- 18+ years of Austin real estate experience
- 750+ closed transactions, $350M+ in sales volume
- Twelve Rivers Realty office details (address, phone, philosophy)
- Market specialties: South Austin, Westlake, Hyde Park, Hill Country
- Paul's communication style: direct, warm, brief, jargon-free
- Common email scenarios with expected response tone
- Exact email signature format
- Phrases Paul would never write

This file is the single source of truth for Claude's voice and persona. Edit it to adapt InboxAI for any agent.

---

## n8n Workflow Nodes

The imported workflow contains 11 nodes:

1. **Gmail Trigger** — polls for unread emails every 5 minutes
2. **Normalize Email** — parses Gmail API format variations, extracts clean fields
3. **Claude API** — HTTP POST to `/api/process`
4. **Merge** — combines email data with Claude response
5. **Spam Check** — branches on `urgencyLabel === "skip"`
6. **Supabase: Save Email** — inserts into `emails` table
7. **Supabase: Save Classification** — inserts into `classifications` table
8. **Supabase: Save Draft** — inserts into `drafts` table with `status: pending`
9. **Gmail Draft** — creates draft in Gmail (not sent), linked to original thread
10. **Slack Notification** — posts formatted alert to Slack channel
11. *(Spam path terminates — no draft, no Slack)*

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic Claude API key |
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Service role key (admin, bypasses RLS) |
| `SLACK_WEBHOOK_URL` | Yes | Slack Incoming Webhook URL |
| `PORT` | No | Express server port (default: 3000) |

---

## Development Notes

- The Claude agent (`claude/agent.js`) uses `betas: ["prompt-caching-2024-07-31"]` and marks the knowledge base block as `cache_control: { type: "ephemeral" }` to reduce token costs on repeated calls.
- The n8n Code node normalizes several Gmail API response shapes (raw base64, parsed parts array, plain string `from` fields) to handle real-world format variation.
- The dashboard modal uses a debounced auto-save (2-second delay) to avoid spamming Supabase on every keystroke.
- `SUPABASE_SERVICE_KEY` is a service role key — keep it server-side only. Never expose it in the dashboard frontend.

---

## License

MIT
