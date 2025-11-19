CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    cognito_sub TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE workflow_status AS ENUM ('active','inactive');
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'action_kind') THEN
        CREATE TYPE action_kind AS ENUM ('send_email','http_request','write_s3','send_slack_message','generate_ai_content');
    END IF;
END $$;

ALTER TYPE action_kind ADD VALUE IF NOT EXISTS 'send_slack_message';
ALTER TYPE action_kind ADD VALUE IF NOT EXISTS 'generate_ai_content';
CREATE TYPE trigger_kind AS ENUM ('schedule','webhook');
CREATE TYPE run_status AS ENUM ('queued','running','success','failed','canceled');
CREATE TYPE run_step_status AS ENUM ('pending','running','success','failed','skipped');

CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status workflow_status NOT NULL DEFAULT 'inactive',
    description TEXT,
    template_id TEXT,
    template_inputs JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    idx INT NOT NULL,
    type TEXT NOT NULL DEFAULT 'action',
    action_kind action_kind NOT NULL,
    config JSONB NOT NULL,
    UNIQUE (workflow_id, idx)
);

CREATE TABLE IF NOT EXISTS triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    kind trigger_kind NOT NULL,
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    trigger_id UUID REFERENCES triggers(id),
    status run_status NOT NULL DEFAULT 'queued',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    input_payload JSONB,
    result_payload JSONB,
    error TEXT
);

CREATE TABLE IF NOT EXISTS run_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
    step_idx INT NOT NULL,
    status run_step_status NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    input JSONB,
    output JSONB,
    error TEXT
);

CREATE TABLE IF NOT EXISTS user_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    secret_encrypted TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS runs_workflow_idx ON runs(workflow_id, started_at DESC);
