-- Biorefinery superstructure schema (v1).
-- Topology-only; quantities/impacts are nullable JSONB until LCA work begins.

create extension if not exists "pgcrypto";

create table if not exists material (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  kind          text not null check (kind in ('raw','intermediate','platform','product','utility','byproduct','waste')),
  properties    jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists operation (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  basis_quantity  numeric,
  basis_unit      text,
  basis_material  uuid references material(id),
  properties      jsonb not null default '{}'::jsonb,
  impacts         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create table if not exists operation_io (
  id              bigserial primary key,
  operation_id    uuid not null references operation(id) on delete cascade,
  material_id     uuid not null references material(id),
  role            text not null check (role in ('in','out')),
  quantity        numeric,
  unit            text,
  is_primary      boolean not null default false,
  properties      jsonb not null default '{}'::jsonb,
  unique (operation_id, material_id, role)
);

create index if not exists operation_io_operation_idx on operation_io (operation_id);
create index if not exists operation_io_material_idx  on operation_io (material_id);
create index if not exists operation_io_role_idx      on operation_io (role);
