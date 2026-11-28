# AGENTS.md — VideoFactory Cloud Agent Operating Manual

This repository (`mahmud-aii/video-factory`) is a **100% Cloud-Operated Multi-Brand Vertical Video Factory** built on **Remotion v4** (`1080x1920`, `60fps`, TypeScript), **Faster-Whisper** word-level captions, **Google Drive (`rclone`)**, and **GitHub Actions Parallel Matrix** rendering.

All autonomous cloud agents (Antigravity Web, CodeRabbit, CI bots) MUST follow the architecture and guardrails below.

---

## 1. Three-Engine Cloud Architecture

1. **Storage Engine — Google Drive (`gdrive:Video-Factory/clients/{slug}/`)**
   - Heavy binary assets (`audio/*.wav|mp3`, `broll/*.mp4`, `images/*.png|jpg|jpeg|webp`, `sfx/*.mp3|wav`) live **exclusively** in Google Drive and are pulled into ephemeral CI runners via `rclone copy --exclude "*.json"`.
   - **NEVER commit media binaries or rendered `.mp4` files to Git.**
2. **Control Plane — GitHub (`mahmud-aii/video-factory`)**
   - Tracks only TypeScript/React Remotion source (`src/`), Node/Python automation (`scripts/`), agent skills/rules (`.agent/`, `.agents/`), and lightweight brand/job JSONs (`clients/{slug}/{brand,style-rules,batch}.json`).
3. **Compute Engine — GitHub Actions Matrix (`.github/workflows/render-factory.yml`)**
   - All multi-video `60fps` H.264 renders run **exclusively** inside GitHub Actions parallel Matrix runners (`max-parallel: 5`, `concurrency: 2`).
   - **NEVER run full multi-video batch renders inside the Antigravity Cloud Sandbox.** Use `npm run verify` and `npm run qa:stills` (3-frame headless still smoke check) for fast, low-quota cloud verification.

---

## 2. Conductor Spec Workflow (Spec → Plan → Implement → Verify)

For any new Lego scene, audio pipeline change, or structural refactor:

1. **Spec:** Write a concise specification in `docs/specs/<slug>.md` defining input JSON schema, RTL/safe-zone behavior, missing-media fallback, and verification criteria.
2. **Plan:** Identify exact edits across `src/types.ts`, `src/scenes/SceneRouter.tsx`, and `scripts/`.
3. **Implement:** Write clean, strictly typed ESM/TypeScript code preserving all existing client workspaces.
4. **Verify:** Run the Ralph Self-Verification Loop (`npm run verify`, plus `npm run qa:stills` when modifying visual components) and delete temporary `output/` before committing.

---

## 3. Ralph Self-Verification Loop & Quota Guardrail

- After **every** code or `clients/**/*.json` modification, execute:
  ```bash
  npm run verify
  ```
- When visual scenes, fonts, or layout rules change, also execute:
  ```bash
  npm run qa:stills && rm -rf output
  ```
- **Max 3 Retries Rule:** If any install, typecheck, RTL scan, or still check fails, debug and retry **at most 3 times**. If still blocked after 3 attempts, stop retrying, document the exact error clearly, and surface it in the PR summary rather than looping.

---

## 4. Hard Remotion v4 & Multi-Brand Guardrails

- **Composition Contract:** Composition ID MUST remain `FactoryReel` (`1080x1920`, `60fps`) in `src/Root.tsx`.
- **Public Directory Parity:** `publicDir` MUST be `./clients` in **both** `remotion.config.ts` (`Config.setPublicDir('./clients')`) and every programmatic `bundle({ entryPoint, publicDir: path.resolve('clients') })` call.
- **Asset Path Normalization:** All relative paths in `brand.json` and `batch.json` (`logos/`, `images/`, `broll/`, `audio/`, `sfx/`) MUST use forward slashes (`/`) and resolve through `clientAsset(brandSlug, relativePath)` (`src/lib/assets.ts`). Backslashes (`\`) are forbidden.
- **Scene Registration & Zero-Crash Fallbacks:**
  - Every Lego scene (`hook`, `stat`, `broll_text`, `image_text`, `comparison`, `ui_card`, `whatsapp_chat`, `bar_chart`, `timeline_steps`, `cta`) MUST be typed in `src/types.ts` (`SceneItem`), normalized in `formatSceneForBidi`, and routed in `src/scenes/SceneRouter.tsx`.
  - Never render `<OffthreadVideo>`, `<Img>`, or `<Audio>` for client files unless verified present in `resolvedAssets` (`validVideos`, `validImages`, `hasLogo`, `hasVoice`, `hasBgm`, `hasTransitionSfx`). Missing visuals MUST degrade gracefully to styled brand dot-grid fallbacks or clean omission.
  - Scene `weight` values in production `batch.json` jobs SHOULD sum to `100` (remainder frames are assigned to the final scene so zero black frames occur).
- **Strict RTL Typography & Fonts:**
  - Load `Cairo`, `Vazirmatn`, `Inter`, and `JetBrainsMono` at module scope in `src/lib/fonts.ts` via `@remotion/google-fonts`.
  - Enforce `letterSpacing: '0px'` and `direction: brand.dir` on **all** Arabic, Dari, Persian, and Pashto text (`rtlSafeTextStyle`). Non-zero `letterSpacing` is only permitted on isolated `direction: 'ltr'` numeric/Latin spans.
  - Isolate compound LTR tokens (`24.ofis`, `@24.ofis`, `+93 76 584 3613`, `SEO/GEO`, `24/7`) via `formatBidiText` (`src/lib/rtl.ts`).
- **Mobile Safe Zones & Captions:**
  - Keep primary content within `9:16` safe zones: `top >= 220px`, `bottom >= 340px`, `horizontal >= 64px`.
  - `src/components/CaptionOverlay.tsx` renders 3–4 word Faster-Whisper chunks at `bottom: 340px`, highlighting the active spoken word in `brand.primary` with `letterSpacing: '0px'` for RTL.
- **Brand-Specific Compliance (`khidmatyar`):**
  - Unified spelling `خدمت يار` (`خدمت يار | KHIDMATYAR`), restrained gold `#D4AF37` strictly `<= 5%` of frame area, `noIconRotation: true` (zero spinning/tilted icons), zero neon glow, modest Afghan cultural framing.
- **GitHub OAuth Workflow Safeguard:**
  - Do NOT edit `.github/workflows/*.yml` from cloud OAuth tokens lacking `workflow` scope; place proposed workflow step snippets under `workflows/` so `git push` never gets rejected.

---

## 5. Installed Agent Skills & Commands

- Official Remotion skills: `.agents/skills/remotion-*` (14 official `remotion-dev/skills` modules) + `.agent/skills/remotion/SKILL.md`.
- Standards rulebook: `.agent/rules/video-factory-standards.md`.
- Key CLI scripts:
  - `npm run verify` — JSON schema + path + scene weight + static RTL + `tsc --noEmit` preflight.
  - `npm run qa:stills` — Full preflight + 3-frame headless Chromium still smoke test (`start`, `mid`, `end`).
  - `npm run preflight:media -- <slug> [videoId] [--strict] [--normalize]` — Non-destructive `ffprobe`/`ffmpeg` media inspector & loudness normalizer.
  - `npm run plan -- <slug|all>` — Inspect GitHub Actions Matrix payload locally.
  - `npm run new-client -- <slug> "Display Name"` — Clone `clients/_template` into a new brand workspace.
