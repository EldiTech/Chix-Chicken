#!/usr/bin/env node
/* Seed the menu into Firestore (menuItems/{id}) from scripts/data/menu.json.
 *
 * Safe to re-run: a dish that already exists only gets the fields it's
 * missing, so edits made later in the Firebase console (names, photos, order,
 * hidden) are kept. Pass --overwrite to reset every field from menu.json
 * (still keeps each dish's `hidden` flag).
 *
 *   cd scripts && npm install
 *   node seed-menu.mjs              # live project (key: see lib/admin.mjs)
 *   node seed-menu.mjs --dry-run    # show what would change
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node seed-menu.mjs   # local emulator
 */
import { readFileSync } from 'node:fs';
import { connect, flag, FieldValue } from './lib/admin.mjs';

const DRY = flag('--dry-run');
const OVERWRITE = flag('--overwrite');
const FIELDS = ['name', 'tag', 'blurb', 'image', 'alt', 'sort', 'limited'];

const menu = JSON.parse(readFileSync(new URL('./data/menu.json', import.meta.url), 'utf8'));

// ─── CHECK THE DATA FIRST ──────────────────────────────────────────────────
const problems = [];
const seen = new Set();
menu.forEach((m, i) => {
  const at = `menu.json[${i}]${m.id ? ' (' + m.id + ')' : ''}`;
  if (!/^[a-z0-9-]{1,40}$/.test(m.id || '')) problems.push(`${at}: id must be lowercase letters, digits, or dashes`);
  if (seen.has(m.id)) problems.push(`${at}: duplicate id`);
  seen.add(m.id);
  if (typeof m.name !== 'string' || !m.name.trim()) problems.push(`${at}: name is required`);
  if (typeof m.sort !== 'number') problems.push(`${at}: sort must be a number`);
  if (typeof m.limited !== 'boolean') problems.push(`${at}: limited must be true or false`);
  if (m.image && !/^https:\/\//.test(m.image)) problems.push(`${at}: image must be an https URL`);
});
if (problems.length) {
  console.error('menu.json has problems:\n  ' + problems.join('\n  '));
  process.exit(1);
}

// ─── CONNECT ───────────────────────────────────────────────────────────────
const { db, where } = connect();

// ─── WRITE ─────────────────────────────────────────────────────────────────
const col = db.collection('menuItems');
const existing = new Map((await col.get()).docs.map(d => [d.id, d.data()]));
const batch = db.batch();
let created = 0, updated = 0, unchanged = 0;

for (const m of menu) {
  const want = Object.fromEntries(FIELDS.map(f => [f, m[f] ?? (f === 'limited' ? false : '')]));
  const have = existing.get(m.id);
  const ref = col.doc(m.id);

  if (!have) {
    batch.set(ref, { ...want, hidden: false, updatedAt: FieldValue.serverTimestamp() });
    console.log(`+ ${m.id.padEnd(12)} ${m.name}`);
    created += 1;
    continue;
  }
  const changes = Object.fromEntries(Object.entries(want).filter(([k, v]) =>
    OVERWRITE ? JSON.stringify(have[k]) !== JSON.stringify(v) : have[k] === undefined));
  if (have.hidden === undefined) changes.hidden = false;
  if (!Object.keys(changes).length) { unchanged += 1; continue; }
  batch.set(ref, { ...changes, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  console.log(`~ ${m.id.padEnd(12)} ${Object.keys(changes).join(', ')}`);
  updated += 1;
}

const extra = [...existing.keys()].filter(id => !seen.has(id));
if (extra.length) console.log(`  (left alone, not in menu.json: ${extra.join(', ')})`);

if (DRY) {
  console.log(`\nDry run: would create ${created}, update ${updated}, leave ${unchanged} unchanged.`);
} else {
  await batch.commit();
  console.log(`\nDone on ${where}: created ${created}, updated ${updated}, unchanged ${unchanged}.`);
}
