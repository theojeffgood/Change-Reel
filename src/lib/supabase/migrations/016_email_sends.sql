-- Migration: 016_email_sends.sql
-- Description: Track sent emails and metadata

CREATE TABLE IF NOT EXISTS email_sends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  commit_ids UUID[] NOT NULL DEFAULT '{}',
  recipients TEXT[] NOT NULL DEFAULT '{}',
  template_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_sends_project_id ON email_sends(project_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_created_at ON email_sends(created_at DESC);

ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage email_sends" ON email_sends FOR ALL USING (true);

COMMENT ON TABLE email_sends IS 'Records of sent emails and metadata';
COMMENT ON COLUMN email_sends.commit_ids IS 'List of commits included in the email';
COMMENT ON COLUMN email_sends.recipients IS 'Recipient email addresses';


