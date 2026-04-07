-- Fetch audit logs for Inventory actions (CREATE/UPDATE) from today 00:00 to now.
-- Adjust the timezone if needed: set local timezone with `SET TIME ZONE 'Africa/Nairobi';`
SELECT
  id,
  created_at,
  user_name,
  action,
  module,
  record_id,
  details
FROM audit_log
WHERE module = 'Inventory'
  AND action IN ('CREATE', 'UPDATE')
  AND created_at >= date_trunc('day', now())
ORDER BY created_at DESC;

-- Optional: include deletes for visibility
-- SELECT * FROM audit_log
-- WHERE module = 'Inventory'
--   AND action = 'DELETE'
--   AND created_at >= date_trunc('day', now())
-- ORDER BY created_at DESC;
