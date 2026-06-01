-- `material.kind` is no longer a structural field.
-- Roles (raw / product / platform / intermediate) are computed from graph
-- position at request time, so the same material can play different roles in
-- different superstructures. `kind` survives as a free-text cosmetic hint
-- used only for grouping and coloring in the UI.

alter table material drop constraint if exists material_kind_check;

comment on column material.kind is
  'Cosmetic category hint only (e.g., raw, intermediate, utility, byproduct). Not used by the synthesis algorithm; role in a generated structure is derived from graph position.';
