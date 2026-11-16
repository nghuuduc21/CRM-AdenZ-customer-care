import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** Resolve an application key without logging or committing the key material. */
export async function loadApplicationKey(dataDirectory: string, configuredKey?: string): Promise<Buffer> {
  if (configuredKey?.trim()) return createHash('sha256').update(configuredKey).digest();

  const keyPath = join(dataDirectory, 'secret.key');
  await mkdir(dirname(keyPath), { recursive: true });
  try {
    return Buffer.from((await readFile(keyPath, 'utf8')).trim(), 'base64');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const key = randomBytes(32);
  try {
    await writeFile(keyPath, `${key.toString('base64')}\n`, { flag: 'wx', mode: 0o600 });
    return key;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    return Buffer.from((await readFile(keyPath, 'utf8')).trim(), 'base64');
  }
}
