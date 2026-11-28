---
trigger: always_on
description: Mandatory architecture, RTL typography, safe-zone, media preflight, and cloud CI rules for VideoFactory (Remotion v4).
---

# VideoFactory Standards & Cloud Guardrails

## 1. Three-Engine Separation (Drive + GitHub + Actions Matrix)
- **Google Drive (`Video-Factory/clients/{slug}/`):** Single source of truth for heavy media (`audio/`, `images/`, `broll/`, `logos/`, `sfx/`). Never commit `.mp4`, `.mov`, `.wav`, `.mp3`, `.jpg`, `.jpeg`, `.webp`, or `clients/**/images/*.png` to Git.
- **GitHub Repository:** Code (`src/`, `scripts/`), agent configs, and lightweight client JSON (`brand.json`, `style-rules.json`, `batch.json`).
- **GitHub Actions Matrix (`render-factory.yml`):** Exclusive compute engine for full `60fps` multi-video renders (`concurrency: 2`, `max-parallel: 5`). Never run multi-video batch renders inside the Antigravity remote sandbox.

## 2. Conductor Spec Workflow
- Before building a new Lego scene or refactoring core timing/audio logic:
  1. Draft a short spec in `docs/specs/<feature-name>.md`.
  2. Plan affected types (`src/types.ts`) and scene views (`src/scenes/SceneRouter.tsx`).
  3. Implement with null-safe props and `resolvedAssets` fallbacks.
  4. Verify via `npm run verify` (and `npm run qa:stills` for visual changes), then clean `output/`.

## 3. Ralph Self-Verification Loop (Max 3 Retries)
- Run `npm run verify` after every TypeScript, script, or JSON edit.
- Cap automated fix/retry loops at **3 iterations maximum** per failure. If a blocker persists after 3 attempts, log the root cause clearly and stop retrying.
- Always remove `output/` (`rm -rf output`) before `git add` / `git commit`.

## 4. Remotion v4 & RTL Production Rules
1. **Composition & Public Dir:**
   - Composition ID: `FactoryReel` (`1080x1920`, `60fps`).
   - `publicDir`: `'./clients'` in both `remotion.config.ts` and `bundle({ entryPoint, publicDir: path.resolve('clients') })`.
2. **Asset Paths & Fallbacks:**
   - Use forward slashes (`/`) only on all relative paths; resolve via `clientAsset(brandSlug, relativePath)`.
   - Guard all external media behind `resolvedAssets` (`hasLogo`, `hasVoice`, `hasBgm`, `hasTransitionSfx`, `validVideos`, `validImages`). Missing media must render a clean visual fallback (e.g., animated dot-grid) and never crash Remotion.
   - Keep `concurrency <= 2` in `renderMedia()` to prevent GitHub Actions runner OOM kills.
3. **Strict RTL Safety:**
   - Load `Cairo`, `Vazirmatn`, `Inter`, and `JetBrainsMono` at module scope in `src/lib/fonts.ts`.
   - Lock `letterSpacing: '0px'` and `direction: brand.dir` on all RTL text (`Arabic`, `Dari`, `Persian`, `Pashto`). Non-zero `letterSpacing` is forbidden unless explicitly scoped to a `direction: 'ltr'` element.
   - Wrap text containing compound LTR tokens (domains, `@handles`, `+phone`, `24/7`) with `formatBidiText(text, brand.dir)`.
4. **Safe Zones, Weights & Captions:**
   - Respect mobile vertical safe zones: `top >= 220px`, `bottom >= 340px`, `horizontal >= 64px`.
   - Target `sum(scene.weight) === 100` on production `batch.json` videos; disable `demo_001` (`"enabled": false`) on non-template client workspaces when not actively testing.
   - Sync `CaptionOverlay.tsx` to Faster-Whisper word timestamps (`3–4` words/chunk, `bottom: 340px`, `brand.primary` active-word highlight).
5. **Client Brand DNA (`khidmatyar`):**
   - Spelling: `خدمت يار` (`خدمت يار | KHIDMATYAR`).
   - Gold `#D4AF37` strictly `<= 5%` visual budget; `noIconRotation: true`; modest visuals; zero neon glare.
6. **Workflow OAuth Safety:**
   - Never modify `.github/workflows/render-factory.yml` directly unless `workflow` token scope is confirmed; write proposed workflow steps to `workflows/qa-step-snippet.yml`.
