import type { Pool } from 'pg';
import { createSettingsRepository } from './settings.repository.js';
import { defaultSettings, mergeSettings, type Settings } from './settings.defaults.js';

export function createSettingsService(pool: Pool) {
  const repository = createSettingsRepository(pool);

  return {
    async load(): Promise<Settings> {
      const saved = await repository.get();
      return mergeSettings(defaultSettings(), saved) as Settings;
    },

    async save(settings: Settings): Promise<Settings> {
      const normalized = mergeSettings(defaultSettings(), settings) as Settings;
      await repository.save(normalized);
      return normalized;
    },
  };
}
