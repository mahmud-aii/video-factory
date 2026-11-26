#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import {
  COMPOSITION_ID,
  ENTRY_POINT,
  buildInputProps,
  getOutputPaths,
  loadClientWorkspace,
  resolveBrowserExecutable,
  writeCaptionSidecar,
} from './lib/factory-utils.mjs';

const slug = process.argv[2]?.trim();
const videoId = process.argv[3]?.trim();

if (!slug || !videoId) {
  console.error('Usage: node scripts/render-one.mjs <slug> <videoId>');
  console.error('Example: node scripts/render-one.mjs tekviyo demo_001');
  process.exit(1);
}

async function main() {
  const startedAt = Date.now();
  const workspace = loadClientWorkspace(slug);
  const videos = Array.isArray(workspace.batch.videos) ? workspace.batch.videos : [];
  const job = videos.find((v) => v && v.id === videoId);

  if (!job) {
    throw new Error(`Video job "${videoId}" not found in clients/${slug}/batch.json`);
  }

  const inputProps = buildInputProps(slug, workspace, job);
  const { dir, videoPath } = getOutputPaths(slug, videoId);
  fs.mkdirSync(dir, { recursive: true });

  console.log(`\n=== VideoFactory Render: ${slug}/${videoId} ===`);
  console.log(
    `Assets detected: logo=${inputProps.assets.hasLogo}, voice=${inputProps.assets.hasVoice}, bgm=${inputProps.assets.hasBgm}, validVideos=${inputProps.assets.validVideos.length}, captionWords=${inputProps.captionWords.length}`
  );

  const publicDir = path.resolve('clients');
  console.log(`Bundling Remotion project (publicDir=${publicDir})...`);
  const serveUrl = await bundle({
    entryPoint: ENTRY_POINT,
    publicDir,
  });

  const browserExecutable = resolveBrowserExecutable();

  console.log(`Selecting composition "${COMPOSITION_ID}"...`);
  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps,
    ...(browserExecutable ? { browserExecutable } : {}),
  });

  console.log(
    `Rendering ${composition.width}x${composition.height} @ ${composition.fps}fps (${composition.durationInFrames} frames)...`
  );

  let lastLoggedBucket = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: videoPath,
    inputProps,
    concurrency: 2,
    ...(browserExecutable ? { browserExecutable } : {}),
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      const bucket = Math.floor(pct / 20);
      if (bucket > lastLoggedBucket) {
        lastLoggedBucket = bucket;
        console.log(`  Render progress: ${pct}%`);
      }
    },
  });

  const captionPath = writeCaptionSidecar(slug, job);
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(`Video saved  : ${path.relative(process.cwd(), videoPath)}`);
  console.log(`Caption saved: ${path.relative(process.cwd(), captionPath)}`);
  console.log(`Done in ${elapsedSec}s.\n`);
}

main().catch((err) => {
  console.error(`Render failed for ${slug}/${videoId}:`, err);
  process.exit(1);
});
