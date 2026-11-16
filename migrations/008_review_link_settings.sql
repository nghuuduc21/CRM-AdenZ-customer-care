-- Keep the review action unconfigured in the shared demo project.
UPDATE app_settings
SET setting_value = jsonb_set(
  setting_value,
  '{flow,reviewUrl}',
  to_jsonb(''::text),
  true
), updated_at = now()
WHERE setting_key = 'care.settings'
  AND COALESCE(setting_value #>> '{flow,reviewUrl}', '') <> '';
