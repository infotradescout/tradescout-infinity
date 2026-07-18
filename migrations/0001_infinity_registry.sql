BEGIN;

CREATE TABLE infinity_tenants (
  id varchar(64) PRIMARY KEY,
  key varchar(80) NOT NULL UNIQUE,
  display_name varchar(160) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE infinity_api_keys (
  id varchar(64) PRIMARY KEY,
  tenant_id varchar(64) NOT NULL REFERENCES infinity_tenants(id),
  name varchar(120) NOT NULL,
  key_prefix varchar(20) NOT NULL,
  key_hash varchar(64) NOT NULL UNIQUE,
  status varchar(24) NOT NULL DEFAULT 'active',
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX infinity_api_keys_tenant_idx ON infinity_api_keys(tenant_id);

CREATE TABLE infinity_partner_programs (
  id varchar(64) PRIMARY KEY,
  tenant_id varchar(64) NOT NULL REFERENCES infinity_tenants(id),
  name varchar(160) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'draft',
  attribution_rule varchar(40) NOT NULL,
  attribution_window_days integer,
  eligible_conversion_types jsonb NOT NULL,
  reward_policy_reference varchar(160),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX infinity_programs_tenant_idx ON infinity_partner_programs(tenant_id);

CREATE TABLE infinity_partner_identities (
  id varchar(64) PRIMARY KEY,
  tenant_id varchar(64) NOT NULL REFERENCES infinity_tenants(id),
  program_id varchar(64) NOT NULL REFERENCES infinity_partner_programs(id),
  subject_reference varchar(160) NOT NULL,
  public_tag varchar(80),
  status varchar(24) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT infinity_partner_subject_unique UNIQUE (tenant_id, program_id, subject_reference),
  CONSTRAINT infinity_partner_public_tag_unique UNIQUE (tenant_id, program_id, public_tag)
);

CREATE TABLE infinity_objects (
  id varchar(64) PRIMARY KEY,
  tenant_id varchar(64) NOT NULL REFERENCES infinity_tenants(id),
  object_type varchar(80) NOT NULL,
  external_object_id varchar(160) NOT NULL,
  current_version varchar(120) NOT NULL,
  canonical_path text NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT infinity_objects_external_unique UNIQUE (tenant_id, object_type, external_object_id)
);

CREATE TABLE infinity_passes (
  public_id varchar(80) PRIMARY KEY,
  tenant_id varchar(64) NOT NULL REFERENCES infinity_tenants(id),
  object_reference jsonb NOT NULL,
  scopes jsonb NOT NULL,
  action_ids jsonb NOT NULL,
  attribution jsonb,
  object_version varchar(120) NOT NULL,
  rendered_at timestamptz NOT NULL,
  expires_at timestamptz,
  signature_version integer NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'active',
  revoked_at timestamptz,
  superseded_by varchar(80),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX infinity_passes_tenant_idx ON infinity_passes(tenant_id);
CREATE INDEX infinity_passes_object_idx ON infinity_passes(tenant_id, object_version);

CREATE TABLE infinity_pass_actions (
  id varchar(80) PRIMARY KEY,
  tenant_id varchar(64) NOT NULL,
  pass_public_id varchar(80) NOT NULL REFERENCES infinity_passes(public_id) ON DELETE CASCADE,
  action jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX infinity_pass_actions_pass_idx ON infinity_pass_actions(pass_public_id);

CREATE TABLE infinity_attribution_touches (
  id varchar(64) PRIMARY KEY,
  tenant_id varchar(64) NOT NULL,
  program_id varchar(64) NOT NULL,
  partner_id varchar(64) NOT NULL,
  link_id varchar(64),
  pass_public_id varchar(80),
  carrier varchar(40) NOT NULL,
  target jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  evidence_digest varchar(128) NOT NULL,
  verified boolean NOT NULL DEFAULT false
);
CREATE INDEX infinity_touches_program_idx ON infinity_attribution_touches(tenant_id, program_id);

CREATE TABLE infinity_attribution_assignments (
  id varchar(64) PRIMARY KEY,
  tenant_id varchar(64) NOT NULL,
  program_id varchar(64) NOT NULL,
  partner_id varchar(64) NOT NULL,
  subject_reference varchar(160) NOT NULL,
  winning_touch_id varchar(64) NOT NULL,
  rule varchar(40) NOT NULL,
  assigned_at timestamptz NOT NULL,
  expires_at timestamptz,
  locked boolean NOT NULL DEFAULT false,
  CONSTRAINT infinity_assignment_subject_unique UNIQUE (tenant_id, program_id, subject_reference)
);

CREATE TABLE infinity_conversion_evidence (
  id varchar(64) PRIMARY KEY,
  tenant_id varchar(64) NOT NULL,
  object_reference jsonb NOT NULL,
  idempotency_key varchar(160) NOT NULL,
  event_type varchar(80) NOT NULL,
  occurred_at timestamptz NOT NULL,
  attribution_proof_id varchar(64),
  attribution_assignment_id varchar(64),
  payload_digest varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT infinity_conversion_idempotency_unique UNIQUE (tenant_id, idempotency_key)
);

COMMIT;
