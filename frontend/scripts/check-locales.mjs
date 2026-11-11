// Verifies that tr/en/ar locale files have identical keys, that every static t('...') key used in
// src exists, that keys built at runtime (t(`a.b.${x}`)) have a group to resolve into, and that every
// backend error code has a frontend translation.
// Usage: npm run check:i18n
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
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

// Keys the code builds at runtime: t(`stage3d.dim.${kind}`). The exact key cannot be known here, but the
// prefix can, and a prefix with no keys under it means every one of them resolves to its own name on screen -
// which is how the 3D stage spent months labelling itself "stage3d.dim.stageWidth". A prefix that does exist is
// only listed: whether it covers every member of the union is the type checker's business, not this script's.
const dynamic = new Map();
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\bt\(\s*`([A-Za-z0-9_.]*\.)\$\{/g)) {
    const line = text.slice(0, match.index).split('\n').length;
    const where = `${relative(root, file).replace(/\\/g, '/')}:${line}`;
    const prefix = match[1];
    if (!dynamic.has(prefix)) dynamic.set(prefix, []);
    dynamic.get(prefix).push(where);
  }
}

const prefixes = [...dynamic.keys()].sort();
for (const prefix of prefixes) {
  if (![...keys.tr].some((key) => key.startsWith(prefix))) {
    report(`no key starts with "${prefix}", built at ${dynamic.get(prefix).join(', ')}`);
  }
}

const backendCodes = readFileSync(join(root, '../backend/src/StageTrack.Domain.Shared/StageTrackErrorCodes.cs'), 'utf8')
  .matchAll(/=\s*"([A-Za-z]+\.[A-Za-z]+)"/g);
for (const [, code] of backendCodes) if (!keys.tr.has(`errors.${code}`)) report(`backend error code "${code}" has no translation`);

if (problems) {
  console.error(`\n${problems} localization problem(s) found.`);
  process.exit(1);
}
console.log(`✓ ${keys.tr.size} keys, identical in ${languages.join('/')}; ${used.size} keys used in code are all defined.`);
console.log(`ℹ ${[...dynamic.values()].reduce((n, at) => n + at.length, 0)} key(s) built at runtime, all with a group to resolve into:`);
for (const prefix of prefixes) {
  console.log(`  ${prefix}* — ${dynamic.get(prefix).join(', ')}`);
}
