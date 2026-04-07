-- Rebuild today's Inventory items from audit_log (CREATE/UPDATE)
-- NOTE: audit_log only stores minimal fields (name, quantity) for inventory actions.
-- Any missing fields will be filled with safe defaults below.
-- Adjust timezone if needed: `SET TIME ZONE 'Africa/Nairobi';`

WITH today_logs AS (
  SELECT
    created_at,
    action,
    record_id,
    details,
    COALESCE(details->>'name', record_id) AS name,
    NULLIF(details->>'quantity', '')::DECIMAL AS quantity,
    details->>'type' AS type,
    details->>'category' AS category,
    NULLIF(details->>'unit_cost', '')::DECIMAL AS unit_cost,
    NULLIF(details->>'reorder_level', '')::DECIMAL AS reorder_level,
    NULLIF(details->>'reorder_qty', '')::DECIMAL AS reorder_qty,
    CASE
      WHEN details ? 'auto_reorder' THEN (details->>'auto_reorder')::BOOLEAN
      ELSE NULL
    END AS auto_reorder,
    details->>'unit' AS unit,
    details->>'supplier' AS supplier,
    NULLIF(details->>'distributor_id', '')::UUID AS distributor_id,
    NULLIF(details->>'last_restocked', '')::DATE AS last_restocked
  FROM audit_log
  WHERE module = 'Inventory'
    AND action IN ('CREATE', 'UPDATE')
    AND created_at >= date_trunc('day', now())
),
latest_per_name AS (
  SELECT DISTINCT ON (LOWER(name))
    name,
    quantity,
    type,
    category,
    unit_cost,
    reorder_level,
    reorder_qty,
    auto_reorder,
    unit,
    supplier,
    distributor_id,
    last_restocked,
    created_at
  FROM today_logs
  WHERE name IS NOT NULL AND name <> ''
  ORDER BY LOWER(name), created_at DESC
)
INSERT INTO inventory_items (
  name,
  quantity,
  type,
  category,
  unit_cost,
  reorder_level,
  reorder_qty,
  auto_reorder,
  unit,
  supplier,
  distributor_id,
  last_restocked
)
SELECT
  name,
  COALESCE(quantity, 0),
  COALESCE(type, 'Consumable'),
  category,
  COALESCE(unit_cost, 0),
  COALESCE(reorder_level, 0),
  COALESCE(reorder_qty, 0),
  COALESCE(auto_reorder, false),
  COALESCE(unit, 'kg'),
  supplier,
  distributor_id,
  COALESCE(last_restocked, CURRENT_DATE)
FROM latest_per_name lp
WHERE NOT EXISTS (
  SELECT 1
  FROM inventory_items i
  WHERE LOWER(i.name) = LOWER(lp.name)
);
