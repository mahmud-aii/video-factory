#!/usr/bin/env node
// VideoFactory Pre-Render QA & Headless Visual Still Smoke Check
//
// Usage:
//   node scripts/qa-preflight.mjs [--with-stills]
//
// Checks:
//   1. Client Workspace & JSON Schema Validation (brand.json, style-rules.json, batch.json)
//      - Valid JSON, forward-slash relative paths only, supported scene types,
//        concurrency <= 2 check, scene weight sum != 100 warning, and non-template
//        demo_001 enabled warning.
//   2. Remotion PublicDir & FactoryReel Composition Contract Check.
//   3. Static RTL Typography Guard across src/**/*.tsx (blocks non-zero letterSpacing
//      unless explicitly scoped to an LTR container).
//   4. TypeScript Compiler Check (`npx tsc --noEmit`).
//   5. Optional Headless Visual Smoke Check (`--with-stills`): renders 3 key frames
//      (start, mid, end) of `FactoryReel` via `npx remotion still` into `output/qa-stills/`
//      using zero external Google Drive media.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CLIENTS_DIR = path.join(ROOT_DIR, 'clients');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const STILLS_DIR = path.join(ROOT_DIR, 'output', 'qa-stills');

const SUPPORTED_SCENE_TYPES = new Set([
  'hook',
  'stat',
  'broll_text',
  'image_text',
  'comparison',
  'ui_card',
  'whatsapp_chat',
  'bar_chart',
  'timeline_steps',
  'cta',
]);

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function walkFiles(dir, extFilter) {
  const results = [];
  if (!fs.existsSync(dir)) {
    return results;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, extFilter));
    } else if (entry.isFile() && extFilter(entry.name)) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

function validateRelativeForwardSlashPath(rawPath, contextLabel, errors) {
  if (rawPath === undefined || rawPath === null || rawPath === '') {
    return;
  }
  if (typeof rawPath !== 'string') {
    errors.push(`${contextLabel}: expected string path, got ${typeof rawPath}`);
    return;
  }
  if (rawPath.includes('\\')) {
    errors.push(`${contextLabel}: backslashes are forbidden ("${rawPath}") — use forward slashes "/"`);
  }
  if (rawPath.startsWith('/') || /^[A-Za-z]:/.test(rawPath)) {
    errors.push(
      `${contextLabel}: absolute paths are forbidden ("${rawPath}") — use path relative to clients/<slug>/`
    );
  }
  const segments = rawPath.split('/');
  if (segments.includes('..')) {
    errors.push(`${contextLabel}: parent traversal ".." is forbidden ("${rawPath}")`);
  }
}

function validateClientWorkspaces(errors, warnings) {
  if (!fs.existsSync(CLIENTS_DIR)) {
    errors.push('Missing clients/ directory at repository root.');
    return 0;
  }

  const clientDirs = fs
    .readdirSync(CLIENTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();

  for (const slug of clientDirs) {
    const dir = path.join(CLIENTS_DIR, slug);
    const brandFile = path.join(dir, 'brand.json');
    const styleFile = path.join(dir, 'style-rules.json');
    const batchFile = path.join(dir, 'batch.json');

    for (const [label, filePath] of [
      ['brand.json', brandFile],
      ['style-rules.json', styleFile],
      ['batch.json', batchFile],
    ]) {
      if (!fs.existsSync(filePath)) {
        errors.push(`clients/${slug}/${label}: missing required file`);
      }
    }

    if (!fs.existsSync(brandFile) || !fs.existsSync(styleFile) || !fs.existsSync(batchFile)) {
      continue;
    }

    let brand;
    let styleRules;
    let batch;

    try {
      brand = JSON.parse(fs.readFileSync(brandFile, 'utf8'));
    } catch (err) {
      errors.push(
        `clients/${slug}/brand.json: invalid JSON (${err instanceof Error ? err.message : String(err)})`
      );
      continue;
    }

    try {
      styleRules = JSON.parse(fs.readFileSync(styleFile, 'utf8'));
    } catch (err) {
      errors.push(
        `clients/${slug}/style-rules.json: invalid JSON (${
          err instanceof Error ? err.message : String(err)
        })`
      );
      continue;
    }

    try {
      batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    } catch (err) {
      errors.push(
        `clients/${slug}/batch.json: invalid JSON (${err instanceof Error ? err.message : String(err)})`
      );
      continue;
    }

    // Validate brand.json
    if (!brand.name || typeof brand.name !== 'string') {
      errors.push(`clients/${slug}/brand.json: missing string "name"`);
    }
    if (brand.dir !== 'rtl' && brand.dir !== 'ltr') {
      errors.push(`clients/${slug}/brand.json: "dir" must be "rtl" or "ltr" (got "${brand.dir}")`);
    }
    if (!brand.fontFamily || typeof brand.fontFamily !== 'string') {
      errors.push(`clients/${slug}/brand.json: missing string "fontFamily"`);
    }
    for (const colorKey of ['bg', 'surface', 'primary', 'accent', 'text']) {
      if (!HEX_COLOR_REGEX.test(String(brand[colorKey] || ''))) {
        errors.push(
          `clients/${slug}/brand.json: "${colorKey}" must be a valid hex color (got "${brand[colorKey]}")`
        );
      }
    }
    validateRelativeForwardSlashPath(
      brand.logoPath,
      `clients/${slug}/brand.json#logoPath`,
      errors
    );

    // Validate style-rules.json safeZones & RTL letterSpacing if specified
    const rtlRuleSpacing = styleRules?.rtlRules?.letterSpacing ?? styleRules?.captionStyle?.rtlLetterSpacing;
    if (rtlRuleSpacing !== undefined && rtlRuleSpacing !== '0px') {
      errors.push(
        `clients/${slug}/style-rules.json: RTL letterSpacing must be "0px" (got "${rtlRuleSpacing}")`
      );
    }

    // Validate batch.json
    if (typeof batch.settings?.concurrency === 'number' && batch.settings.concurrency > 2) {
      warnings.push(
        `clients/${slug}/batch.json: settings.concurrency=${batch.settings.concurrency} (> 2 risks GitHub Actions runner OOM)`
      );
    }

    if (!Array.isArray(batch.videos) || batch.videos.length === 0) {
      warnings.push(`clients/${slug}/batch.json: "videos" array is empty`);
      continue;
    }

    for (const job of batch.videos) {
      const jobLabel = `clients/${slug}/batch.json [video="${job?.id || 'unknown'}"]`;
      if (!job?.id || typeof job.id !== 'string') {
        errors.push(`${jobLabel}: missing string "id"`);
        continue;
      }

      if (slug !== '_template' && job.id === 'demo_001' && job.enabled !== false) {
        warnings.push(
          `${jobLabel}: demo_001 is left "enabled": true on non-template client "${slug}" (will consume CI minutes on push)`
        );
      }

      validateRelativeForwardSlashPath(job.audio?.voicePath, `${jobLabel}#audio.voicePath`, errors);
      validateRelativeForwardSlashPath(job.audio?.bgmPath, `${jobLabel}#audio.bgmPath`, errors);
      validateRelativeForwardSlashPath(
        job.audio?.transitionSfxPath,
        `${jobLabel}#audio.transitionSfxPath`,
        errors
      );

      if (!Array.isArray(job.scenes) || job.scenes.length === 0) {
        errors.push(`${jobLabel}: "scenes" must be a non-empty array`);
        continue;
      }

      let weightSum = 0;
      for (let idx = 0; idx < job.scenes.length; idx++) {
        const scene = job.scenes[idx];
        const sceneLabel = `${jobLabel} scene[${idx}]`;
        if (!scene || !SUPPORTED_SCENE_TYPES.has(scene.type)) {
          errors.push(
            `${sceneLabel}: unsupported scene type "${scene?.type}" (supported: ${Array.from(
              SUPPORTED_SCENE_TYPES
            ).join(', ')})`
          );
          continue;
        }
        const weight = Number(scene.weight);
        if (!Number.isFinite(weight) || weight <= 0) {
          errors.push(`${sceneLabel} (${scene.type}): "weight" must be a positive number`);
        } else {
          weightSum += weight;
        }

        if (scene.type === 'broll_text') {
          validateRelativeForwardSlashPath(scene.videoPath, `${sceneLabel}#videoPath`, errors);
        }
        if (scene.type === 'image_text') {
          validateRelativeForwardSlashPath(scene.imagePath, `${sceneLabel}#imagePath`, errors);
        }
      }

      if (Math.round(weightSum * 100) / 100 !== 100) {
        warnings.push(
          `${jobLabel} (enabled=${job.enabled !== false}): scene weights sum to ${weightSum} (recommended canonical total is 100)`
        );
      }
    }
  }

  return clientDirs.length;
}

function validateRemotionContracts(errors) {
  const configPath = path.join(ROOT_DIR, 'remotion.config.ts');
  if (!fs.existsSync(configPath)) {
    errors.push('Missing remotion.config.ts');
  } else {
    const content = fs.readFileSync(configPath, 'utf8');
    if (!/setPublicDir\(\s*['"]\.\/clients['"]\s*\)/.test(content)) {
      errors.push('remotion.config.ts must call Config.setPublicDir("./clients")');
    }
  }

  const rootPath = path.join(SRC_DIR, 'Root.tsx');
  if (!fs.existsSync(rootPath)) {
    errors.push('Missing src/Root.tsx');
  } else {
    const content = fs.readFileSync(rootPath, 'utf8');
    if (!/id\s*=\s*['"]FactoryReel['"]/.test(content)) {
      errors.push('src/Root.tsx must register Composition id="FactoryReel"');
    }
  }
}

function extractEnclosingObjectBlock(lines, targetLineIdx) {
  let start = targetLineIdx;
  let depth = 0;
  for (let i = targetLineIdx; i >= Math.max(0, targetLineIdx - 25); i--) {
    for (let c = lines[i].length - 1; c >= 0; c--) {
      const ch = lines[i][c];
      if (ch === '}') depth++;
      if (ch === '{') {
        if (depth === 0) {
          start = i;
          i = -1;
          break;
        }
        depth--;
      }
    }
  }

  let end = targetLineIdx;
  depth = 0;
  for (let i = targetLineIdx; i <= Math.min(lines.length - 1, targetLineIdx + 25); i++) {
    for (let c = 0; c < lines[i].length; c++) {
      const ch = lines[i][c];
      if (ch === '{') depth++;
      if (ch === '}') {
        if (depth === 0) {
          end = i;
          i = lines.length;
          break;
        }
        depth--;
      }
    }
  }

  return lines.slice(start, end + 1).join('\n');
}

function runStaticRtlGuard(errors) {
  const tsxFiles = walkFiles(SRC_DIR, (name) => name.endsWith('.tsx'));

  for (const filePath of tsxFiles) {
    const relFile = path.relative(ROOT_DIR, filePath);
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split('\n');

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      const match = line.match(/letterSpacing\s*:\s*([^,\n}]+)/);
      if (!match) {
        continue;
      }

      const expr = match[1].trim();
      const isZeroLiteral =
        expr === "'0px'" ||
        expr === '"0px"' ||
        expr === '0' ||
        expr === "'0'" ||
        expr === '"0"' ||
        expr === "'normal'" ||
        expr === '"normal"';

      if (isZeroLiteral) {
        continue;
      }

      const block = extractEnclosingObjectBlock(lines, idx);
      const hasExplicitLtrGuard =
        /direction\s*:\s*['"]ltr['"]/.test(block) ||
        /dir\s*===\s*['"]ltr['"]/.test(block) ||
        /!isRtl/.test(block) ||
        /isRtl\s*\?\s*['"]0px['"]/.test(block);

      if (!hasExplicitLtrGuard) {
        errors.push(
          `${relFile}:${idx + 1}: unguarded non-zero letterSpacing (${expr}) in TSX — lock to '0px' for RTL or add explicit direction: 'ltr' guard`
        );
      }
    }
  }

  return tsxFiles.length;
}

function runTypecheck(errors) {
  const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  try {
    execFileSync(npxBin, ['--no-install', 'tsc', '--noEmit'], {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      encoding: 'utf8',
    });
  } catch (err) {
    const stdout = err && typeof err === 'object' && 'stdout' in err ? String(err.stdout || '') : '';
    const stderr = err && typeof err === 'object' && 'stderr' in err ? String(err.stderr || '') : '';
    errors.push(`TypeScript check failed:\n${(stdout + '\n' + stderr).trim()}`);
  }
}

function runHeadlessStillSmokeCheck(errors) {
  fs.mkdirSync(STILLS_DIR, { recursive: true });
  const propsPath = path.join(STILLS_DIR, 'smoke-props.json');

  const smokeProps = {
    brandSlug: 'tekviyo',
    brand: {
      name: 'TEKVIYO',
      dir: 'rtl',
      fontFamily: 'Cairo',
      bg: '#0B0F19',
      surface: '#151C2C',
      primary: '#10B981',
      accent: '#34D399',
      text: '#F8FAFC',
      mutedText: '#94A3B8',
      logoPath: 'logos/logo.png',
      handle: '@tekviyo',
    },
    styleRules: {
      pacing: {
        style: 'snappy',
        defaultFps: 60,
        minSceneSeconds: 0.9,
        breathingRoomSeconds: 0.5,
      },
      safeZones: { top: 220, bottom: 340, horizontal: 72 },
      transitionStyle: 'spring-cut',
      captionStyle: {
        wordsPerChunk: 4,
        bottomOffset: 340,
        fontSize: 52,
        highlightActiveWord: true,
        rtlLetterSpacing: '0px',
      },
    },
    job: {
      id: 'qa_smoke_001',
      enabled: true,
      title: 'QA Headless Still Smoke Check',
      audio: {
        fallbackSeconds: 4,
      },
      captions: {
        enabled: true,
        language: 'ar',
        wordsPerChunk: 4,
      },
      scenes: [
        {
          type: 'hook',
          weight: 34,
          badge: 'فحص الجودة السحابي',
          headline: 'تأكد من سلامة التصميم قبل الرندر',
          subtext: 'اختبار آلي للخطوط العربية والهوامش الآمنة',
        },
        {
          type: 'stat',
          weight: 33,
          value: 100,
          suffix: '%',
          label: 'جاهزية خط الإنتاج السحابي',
          sublabel: 'بدون الحاجة إلى ملفات خارجية',
        },
        {
          type: 'cta',
          weight: 33,
          eyebrow: 'TEKVIYO',
          headline: 'جاهز للرندر المتوازي على GitHub Actions',
          ctaText: 'ابدأ الدفعة الآن',
        },
      ],
    },
    resolvedAssets: {
      hasLogo: false,
      hasVoice: false,
      hasBgm: false,
      hasTransitionSfx: false,
      validVideos: [],
      validImages: [],
    },
    captionWords: [
      { word: 'فحص', start: 0.1, end: 0.45 },
      { word: 'تلقائي', start: 0.45, end: 0.9 },
      { word: 'وسريع', start: 0.9, end: 1.4 },
      { word: 'للخطوط', start: 1.6, end: 2.1 },
      { word: 'والهوامش', start: 2.1, end: 2.6 },
    ],
  };

  fs.writeFileSync(propsPath, `${JSON.stringify(smokeProps, null, 2)}\n`, 'utf8');

  // 4.0s @ 60fps = 240 frames (0..239) -> test start (f=20), mid (f=120), end (f=215)
  const targets = [
    { label: 'start', frame: 20, file: 'still-start-f20.png' },
    { label: 'mid', frame: 120, file: 'still-mid-f120.png' },
    { label: 'end', frame: 215, file: 'still-end-f215.png' },
  ];

  const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  for (const target of targets) {
    const outPath = path.join(STILLS_DIR, target.file);
    console.log(
      `  [STILL] Rendering ${target.label} frame=${target.frame} -> ${path.relative(
        ROOT_DIR,
        outPath
      )}...`
    );

    const args = [
      '--no-install',
      'remotion',
      'still',
      'src/index.ts',
      'FactoryReel',
      outPath,
      `--frame=${target.frame}`,
      `--props=${propsPath}`,
      '--public-dir=./clients',
      '--overwrite',
    ];
    if (process.env.REMOTION_BROWSER_EXECUTABLE) {
      args.push(`--browser-executable=${process.env.REMOTION_BROWSER_EXECUTABLE}`);
    }

    try {
      execFileSync(npxBin, args, {
        cwd: ROOT_DIR,
        stdio: 'inherit',
      });

      if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 5000) {
        errors.push(`Still output missing or unexpectedly empty: ${outPath}`);
      } else {
        const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
        console.log(`  [OK] ${target.file} (${kb} KB)`);
      }
    } catch (err) {
      errors.push(
        `Remotion still smoke test failed at frame ${target.frame}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      break;
    }
  }
}

function main() {
  const args = new Set(process.argv.slice(2));
  const withStills = args.has('--with-stills');

  const errors = [];
  const warnings = [];

  console.log('\n=== VideoFactory QA Preflight ===');

  console.log('1/4 Validating client workspaces & JSON schemas...');
  const clientCount = validateClientWorkspaces(errors, warnings);
  validateRemotionContracts(errors);
  console.log(`    Checked ${clientCount} client workspace(s).`);

  console.log('2/4 Running static RTL letterSpacing guard across src/**/*.tsx...');
  const tsxCount = runStaticRtlGuard(errors);
  console.log(`    Scanned ${tsxCount} TSX component file(s).`);

  console.log('3/4 Running TypeScript compiler check (tsc --noEmit)...');
  runTypecheck(errors);
  if (errors.length === 0) {
    console.log('    TypeScript check passed (0 errors).');
  }

  if (withStills && errors.length === 0) {
    console.log('4/4 Running Headless Visual Still Smoke Test (3 frames)...');
    runHeadlessStillSmokeCheck(errors);
  } else if (!withStills) {
    console.log('4/4 Headless visual stills skipped (pass --with-stills or run `npm run qa:stills`).');
  }

  if (warnings.length > 0) {
    console.log(`\n--- Advisory Warnings (${warnings.length}) ---`);
    for (const warning of warnings) {
      console.warn(`  [WARN] ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.error(`\n--- QA Preflight FAILED (${errors.length} error(s)) ---`);
    for (const error of errors) {
      console.error(`  [FAIL] ${error}`);
    }
    process.exit(1);
  }

  console.log('\n[PASS] VideoFactory QA Preflight succeeded with 0 errors.\n');
}

main();
