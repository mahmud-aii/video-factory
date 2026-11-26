#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import {
  CLIENTS_DIR,
  COMPOSITION_ID,
  ENTRY_POINT,
  buildInputProps,
  getOutputPaths,
  loadClientWorkspace,
  resolveBrowserExecutable,
  writeCaptionSidecar,
} from './lib/factory-utils.mjs';

const args = process.argv.slice(2);
const forceRerender = args.includes('--force');
const targetArg = args.find((arg) => !arg.startsWith('--')) || 'all';

function resolveClientSlugs(target) {
  if (target !== 'all') {
    const batchPath = path.join(CLIENTS_DIR, target, 'batch.json');
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

async function main() {
  const startedAt = Date.now();
  const slugs = resolveClientSlugs(targetArg);

  const queue = [];
  for (const slug of slugs) {
    const workspace = loadClientWorkspace(slug);
    const defaultSkip = workspace.batch.settings?.skipExisting !== false;
    const skipExisting = forceRerender ? false : defaultSkip;
    const videos = Array.isArray(workspace.batch.videos) ? workspace.batch.videos : [];

    for (const job of videos) {
      if (!job || !job.id || job.enabled === false) {
        continue;
      }
      queue.push({ slug, workspace, job, skipExisting });
    }
  }

  console.log(`\n=== Night Factory Runner (target=${targetArg}, jobs=${queue.length}) ===`);
  if (queue.length === 0) {
    console.log('No enabled video jobs found. Exiting.');
    return;
  }

  const publicDir = path.resolve('clients');
  console.log(`Bundling Remotion project once (publicDir=${publicDir})...`);
  const serveUrl = await bundle({
    entryPoint: ENTRY_POINT,
    publicDir,
  });

  const browserExecutable = resolveBrowserExecutable();
  const summary = { rendered: [], skipped: [], failed: [] };

  for (const item of queue) {
    const { slug, workspace, job, skipExisting } = item;
    const key = `${slug}/${job.id}`;
    const { dir, videoPath } = getOutputPaths(slug, job.id);

    if (skipExisting && fs.existsSync(videoPath)) {
      console.log(`[SKIP] ${key} already exists at ${path.relative(process.cwd(), videoPath)}`);
      summary.skipped.push(key);
      continue;
    }

    try {
      console.log(`\n[RENDER] ${key}`);
      fs.mkdirSync(dir, { recursive: true });
      const inputProps = buildInputProps(slug, workspace, job);
      console.log(
        `  Assets: logo=${inputProps.resolvedAssets.hasLogo}, voice=${inputProps.resolvedAssets.hasVoice}, bgm=${inputProps.resolvedAssets.hasBgm}, transitionSfx=${inputProps.resolvedAssets.hasTransitionSfx}, validVideos=${inputProps.resolvedAssets.validVideos.length}, validImages=${inputProps.resolvedAssets.validImages.length}`
      );

      const composition = await selectComposition({
        serveUrl,
        id: COMPOSITION_ID,
        inputProps,
        ...(browserExecutable ? { browserExecutable } : {}),
      });

      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        outputLocation: videoPath,
        inputProps,
        concurrency: 2,
        ...(browserExecutable ? { browserExecutable } : {}),
      });

      writeCaptionSidecar(slug, job);
      console.log(`[OK] ${key} -> ${path.relative(process.cwd(), videoPath)}`);
      summary.rendered.push(key);
    } catch (err) {
      console.error(`[FAIL] ${key}:`, err instanceof Error ? err.message : String(err));
      summary.failed.push({ key, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('\n=== Night Factory Summary ===');
  console.log(`Rendered: ${summary.rendered.length}`);
  console.log(`Skipped : ${summary.skipped.length}`);
  console.log(`Failed  : ${summary.failed.length}`);
  console.log(`Elapsed : ${elapsedSec}s\n`);

  if (summary.failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Night Factory crashed:', err);
  process.exit(1);
});
