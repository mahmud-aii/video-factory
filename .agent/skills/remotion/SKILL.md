---
name: remotion-video-factory
description: Remotion v4 rules tailored for VideoFactory (1080x1920 60fps multi-brand RTL reels, publicDir ./clients, resolvedAssets fallbacks, and headless still verification).
---

# Remotion v4 Skill — VideoFactory Edition

Use this skill alongside the official Remotion skills in `.agents/skills/remotion-*` whenever creating or modifying compositions, scenes, animations, captions, or render scripts in `mahmud-aii/video-factory`.

## Core Remotion v4 Rules

1. **Frame-Driven Determinism:**
   - Drive every animation exclusively from `useCurrentFrame()` and `useVideoConfig()` using `spring()` or `interpolate(..., { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })`.
   - Never use CSS transitions, `setTimeout`, `requestAnimationFrame`, or `Math.random()` inside render components.
2. **Media Components & Safe Mounting:**
   - Use `<OffthreadVideo muted />` from `remotion` for B-roll (`broll_text`), `<Img />` for still images/logos (`image_text`, `cta`), and `<Audio />` for voiceover, BGM, and transition SFX.
   - Always check `resolvedAssets` (`validVideos`, `validImages`, `hasLogo`, `hasVoice`, `hasBgm`, `hasTransitionSfx`) **before** mounting media tags so missing Google Drive files never fail `delayRender()`.
3. **Public Directory & `staticFile`:**
   - `publicDir` is `./clients`. Always construct URLs with `clientAsset(brandSlug, relativePath)` (`staticFile(`${slug}/${normalizedPath}`)`), using forward slashes (`/`) only.
4. **Module-Scope Google Fonts & RTL Safety:**
   - Import and invoke `loadFont()` from `@remotion/google-fonts/{Cairo,Vazirmatn,Inter,JetBrainsMono}` at module top-level in `src/lib/fonts.ts` with explicit weights and subsets (`['arabic', 'latin']`).
   - Apply `rtlSafeTextStyle(brand, overrides)` on all text; never apply non-zero `letterSpacing` to RTL text (`letterSpacing: '0px'` mandatory).
5. **Dynamic Metadata & Proportional Timing:**
   - `calculateMetadata` in `src/Root.tsx` measures `voicePath` via `getAudioDurationInSeconds` (`+ 0.5s` breathing room) when `resolvedAssets.hasVoice` is true, falling back cleanly to `job.audio.fallbackSeconds`.
   - `computeSceneTimings` (`src/lib/timing.ts`) distributes frames proportionally by `scene.weight` and assigns rounding remainders to the final scene for zero black frames.
6. **Cloud Sandbox Verification:**
   - Verify edits with `npm run verify` and `npm run qa:stills` (renders start/mid/end stills via `remotion still` with zero external media), then delete `output/`.
