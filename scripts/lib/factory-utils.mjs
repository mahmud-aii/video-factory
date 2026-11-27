import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, '..', '..');
export const CLIENTS_DIR = path.resolve(ROOT_DIR, 'clients');
export const OUTPUT_DIR = path.resolve(ROOT_DIR, 'output');
export const ENTRY_POINT = path.resolve(ROOT_DIR, 'src/index.ts');
export const ENSURE_SFX_SCRIPT = path.resolve(ROOT_DIR, 'scripts/ensure-sfx.py');
export const COMPOSITION_ID = 'FactoryReel';

export function normalizeAssetPath(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') {
    return '';
  }
  return relativePath
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/');
}

export function clientFileExists(slug, relativePath) {
  const normalized = normalizeAssetPath(relativePath);
  if (!normalized) {
    return false;
  }
  const fullPath = path.join(CLIENTS_DIR, slug, normalized);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();
}

export function loadClientWorkspace(slug) {
  const clientDir = path.join(CLIENTS_DIR, slug);
  const brandPath = path.join(clientDir, 'brand.json');
  const styleRulesPath = path.join(clientDir, 'style-rules.json');
  const batchPath = path.join(clientDir, 'batch.json');

  if (!fs.existsSync(brandPath)) {
    throw new Error(`Missing brand.json for client "${slug}" at ${brandPath}`);
  }
  if (!fs.existsSync(batchPath)) {
    throw new Error(`Missing batch.json for client "${slug}" at ${batchPath}`);
  }

  const brand = JSON.parse(fs.readFileSync(brandPath, 'utf8'));
  const styleRules = fs.existsSync(styleRulesPath)
    ? JSON.parse(fs.readFileSync(styleRulesPath, 'utf8'))
    : undefined;
  const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));

  return { clientDir, brand, styleRules, batch };
}

export function resolveClientAssets(slug, brand, job) {
  const hasLogo = clientFileExists(slug, brand.logoPath);
  const hasVoice = clientFileExists(slug, job.audio?.voicePath);
  const hasBgm = clientFileExists(slug, job.audio?.bgmPath);
  const hasTransitionSfx = clientFileExists(slug, job.audio?.transitionSfxPath);

  const validVideoSet = new Set();
  const validImageSet = new Set();
  const scenes = Array.isArray(job.scenes) ? job.scenes : [];

  for (const scene of scenes) {
    if (!scene) {
      continue;
    }
    if (scene.type === 'broll_text' && scene.videoPath) {
      const normalized = normalizeAssetPath(scene.videoPath);
      if (clientFileExists(slug, normalized)) {
        validVideoSet.add(normalized);
      }
    }
    if (scene.type === 'image_text' && scene.imagePath) {
      const normalized = normalizeAssetPath(scene.imagePath);
      if (clientFileExists(slug, normalized)) {
        validImageSet.add(normalized);
      }
    }
  }

  return {
    hasLogo,
    hasVoice,
    hasBgm,
    hasTransitionSfx,
    validVideos: Array.from(validVideoSet),
    validImages: Array.from(validImageSet),
  };
}

export const detectClientAssets = resolveClientAssets;

export function loadCaptionWords(slug, videoId) {
  const captionsPath = path.join(CLIENTS_DIR, slug, 'audio', `${videoId}.captions.json`);
  if (!fs.existsSync(captionsPath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(captionsPath, 'utf8'));
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && Array.isArray(parsed.words)) {
      return parsed.words;
    }
    return [];
  } catch (err) {
    console.warn(
      `Warning: Failed to parse captions JSON at ${captionsPath}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return [];
  }
}

export function buildInputProps(slug, workspace, job) {
  const resolvedAssets = resolveClientAssets(slug, workspace.brand, job);
  const captionWords = loadCaptionWords(slug, job.id);

  return {
    brandSlug: slug,
    brand: workspace.brand,
    styleRules: workspace.styleRules,
    job,
    resolvedAssets,
    captionWords,
  };
}

export function getOutputPaths(slug, videoId) {
  const dir = path.join(OUTPUT_DIR, slug);
  return {
    dir,
    videoPath: path.join(dir, `${videoId}.mp4`),
    captionPath: path.join(dir, `${videoId}.txt`),
  };
}

export function writeCaptionSidecar(slug, job) {
  const { dir, captionPath } = getOutputPaths(slug, job.id);
  fs.mkdirSync(dir, { recursive: true });
  const text = (job.caption || job.title || '').trim();
  fs.writeFileSync(captionPath, `${text}\n`, 'utf8');
  return captionPath;
}

export function resolveBrowserExecutable() {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) {
    return process.env.REMOTION_BROWSER_EXECUTABLE;
  }
  return undefined;
}

/**
 * Ensures requested bgmPath and transitionSfxPath exist on disk by invoking
 * `python3 scripts/ensure-sfx.py <slug> <videoId>` before asset detection.
 * Existing files (e.g. pulled from Google Drive) are never overwritten.
 */
export function ensureProceduralSfx(slug, videoId) {
  if (!fs.existsSync(ENSURE_SFX_SCRIPT)) {
    return;
  }

  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  try {
    execFileSync(pythonBin, [ENSURE_SFX_SCRIPT, slug, videoId], {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
  } catch (err) {
    if (err && typeof err === 'object' && err.code === 'ENOENT') {
      console.warn(
        `Warning: ${pythonBin} not found on PATH; skipping procedural fallback audio synthesis.`
      );
      return;
    }
    throw err;
  }
}
