#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CLIENTS_DIR = path.join(ROOT_DIR, 'clients');
const TEMPLATE_DIR = path.join(CLIENTS_DIR, '_template');

const rawSlug = process.argv[2];
const customName = process.argv.slice(3).join(' ').trim();

if (!rawSlug) {
  console.error('Usage: npm run new-client -- <slug> [Display Name]');
  console.error('Example: npm run new-client -- acme-studio "Acme Studio"');
  process.exit(1);
}

const SLUG_REGEX = /^[a-z0-9-]+$/;
if (!SLUG_REGEX.test(rawSlug) || rawSlug.startsWith('-') || rawSlug.endsWith('-')) {
  console.error(
    `Error: Invalid client slug "${rawSlug}". Use lowercase letters, digits, and hyphens only (a-z0-9-), without leading/trailing hyphens.`
  );
  process.exit(1);
}

if (rawSlug === 'all' || rawSlug === '_template') {
  console.error(`Error: "${rawSlug}" is a reserved name. Choose a different client slug.`);
  process.exit(1);
}

if (!fs.existsSync(TEMPLATE_DIR)) {
  console.error(`Error: Template directory not found at ${TEMPLATE_DIR}`);
  process.exit(1);
}

const targetDir = path.join(CLIENTS_DIR, rawSlug);
if (fs.existsSync(targetDir)) {
  console.error(`Error: Client workspace already exists at clients/${rawSlug}`);
  process.exit(1);
}

const toTitleCase = (slug) =>
  slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

fs.cpSync(TEMPLATE_DIR, targetDir, { recursive: true });

const brandJsonPath = path.join(targetDir, 'brand.json');
const brand = JSON.parse(fs.readFileSync(brandJsonPath, 'utf8'));
brand.name = customName || toTitleCase(rawSlug);
brand.handle = `@${rawSlug}`;
fs.writeFileSync(brandJsonPath, `${JSON.stringify(brand, null, 2)}\n`, 'utf8');

console.log(`\nCreated client workspace: clients/${rawSlug}`);
console.log(`Brand name set to: ${brand.name}\n`);
console.log('Next steps & asset instructions:');
console.log(`  1. Customize colors/font/direction in clients/${rawSlug}/brand.json`);
console.log(`  2. Tune pacing & safe zones in clients/${rawSlug}/style-rules.json`);
console.log(`  3. Edit video jobs in clients/${rawSlug}/batch.json`);
console.log('  4. Drop heavy media into Google Drive (or locally for dev — gitignored):');
console.log(`       - Logos : clients/${rawSlug}/logos/logo.png`);
console.log(`       - Audio : clients/${rawSlug}/audio/<videoId>.wav (or .mp3) & bgm.mp3`);
console.log(`       - Images: clients/${rawSlug}/images/<photo>.jpg (or .png/.webp)`);
console.log(`       - B-Roll: clients/${rawSlug}/broll/<clip>.mp4`);
console.log(`       - SFX   : clients/${rawSlug}/sfx/whoosh.mp3`);
console.log(`     Cloud Drive path: gdrive:Video-Factory/clients/${rawSlug}/`);
console.log(`  5. Local test render: npm run render-one -- ${rawSlug} demo_001\n`);
