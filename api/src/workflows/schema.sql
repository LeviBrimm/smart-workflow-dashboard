CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    cognito_sub TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE workflow_status AS ENUM ('active','inactive');
CREATE TYPE action_kind AS ENUM ('send_email','http_request','write_s3');
CREATE TYPE trigger_kind AS ENUM ('schedule','webhook');
CREATE TYPE run_status AS ENUM ('queued','running','success','failed','canceled');
CREATE TYPE run_step_status AS ENUM ('pending','running','success','failed','skipped');

CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status workflow_status NOT NULL DEFAULT 'inactive',
    description TEXT,
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

CREATE INDEX IF NOT EXISTS runs_workflow_idx ON runs(workflow_id, started_at DESC);
