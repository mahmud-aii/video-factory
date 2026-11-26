#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CLIENTS_DIR = path.join(ROOT_DIR, 'clients');

const targetArg = (process.argv[2] || 'all').trim();

function listClientSlugs(target) {
  if (!fs.existsSync(CLIENTS_DIR)) {
    throw new Error(`Clients directory not found: ${CLIENTS_DIR}`);
  }

  if (target && target !== 'all') {
    if (target === '_template' || target.startsWith('.') || target.startsWith('_')) {
      throw new Error(`Invalid target client slug: "${target}"`);
    }
    const clientDir = path.join(CLIENTS_DIR, target);
    const batchPath = path.join(clientDir, 'batch.json');
    if (!fs.existsSync(batchPath)) {
      throw new Error(`Client "${target}" not found or missing clients/${target}/batch.json`);
    }
    return [target];
  }

  return fs
    .readdirSync(CLIENTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== '_template' && !name.startsWith('.') && !name.startsWith('_'))
    .filter((name) => fs.existsSync(path.join(CLIENTS_DIR, name, 'batch.json')))
    .sort();
}

function collectJobs(slugs) {
  const include = [];

  for (const slug of slugs) {
    const batchPath = path.join(CLIENTS_DIR, slug, 'batch.json');
    const raw = fs.readFileSync(batchPath, 'utf8');
    const batch = JSON.parse(raw);
    const videos = Array.isArray(batch.videos) ? batch.videos : [];

    for (const video of videos) {
      if (!video || typeof video.id !== 'string' || !video.id.trim()) {
        continue;
      }
      if (video.enabled === false) {
        continue;
      }
      include.push({
        slug,
        videoId: video.id.trim(),
      });
    }
  }

  return include;
}

try {
  const slugs = listClientSlugs(targetArg);
  const include = collectJobs(slugs);
  const hasJobs = include.length > 0;
  const matrixJson = JSON.stringify({ include });

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `matrix=${matrixJson}\nhas_jobs=${hasJobs ? 'true' : 'false'}\n`,
      'utf8'
    );
  }

  console.log(`Target client(s): ${targetArg}`);
  console.log(`Scanned clients : ${slugs.length > 0 ? slugs.join(', ') : '(none)'}`);
  console.log(`Enabled jobs    : ${include.length}`);
  console.log(`has_jobs=${hasJobs}`);
  console.log(`matrix=${matrixJson}`);
} catch (err) {
  console.error(`plan-matrix failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
