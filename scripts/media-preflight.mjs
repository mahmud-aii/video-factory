#!/usr/bin/env node
/**
 * Cloud-Native Media Preflight Inspector & Non-Destructive Loudness Normalizer
 *
 * Usage:
 *   node scripts/media-preflight.mjs <slug | all> [videoId] [--strict] [--normalize]
 *
 * Modes:
 *   - Default (Cloud Sandbox): Missing Google Drive media is reported as a benign
 *     sandbox warning (exits 0) because Remotion scenes have built-in fallbacks.
 *   - --strict (CI after rclone copy): Exits non-zero if an enabled job's required
 *     voiceover or referenced visual media is missing, corrupt, or poses a severe
 *     4K/uncompressed OOM risk on GitHub Actions runners.
 *   - --normalize: Writes EBU R128 loudness-normalized voiceovers (-16 LUFS) and
 *     -22dB ducked BGM copies to `output/.processed/<slug>/...` without EVER
 *     modifying source files inside `clients/`.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CLIENTS_DIR = path.join(ROOT_DIR, 'clients');
const PROCESSED_ROOT = path.join(ROOT_DIR, 'output', '.processed');

const TARGET_FPS = 60;
const BREATHING_ROOM_SEC = 0.5;
const UNCOMPRESSED_VIDEO_CODECS = new Set([
  'rawvideo',
  'prores',
  'dnxhd',
  'cfhd',
  'ffv1',
  'huffyuv',
  'qtrle',
  'utvideo',
  'v210',
  'v410',
]);

function parseArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith('--')));
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  return {
    slugArg: positional[0]?.trim() || '',
    videoIdArg: positional[1]?.trim() || '',
    strict: flags.has('--strict'),
    normalize: flags.has('--normalize'),
    help: flags.has('--help') || flags.has('-h'),
  };
}

function normalizeRelPath(raw) {
  if (!raw || typeof raw !== 'string') {
    return '';
  }
  return raw
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/')
    .trim();
}

function findBinary(name) {
  const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const suffixes = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];

  for (const dir of pathDirs) {
    for (const ext of suffixes) {
      const candidate = path.join(dir, `${name}${ext}`);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
  }

  // Fallback to Remotion's bundled compositor binary (works out-of-the-box in Cloud Sandbox)
  const remotionScopeDir = path.join(ROOT_DIR, 'node_modules', '@remotion');
  if (fs.existsSync(remotionScopeDir)) {
    for (const entry of fs.readdirSync(remotionScopeDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('compositor-')) {
        continue;
      }
      for (const ext of suffixes) {
        const candidate = path.join(remotionScopeDir, entry.name, `${name}${ext}`);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return candidate;
        }
      }
    }
  }

  return null;
}

function probeMedia(ffprobeBin, fullPath) {
  const out = execFileSync(
    ffprobeBin,
    [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      fullPath,
    ],
    { encoding: 'utf8' }
  );
  return JSON.parse(out);
}

function resolveClientSlugs(slugArg) {
  if (slugArg !== 'all') {
    const clientDir = path.join(CLIENTS_DIR, slugArg);
    if (!fs.existsSync(path.join(clientDir, 'batch.json'))) {
      throw new Error(`Client "${slugArg}" not found or missing clients/${slugArg}/batch.json`);
    }
    return [slugArg];
  }

  return fs
    .readdirSync(CLIENTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== '_template' && !name.startsWith('.') && !name.startsWith('_'))
    .filter((name) => fs.existsSync(path.join(CLIENTS_DIR, name, 'batch.json')))
    .sort();
}

function listLocalMediaFiles(clientDir) {
  const buckets = ['logos', 'audio', 'images', 'broll', 'sfx'];
  const discovered = [];

  for (const bucket of buckets) {
    const dir = path.join(clientDir, bucket);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      continue;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || entry.name === '.gitkeep' || entry.name.endsWith('.json')) {
        continue;
      }
      discovered.push(`${bucket}/${entry.name}`);
    }
  }
  return discovered;
}

function normalizeAudioCopy({ ffmpegBin, srcPath, destPath, mode }) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const ext = path.extname(destPath).toLowerCase();

  const filterChain =
    mode === 'voice'
      ? 'loudnorm=I=-16:TP=-1.5:LRA=11'
      : 'loudnorm=I=-16:TP=-1.5:LRA=11,volume=-22dB';

  const args = ['-y', '-v', 'error', '-i', srcPath, '-af', filterChain, '-ar', '44100'];
  if (ext === '.mp3') {
    args.push('-codec:a', 'libmp3lame', '-b:a', '192k');
  } else if (ext === '.m4a' || ext === '.aac') {
    args.push('-codec:a', 'aac', '-b:a', '192k');
  }
  args.push(destPath);

  execFileSync(ffmpegBin, args, { stdio: 'inherit' });
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function main() {
  const { slugArg, videoIdArg, strict, normalize, help } = parseArgs(process.argv.slice(2));

  if (help || !slugArg) {
    console.log(
      'Usage: node scripts/media-preflight.mjs <slug | all> [videoId] [--strict] [--normalize]'
    );
    console.log('Examples:');
    console.log('  npm run preflight:media -- khidmatyar');
    console.log('  npm run preflight:media -- khidmatyar reel_01_dari_launch --strict');
    console.log('  npm run preflight:media -- tekviyo demo_001 --normalize');
    process.exit(help ? 0 : 1);
  }

  const ffprobeBin = findBinary('ffprobe');
  const ffmpegBin = findBinary('ffmpeg');

  if (!ffprobeBin) {
    console.error('Error: ffprobe binary not found on PATH or inside node_modules/@remotion/.');
    process.exit(1);
  }
  if (normalize && !ffmpegBin) {
    console.error('Error: ffmpeg binary required for --normalize was not found.');
    process.exit(1);
  }

  const slugs = resolveClientSlugs(slugArg);
  const hasEnsureSfx = fs.existsSync(path.join(ROOT_DIR, 'scripts', 'ensure-sfx.py'));

  let strictErrors = 0;
  let warnings = 0;
  let inspectedFiles = 0;
  let normalizedFiles = 0;

  console.log(
    `\n=== VideoFactory Media Preflight [mode=${
      strict ? 'STRICT-CI' : 'CLOUD-SANDBOX'
    }${normalize ? ', +NORMALIZE' : ''}] ===`
  );

  for (const slug of slugs) {
    const clientDir = path.join(CLIENTS_DIR, slug);
    const brandPath = path.join(clientDir, 'brand.json');
    const batchPath = path.join(clientDir, 'batch.json');

    if (!fs.existsSync(brandPath) || !fs.existsSync(batchPath)) {
      console.error(`[ERROR] Missing brand.json or batch.json in clients/${slug}`);
      strictErrors++;
      continue;
    }

    const brand = JSON.parse(fs.readFileSync(brandPath, 'utf8'));
    const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
    const allVideos = Array.isArray(batch.videos) ? batch.videos : [];
    const jobs = videoIdArg
      ? allVideos.filter((v) => v && v.id === videoIdArg)
      : allVideos;

    if (videoIdArg && jobs.length === 0) {
      console.error(
        `[ERROR] Video job "${videoIdArg}" not found in clients/${slug}/batch.json`
      );
      strictErrors++;
      continue;
    }

    console.log(`\n--- Client: ${slug} (${brand.name}) ---`);
    const inspectedRelSet = new Set();

    // Check brand logo
    if (brand.logoPath) {
      const relLogo = normalizeRelPath(brand.logoPath);
      inspectedRelSet.add(relLogo);
      const fullLogo = path.join(clientDir, relLogo);
      if (fs.existsSync(fullLogo) && fs.statSync(fullLogo).isFile()) {
        inspectedFiles++;
        try {
          const info = probeMedia(ffprobeBin, fullLogo);
          const vStream = (info.streams || []).find((s) => s.codec_type === 'video');
          const dims = vStream ? `${vStream.width}x${vStream.height}` : 'unknown';
          console.log(
            `  [OK] Logo: ${relLogo} (${dims}, ${formatMb(fs.statSync(fullLogo).size)})`
          );
        } catch (err) {
          console.error(
            `  [ERROR] Corrupt logo file clients/${slug}/${relLogo}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
          strictErrors++;
        }
      } else {
        warnings++;
        console.log(
          `  [SANDBOX-WARN] Logo missing locally (${relLogo}) — CTA scene will hide logo cleanly.`
        );
      }
    }

    for (const job of jobs) {
      if (!job || !job.id) {
        continue;
      }
      const isEnabled = job.enabled !== false;
      const fallbackSeconds = Number(job.audio?.fallbackSeconds) || 4;
      const fallbackFrames = Math.round(fallbackSeconds * TARGET_FPS);

      console.log(
        `  Job "${job.id}" [enabled=${isEnabled}, fallback=${fallbackSeconds}s (${fallbackFrames}f @ ${TARGET_FPS}fps)]:`
      );

      // 1. Voiceover check
      const voiceRel = normalizeRelPath(job.audio?.voicePath);
      if (voiceRel) {
        inspectedRelSet.add(voiceRel);
        const fullVoice = path.join(clientDir, voiceRel);
        if (fs.existsSync(fullVoice) && fs.statSync(fullVoice).isFile()) {
          inspectedFiles++;
          try {
            const info = probeMedia(ffprobeBin, fullVoice);
            const aStream = (info.streams || []).find((s) => s.codec_type === 'audio');
            const durationSec = Number(info.format?.duration ?? aStream?.duration ?? 0);
            const rawFrames = Math.round(durationSec * TARGET_FPS);
            const renderSeconds = durationSec + BREATHING_ROOM_SEC;
            const renderFrames = Math.round(renderSeconds * TARGET_FPS);
            const deltaSec = (renderSeconds - fallbackSeconds).toFixed(2);
            const sampleRate = aStream?.sample_rate ? `${aStream.sample_rate}Hz` : 'unknown';
            const codec = aStream?.codec_name || 'unknown';

            console.log(
              `    [OK] Voiceover: ${voiceRel} -> ${durationSec.toFixed(
                2
              )}s (${rawFrames}f raw, ${renderFrames}f w/ +0.5s breath; delta vs fallback=${
                Number(deltaSec) >= 0 ? `+${deltaSec}` : deltaSec
              }s, ${codec}, ${sampleRate})`
            );

            if (normalize) {
              const outVoice = path.join(PROCESSED_ROOT, slug, voiceRel);
              normalizeAudioCopy({
                ffmpegBin,
                srcPath: fullVoice,
                destPath: outVoice,
                mode: 'voice',
              });
              normalizedFiles++;
              console.log(
                `    [NORMALIZED] Voiceover (-16 LUFS) -> ${path.relative(ROOT_DIR, outVoice)}`
              );
            }
          } catch (err) {
            console.error(
              `    [ERROR] Corrupt voiceover ${voiceRel}: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
            strictErrors++;
          }
        } else if (strict && isEnabled) {
          strictErrors++;
          console.error(
            `    [STRICT-ERROR] Missing required voiceover after Drive sync: clients/${slug}/${voiceRel}`
          );
        } else {
          warnings++;
          console.log(
            `    [SANDBOX-WARN] Voiceover not synced (${voiceRel}) — using fallbackSeconds=${fallbackSeconds}s (${fallbackFrames}f).`
          );
        }
      }

      // 2. BGM & Transition SFX check
      for (const [label, rawPath, normMode] of [
        ['BGM', job.audio?.bgmPath, 'bgm'],
        ['Transition SFX', job.audio?.transitionSfxPath, null],
      ]) {
        const relAudio = normalizeRelPath(rawPath);
        if (!relAudio) {
          continue;
        }
        inspectedRelSet.add(relAudio);
        const fullAudio = path.join(clientDir, relAudio);
        if (fs.existsSync(fullAudio) && fs.statSync(fullAudio).isFile()) {
          inspectedFiles++;
          try {
            const info = probeMedia(ffprobeBin, fullAudio);
            const aStream = (info.streams || []).find((s) => s.codec_type === 'audio');
            const durationSec = Number(info.format?.duration ?? aStream?.duration ?? 0);
            const sampleRate = aStream?.sample_rate ? `${aStream.sample_rate}Hz` : 'unknown';
            const codec = aStream?.codec_name || 'unknown';
            console.log(
              `    [OK] ${label}: ${relAudio} (${durationSec.toFixed(
                2
              )}s, ${codec}, ${sampleRate})`
            );

            if (normalize && normMode === 'bgm') {
              const outBgm = path.join(PROCESSED_ROOT, slug, relAudio);
              normalizeAudioCopy({
                ffmpegBin,
                srcPath: fullAudio,
                destPath: outBgm,
                mode: 'bgm',
              });
              normalizedFiles++;
              console.log(
                `    [NORMALIZED] Ducked BGM (-22dB) -> ${path.relative(ROOT_DIR, outBgm)}`
              );
            }
          } catch (err) {
            console.error(
              `    [ERROR] Corrupt ${label} ${relAudio}: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
            strictErrors++;
          }
        } else {
          warnings++;
          const autoSynthNote = hasEnsureSfx
            ? 'scripts/ensure-sfx.py will auto-synthesize fallback audio at render time'
            : 'will be omitted cleanly';
          console.log(`    [SANDBOX-WARN] ${label} missing (${relAudio}) — ${autoSynthNote}.`);
        }
      }

      // 3. Scene B-Roll & Still Image checks
      const scenes = Array.isArray(job.scenes) ? job.scenes : [];
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        if (!scene) {
          continue;
        }

        if (scene.type === 'broll_text' && scene.videoPath) {
          const relVid = normalizeRelPath(scene.videoPath);
          inspectedRelSet.add(relVid);
          const fullVid = path.join(clientDir, relVid);

          if (fs.existsSync(fullVid) && fs.statSync(fullVid).isFile()) {
            inspectedFiles++;
            try {
              const stat = fs.statSync(fullVid);
              const info = probeMedia(ffprobeBin, fullVid);
              const vStream = (info.streams || []).find((s) => s.codec_type === 'video');
              const width = Number(vStream?.width || 0);
              const height = Number(vStream?.height || 0);
              const codec = (vStream?.codec_name || 'unknown').toLowerCase();
              const durationSec = Number(info.format?.duration ?? vStream?.duration ?? 0);
              const bitRateMbps = Number(info.format?.bit_rate || vStream?.bit_rate || 0) / 1_000_000;

              const is4kOrLarger =
                width >= 3840 || height >= 3840 || width * height >= 3840 * 2160;
              const isUncompressed = UNCOMPRESSED_VIDEO_CODECS.has(codec);
              const isHeavyBitrate = bitRateMbps > 40 || stat.size > 150 * 1024 * 1024;

              if (isUncompressed || (is4kOrLarger && isHeavyBitrate) || is4kOrLarger) {
                warnings++;
                const riskMsg = `    [OOM-RISK] Scene #${i + 1} B-Roll (${relVid}): ${width}x${height}, codec=${codec}, ${bitRateMbps.toFixed(
                  1
                )} Mbps, ${formatMb(
                  stat.size
                )} — 4K/uncompressed video risks GitHub Actions OOM kill! Transcode to 1080x1920 H.264 (CRF 20-23).`;
                if (strict && (isUncompressed || (is4kOrLarger && isHeavyBitrate))) {
                  strictErrors++;
                  console.error(riskMsg);
                } else {
                  console.warn(riskMsg);
                }
              } else {
                console.log(
                  `    [OK] Scene #${i + 1} B-Roll: ${relVid} (${width}x${height}, ${codec}, ${durationSec.toFixed(
                    2
                  )}s, ${formatMb(stat.size)})`
                );
              }
            } catch (err) {
              console.error(
                `    [ERROR] Corrupt B-Roll ${relVid}: ${
                  err instanceof Error ? err.message : String(err)
                }`
              );
              strictErrors++;
            }
          } else if (strict && isEnabled) {
            strictErrors++;
            console.error(
              `    [STRICT-ERROR] Missing B-Roll for enabled job "${job.id}": clients/${slug}/${relVid}`
            );
          } else {
            warnings++;
            console.log(
              `    [SANDBOX-WARN] Scene #${i + 1} B-Roll not synced (${relVid}) — broll_text will render animated dot-grid fallback.`
            );
          }
        }

        if (scene.type === 'image_text' && scene.imagePath) {
          const relImg = normalizeRelPath(scene.imagePath);
          inspectedRelSet.add(relImg);
          const fullImg = path.join(clientDir, relImg);

          if (fs.existsSync(fullImg) && fs.statSync(fullImg).isFile()) {
            inspectedFiles++;
            try {
              const stat = fs.statSync(fullImg);
              const info = probeMedia(ffprobeBin, fullImg);
              const vStream = (info.streams || []).find((s) => s.codec_type === 'video');
              const width = Number(vStream?.width || 0);
              const height = Number(vStream?.height || 0);
              const codec = vStream?.codec_name || 'image';

              if (width > 6000 || height > 6000 || stat.size > 25 * 1024 * 1024) {
                warnings++;
                console.warn(
                  `    [OOM-WARN] Scene #${i + 1} Image (${relImg}): ${width}x${height} (${formatMb(
                    stat.size
                  )}) is very large for Ken Burns; consider resizing to <= 2160x3840.`
                );
              } else {
                console.log(
                  `    [OK] Scene #${i + 1} Image: ${relImg} (${width}x${height}, ${codec}, ${formatMb(
                    stat.size
                  )})`
                );
              }
            } catch (err) {
              console.error(
                `    [ERROR] Corrupt image ${relImg}: ${
                  err instanceof Error ? err.message : String(err)
                }`
              );
              strictErrors++;
            }
          } else if (strict && isEnabled) {
            strictErrors++;
            console.error(
              `    [STRICT-ERROR] Missing image for enabled job "${job.id}": clients/${slug}/${relImg}`
            );
          } else {
            warnings++;
            console.log(
              `    [SANDBOX-WARN] Scene #${i + 1} Image not synced (${relImg}) — image_text will render animated dot-grid fallback.`
            );
          }
        }
      }
    }

    // 4. Inspect any unreferenced local files dropped into audio/, images/, broll/, logos/, sfx/
    const extraFiles = listLocalMediaFiles(clientDir).filter(
      (rel) => !inspectedRelSet.has(rel)
    );
    for (const relExtra of extraFiles) {
      const fullExtra = path.join(clientDir, relExtra);
      inspectedFiles++;
      try {
        const stat = fs.statSync(fullExtra);
        const info = probeMedia(ffprobeBin, fullExtra);
        const vStream = (info.streams || []).find(
          (s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1
        );
        const aStream = (info.streams || []).find((s) => s.codec_type === 'audio');

        if (vStream && relExtra.startsWith('broll/')) {
          const width = Number(vStream.width || 0);
          const height = Number(vStream.height || 0);
          const codec = (vStream.codec_name || 'unknown').toLowerCase();
          if (width >= 3840 || height >= 3840 || UNCOMPRESSED_VIDEO_CODECS.has(codec)) {
            warnings++;
            console.warn(
              `  [OOM-RISK] Unreferenced B-Roll ${relExtra}: ${width}x${height} (${codec}, ${formatMb(
                stat.size
              )})`
            );
          } else {
            console.log(
              `  [INFO] Extra B-Roll ${relExtra}: ${width}x${height} (${codec}, ${formatMb(
                stat.size
              )})`
            );
          }
        } else if (aStream) {
          const dur = Number(info.format?.duration ?? aStream.duration ?? 0);
          console.log(
            `  [INFO] Extra Audio ${relExtra}: ${dur.toFixed(2)}s (${aStream.codec_name}, ${
              aStream.sample_rate
            }Hz)`
          );
        } else if (vStream) {
          console.log(
            `  [INFO] Extra Image ${relExtra}: ${vStream.width}x${vStream.height} (${formatMb(
              stat.size
            )})`
          );
        }
      } catch {
        warnings++;
        console.warn(`  [WARN] Could not probe extra file clients/${slug}/${relExtra}`);
      }
    }
  }

  console.log('\n=== Media Preflight Summary ===');
  console.log(`Local media files probed : ${inspectedFiles}`);
  if (normalize) {
    console.log(`Normalized copies written: ${normalizedFiles} (in output/.processed/)`);
  }
  console.log(`Warnings / Sandbox notes : ${warnings}`);
  console.log(`Strict / Corrupt errors  : ${strictErrors}\n`);

  if (strictErrors > 0) {
    process.exit(1);
  }
}

try {
  main();
} catch (err) {
  console.error(
    `Media preflight failed: ${err instanceof Error ? err.message : String(err)}`
  );
  process.exit(1);
}
