// Verifies that tr/en/ar locale files have identical keys, that every static t('...') key used in
// src exists, and that every backend error code has a frontend translation.
// Usage: npm run check:i18n
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const languages = ['tr', 'en', 'ar'];

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

const keys = Object.fromEntries(
  languages.map((l) => [l, new Set(flatten(JSON.parse(readFileSync(join(root, 'src/locales', `${l}.json`), 'utf8'))))]),
);

let problems = 0;
const report = (message) => {
  problems++;
  console.error(`✗ ${message}`);
};

for (const lang of languages) {
  for (const other of languages) {
    for (const key of keys[other]) if (!keys[lang].has(key)) report(`${lang}.json is missing "${key}" (present in ${other}.json)`);
  }
}

const files = [];
const walk = (dir) =>
  readdirSync(dir).forEach((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(tsx?|jsx?)$/.test(name)) files.push(path);
  });
walk(join(root, 'src'));

const used = new Set();
for (const file of files) {
  for (const match of readFileSync(file, 'utf8').matchAll(/\bt\(\s*['"]([A-Za-z0-9_.]+)['"]/g)) used.add(match[1]);
  for (const match of readFileSync(file, 'utf8').matchAll(/['"]((?:quotes|common)\.[A-Za-z]+)['"]/g)) used.add(match[1]);
}
for (const key of used) if (!keys.tr.has(key)) report(`"${key}" is used in code but missing from the locale files`);

const backendCodes = readFileSync(join(root, '../backend/src/StageTrack.Domain.Shared/StageTrackErrorCodes.cs'), 'utf8')
  .matchAll(/=\s*"([A-Za-z]+\.[A-Za-z]+)"/g);
for (const [, code] of backendCodes) if (!keys.tr.has(`errors.${code}`)) report(`backend error code "${code}" has no translation`);

if (problems) {
  console.error(`\n${problems} localization problem(s) found.`);
  process.exit(1);
}
console.log(`✓ ${keys.tr.size} keys, identical in ${languages.join('/')}; ${used.size} keys used in code are all defined.`);
