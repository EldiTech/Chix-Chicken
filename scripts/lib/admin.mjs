/* Shared setup for the seed scripts: flags and a Firestore admin connection.
 *
 * Credentials, first match wins:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080   → local emulator, no key needed
 *   --key path/to/service-account.json
 *   .secrets/service-account.json            (project root, gitignored)
 *   GOOGLE_APPLICATION_CREDENTIALS
 *
 * The key comes from Firebase console → Project settings → Service accounts →
 * Generate new private key. Admin access skips firestore.rules.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

export { FieldValue, Timestamp };

const args = process.argv.slice(2);
export const flag = name => args.includes(name);
export const value = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

const DEFAULT_KEY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.secrets', 'service-account.json');

export function connect() {
  const project = value('--project') || 'project-ni-mark';
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  const key = value('--key') || (existsSync(DEFAULT_KEY) ? DEFAULT_KEY : undefined);
  if (!emulator && !key && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('No credentials. Put the key at .secrets/service-account.json, pass --key path/to/key.json,\nset GOOGLE_APPLICATION_CREDENTIALS, or set FIRESTORE_EMULATOR_HOST for the local emulator.');
    process.exit(1);
  }
  initializeApp({
    projectId: project,
    ...(emulator ? {} : { credential: key ? cert(JSON.parse(readFileSync(resolve(key), 'utf8'))) : applicationDefault() }),
  });
  return { db: getFirestore(), where: emulator ? 'emulator ' + emulator : project };
}
