-- PLA pathways seed: corn -> PLA and sugarcane-molasses -> PLA,
-- converging at purified lactic acid (~87 wt%).

begin;

with m(name, kind, properties) as (values
  -- Raw feedstocks
  ('Corn',                      'raw',          '{"feedstock_type":"starch"}'::jsonb),
  ('Sugarcane molasses',        'raw',          '{"feedstock_type":"sugar"}'::jsonb),
  -- Utilities
  ('Electricity (grid)',        'utility',      '{"form":"electrical"}'::jsonb),
  ('Steam (natural gas)',       'utility',      '{"form":"thermal"}'::jsonb),
  ('Bagasse cogeneration',      'utility',      '{"form":"thermal"}'::jsonb),
  ('Heavy fuel oil',            'utility',      '{"form":"thermal"}'::jsonb),
  ('Tap water',                 'utility',      '{}'::jsonb),
  -- Feedstock-specific intermediates
  ('Treated corn starch',       'intermediate', '{}'::jsonb),
  ('Treated molasses',          'intermediate', '{}'::jsonb),
  ('Crude lactic acid (corn)',  'intermediate', '{"purity_note":"feedstock-specific impurities"}'::jsonb),
  ('Crude lactic acid (molasses)', 'intermediate', '{"purity_note":"feedstock-specific impurities"}'::jsonb),
  -- Platform product (convergence point)
  ('Purified lactic acid (87 wt%)', 'platform', '{"purity_wt_pct":87}'::jsonb),
  -- Downstream shared intermediates
  ('L-lactide',                 'intermediate', '{}'::jsonb),
  -- End product
  ('PLA pellets',               'product',      '{"purity_vol_pct":98.24}'::jsonb),
  -- Byproducts
  ('Gypsum',                    'byproduct',    '{}'::jsonb)
)
insert into material (name, kind, properties)
select name, kind, properties from m
on conflict (name) do nothing;

-- Operations
with o(name, properties) as (values
  ('Corn Wet Milling',          '{"technology":"wet milling"}'::jsonb),
  ('Molasses Preparation',      '{"technology":"clarification"}'::jsonb),
  ('Fermentation (corn)',       '{"technology":"batch fermentation","feedstock":"corn"}'::jsonb),
  ('Fermentation (molasses)',   '{"technology":"batch fermentation","feedstock":"molasses"}'::jsonb),
  ('Lactic Acid Purification (corn)',     '{"technology":"separation+ion exchange","feedstock":"corn"}'::jsonb),
  ('Lactic Acid Purification (molasses)', '{"technology":"separation+ion exchange","feedstock":"molasses"}'::jsonb),
  ('Lactide Production',        '{"technology":"oligomerization+depolymerization"}'::jsonb),
  ('PLA Polymerization',        '{"technology":"ring-opening polymerization"}'::jsonb)
)
insert into operation (name, properties)
select name, properties from o
on conflict (name) do nothing;

-- I/O wiring. Uses materials/operations by name via lookups.
-- quantity/unit left null for v1 (topology-only).
insert into operation_io (operation_id, material_id, role, is_primary)
select op.id, mt.id, v.role, v.is_primary
from (values
  -- Corn Wet Milling
  ('Corn Wet Milling',         'Corn',                          'in',  true),
  ('Corn Wet Milling',         'Electricity (grid)',            'in',  false),
  ('Corn Wet Milling',         'Steam (natural gas)',           'in',  false),
  ('Corn Wet Milling',         'Tap water',                     'in',  false),
  ('Corn Wet Milling',         'Treated corn starch',           'out', true),

  -- Molasses Preparation
  ('Molasses Preparation',     'Sugarcane molasses',            'in',  true),
  ('Molasses Preparation',     'Electricity (grid)',            'in',  false),
  ('Molasses Preparation',     'Bagasse cogeneration',          'in',  false),
  ('Molasses Preparation',     'Tap water',                     'in',  false),
  ('Molasses Preparation',     'Treated molasses',              'out', true),

  -- Fermentation (corn)
  ('Fermentation (corn)',      'Treated corn starch',           'in',  true),
  ('Fermentation (corn)',      'Electricity (grid)',            'in',  false),
  ('Fermentation (corn)',      'Steam (natural gas)',           'in',  false),
  ('Fermentation (corn)',      'Crude lactic acid (corn)',      'out', true),
  ('Fermentation (corn)',      'Gypsum',                        'out', false),

  -- Fermentation (molasses)
  ('Fermentation (molasses)',  'Treated molasses',              'in',  true),
  ('Fermentation (molasses)',  'Electricity (grid)',            'in',  false),
  ('Fermentation (molasses)',  'Bagasse cogeneration',          'in',  false),
  ('Fermentation (molasses)', 'Crude lactic acid (molasses)',  'out', true),
  ('Fermentation (molasses)',  'Gypsum',                        'out', false),

  -- Lactic Acid Purification: one operation per feedstock-specific crude stream,
  -- both produce the same platform purified lactic acid. This is the convergence point.
  ('Lactic Acid Purification (corn)',     'Crude lactic acid (corn)',      'in',  true),
  ('Lactic Acid Purification (corn)',     'Electricity (grid)',            'in',  false),
  ('Lactic Acid Purification (corn)',     'Steam (natural gas)',           'in',  false),
  ('Lactic Acid Purification (corn)',     'Purified lactic acid (87 wt%)', 'out', true),

  ('Lactic Acid Purification (molasses)', 'Crude lactic acid (molasses)',  'in',  true),
  ('Lactic Acid Purification (molasses)', 'Electricity (grid)',            'in',  false),
  ('Lactic Acid Purification (molasses)', 'Bagasse cogeneration',          'in',  false),
  ('Lactic Acid Purification (molasses)', 'Purified lactic acid (87 wt%)', 'out', true),

  -- Lactide Production
  ('Lactide Production',       'Purified lactic acid (87 wt%)', 'in',  true),
  ('Lactide Production',       'Electricity (grid)',            'in',  false),
  ('Lactide Production',       'Heavy fuel oil',                'in',  false),
  ('Lactide Production',       'L-lactide',                     'out', true),

  -- PLA Polymerization
  ('PLA Polymerization',       'L-lactide',                     'in',  true),
  ('PLA Polymerization',       'Electricity (grid)',            'in',  false),
  ('PLA Polymerization',       'Heavy fuel oil',                'in',  false),
  ('PLA Polymerization',       'PLA pellets',                   'out', true)
) as v(op_name, mat_name, role, is_primary)
join operation op on op.name = v.op_name
join material  mt on mt.name = v.mat_name
on conflict (operation_id, material_id, role) do nothing;

commit;
