import type { Pool } from 'pg';

export function createSettingsRepository(pool: Pool) {
  return {
    async get(): Promise<unknown | null> {
      const result = await pool.query<{ setting_value: unknown }>(
        "SELECT setting_value FROM app_settings WHERE setting_key='care.settings'",
      );
      return result.rows[0]?.setting_value ?? null;
    },

    async save(value: unknown): Promise<void> {
      await pool.query(
        `INSERT INTO app_settings(setting_key,setting_value,updated_at)
         VALUES('care.settings',$1::jsonb,now())
         ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=now()`,
        [JSON.stringify(value)],
      );
    },
  };
}
