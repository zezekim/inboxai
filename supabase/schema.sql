-- InboxAI Schema
-- Run this in the Supabase SQL editor

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── emails ──────────────────────────────────────────────────────────────────
CREATE TABLE emails (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id  TEXT UNIQUE NOT NULL,
  gmail_thread_id   TEXT,
  sender_email      TEXT NOT NULL,
  sender_name       TEXT,
  subject           TEXT,
  body              TEXT,
  received_at       TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── classifications ─────────────────────────────────────────────────────────
CREATE TABLE classifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id        UUID REFERENCES emails(id) ON DELETE CASCADE NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('lead_inquiry','existing_client','agent_colleague','listing_related','spam')),
  urgency_score   INTEGER NOT NULL CHECK (urgency_score BETWEEN 0 AND 5),
  urgency_label   TEXT NOT NULL CHECK (urgency_label IN ('hot','warm','cold','skip')),
  reasoning       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── drafts ──────────────────────────────────────────────────────────────────
CREATE TABLE drafts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id        UUID REFERENCES emails(id) ON DELETE CASCADE NOT NULL,
  draft_content   TEXT NOT NULL,
  gmail_draft_id  TEXT,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewed','sent','discarded')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ
);

-- ─── indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_emails_received_at       ON emails(received_at DESC);
CREATE INDEX idx_classifications_email_id ON classifications(email_id);
CREATE INDEX idx_classifications_label    ON classifications(urgency_label);
CREATE INDEX idx_drafts_email_id          ON drafts(email_id);
CREATE INDEX idx_drafts_status            ON drafts(status);

-- ─── view: triage_summary ────────────────────────────────────────────────────
-- Joins everything the dashboard needs in one query
CREATE VIEW triage_summary AS
SELECT
  e.id                  AS email_id,
  e.gmail_message_id,
  e.gmail_thread_id,
  e.sender_email,
  e.sender_name,
  e.subject,
  e.received_at,
  c.category,
  c.urgency_score,
  c.urgency_label,
  c.reasoning,
  d.id                  AS draft_id,
  d.draft_content,
  d.gmail_draft_id,
  d.status              AS draft_status,
  d.created_at          AS draft_created_at
FROM emails e
LEFT JOIN classifications c ON c.email_id = e.id
LEFT JOIN drafts d          ON d.email_id = e.id
ORDER BY e.received_at DESC;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Enable RLS but allow service_role (used by n8n + server) full access
ALTER TABLE emails          ENABLE ROW LEVEL SECURITY;
ALTER TABLE classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts          ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically.
-- If you add anon/authenticated access for the dashboard, add policies here.
