# VideoFactory — 100% Cloud-Operated Multi-Brand Video Factory

A production-ready, zero-local-hardware multi-brand vertical video automation pipeline built with **Remotion v4** (`1080x1920`, `60fps`, TypeScript), **Faster-Whisper** word-level auto-captions, and **GitHub Actions parallel Matrix rendering** with **Google Drive (`rclone`)** asset sync.

## Architecture Overview

```text
video-factory/
├── clients/                      # Remotion publicDir ("./clients")
│   ├── _template/                # Golden starter template cloned by new-client
│   │   ├── brand.json            # Palette, RTL/LTR direction, fontFamily, logoPath
│   │   ├── style-rules.json      # Pacing, mobile safe zones, caption & visual DNA
│   │   ├── batch.json            # Video jobs + scenes + audio/caption settings
│   │   ├── logos/.gitkeep        # Brand logos (logo.png)
│   │   ├── audio/.gitkeep        # Voiceovers (.wav/.mp3), BGM, .captions.json (media gitignored)
│   │   ├── images/.gitkeep       # Ken Burns still images (.png/.jpg/.jpeg/.webp gitignored)
│   │   ├── broll/.gitkeep        # B-roll clips (.mp4 gitignored)
│   │   └── sfx/.gitkeep          # Optional transition SFX (e.g. sfx/whoosh.mp3, gitignored)
│   ├── tekviyo/                  # TEKVIYO (@tekviyo) — dark tech (#0B0F19) + emerald (#10B981), RTL Cairo
│   ├── 24ofis/                   # 24.ofis (@24.ofis) — navy (#0F172A) + amber (#F59E0B), RTL Cairo
│   ├── 24wats/                   # 24wats (@24wats) — deep green (#071A12) + WhatsApp green (#25D366), RTL Cairo
│   └── khidmatyar/               # خدمت يار | KHIDMATYAR (@khidmatyar) — emerald (#071A12), ivory (#F7F6F2), <=5% gold (#D4AF37), Vazirmatn/Cairo
├── src/
│   ├── index.ts                  # Remotion entry point
│   ├── Root.tsx                  # FactoryReel composition (1080x1920 @ 60fps) + calculateMetadata
│   ├── FactoryVideo.tsx          # Proportional scene scheduler, 0.4s BGM fade-out, transition SFX, progress bar, captions
│   ├── types.ts                  # Strict TypeScript schemas (SceneItem, ResolvedAssets, etc.)
│   ├── components/
│   │   └── CaptionOverlay.tsx    # 3–4 word chunked captions, active-word highlight, RTL-safe
│   ├── scenes/
│   │   └── SceneRouter.tsx       # 7 Lego scenes: hook, stat, broll_text, image_text, comparison, ui_card, cta
│   └── lib/
│       ├── fonts.ts              # Module-scope Google Fonts (Cairo, Vazirmatn, Inter, JetBrainsMono)
│       ├── assets.ts             # Forward-slash clientAsset() resolver
│       ├── rtl.ts                # Strict RTL safety (letterSpacing: 0px, safe zones >= 64px)
│       ├── timing.ts             # Proportional weight-based frame allocator (zero black frames)
│       └── color.ts              # Hex/RGBA & luminance contrast ink helpers
├── scripts/
│   ├── new-client.mjs            # One-command client workspace generator
│   ├── plan-matrix.mjs           # GitHub Actions dynamic matrix planner
│   ├── render-one.mjs            # Single-video Remotion cloud renderer + .txt caption sidecar
│   ├── night-factory.mjs         # Sequential local/fallback batch runner (bundles once)
│   ├── transcribe.py             # Standalone Faster-Whisper (small, cpu, int8) word timestamps
│   ├── ensure-sfx.py             # Procedural fallback ambient BGM & transition whoosh synthesizer (stdlib + ffmpeg)
│   ├── media-preflight.mjs       # Non-destructive ffprobe/ffmpeg media inspector & loudness normalizer
│   ├── qa-preflight.mjs          # Pre-render JSON/RTL/TypeScript QA + 3-frame headless still smoke check
│   └── lib/factory-utils.mjs     # Shared workspace, resolvedAssets (validVideos/validImages/hasTransitionSfx), and captions
├── docs/
│   ├── CLOUD_MCP_SETUP.md        # 1-click Antigravity MCP & CodeRabbit setup guide
│   └── specs/README.md           # Conductor Spec Workflow template
├── AGENTS.md                     # Autonomous Cloud Agent operating manual & guardrails
├── .coderabbit.yaml              # Factory-tuned AI PR review configuration
├── .github/workflows/
│   └── render-factory.yml        # Parallel Matrix GitHub Actions pipeline (max-parallel: 5)
├── workflows/
│   ├── render-factory.yml        # Backup copy of the workflow file
│   └── qa-step-snippet.yml       # Optional strict media-preflight CI step snippet
└── remotion.config.ts            # Remotion v4 config (publicDir: "./clients")
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Preview in Remotion Studio

```bash
npm run dev
```

### 3. Render a Single Video Locally

Every brand includes a 4-second `demo_001` reel requiring **zero external media** (disabled by default in starter `batch.json` files so cloud runs skip demos unless enabled):

```bash
npm run render-one -- 24ofis demo_001
```

Outputs are written to:
- `output/24ofis/demo_001.mp4` (H.264, `1080x1920`, `60fps`)
- `output/24ofis/demo_001.txt` (social media post caption)

### 4. Create a New Client Workspace

```bash
npm run new-client -- acme-cloud "Acme Cloud"
```

Validates lowercase `a-z0-9-`, clones `clients/_template/`, updates `brand.json`, and prints Google Drive asset instructions.

### 5. Plan Matrix or Run Sequential Night Batch

```bash
# Inspect the GitHub Actions job matrix locally
npm run plan -- all
npm run plan -- 24ofis

# Run all enabled jobs sequentially (bundles once, skips existing MP4s)
npm run factory
npm run factory -- 24ofis
npm run factory -- all --force
```

## Modular Lego Scenes (`src/scenes/SceneRouter.tsx`)

| Scene Type | Purpose | Graceful Fallbacks |
| --- | --- | --- |
| `hook` | Kinetic badge + display headline + animated accent bar + subtext | Optional subtext |
| `stat` | Animated counting metric (`prefix`, `value`, `suffix`) + label | Tabular monospace LTR number cluster inside RTL layouts |
| `broll_text` | Muted `<OffthreadVideo>` + dark gradient overlay + kinetic text | Styled animated dot-grid canvas when video file is missing |
| `image_text` | Ken Burns `<Img>` (`zoom: "in"` 1.0→1.12 or `"out"` 1.12→1.0) + dark readability gradient + RTL text | Styled animated dot-grid canvas when image file is missing |
| `comparison` | High-contrast Before / After cards stacked for 9:16 mobile | Optional eyebrow & headline |
| `ui_card` | Clean SaaS or WhatsApp (`variant: "saas" \| "whatsapp"`) notification card | Supports plain strings or `{ title, detail, status }` items |
| `cta` | Brand logo + bold closing headline + animated CTA pill | Hides logo gracefully when `logoPath` file is missing |

All RTL brands enforce `direction: "rtl"`, `letterSpacing: "0px"`, and `>= 64px` horizontal padding inside 9:16 mobile safe zones. Audio tracks support smooth **0.4s** BGM end fade-out and optional `audio.transitionSfxPath` (e.g. `sfx/whoosh.mp3`) played softly (`volume: 0.25`) at scene transitions from scene index 1 onward when present.

## Auto-Captions (`Faster-Whisper`)

To transcribe a voiceover locally into word-level JSON:

```bash
pip install faster-whisper
python3 scripts/transcribe.py clients/tekviyo/audio/demo_001.wav clients/tekviyo/audio/demo_001.captions.json ar
```

Output format:

```json
{
  "words": [
    { "word": "مرحباً", "start": 0.0, "end": 0.35 }
  ]
}
```

When `clients/{slug}/audio/{videoId}.captions.json` is present, `CaptionOverlay` automatically renders crisp 3–4 word chunks at `bottom: 340px`, highlighting the active spoken word in `brand.primary`.

## Cloud Automation (GitHub Actions + Google Drive)

The workflow `.github/workflows/render-factory.yml` triggers automatically on:
- **Manual dispatch** (`workflow_dispatch`) with `client` (`tekviyo` or `all`) and `force_rerender` (`false` / `true`).
- **Push to `main`** strictly when `clients/**/batch.json` changes.

### Optional Repository Secrets

| Secret | Purpose |
| --- | --- |
| `RCLONE_CONF_BASE64` | Base64-encoded `~/.config/rclone/rclone.conf` containing a `gdrive:` remote. Syncs `gdrive:Video-Factory/clients/{slug}` (excluding `*.json`) and uploads renders to `gdrive:Video-Factory/output/{slug}`. |
| `TG_BOT_TOKEN` | Optional Telegram Bot API token for per-video completion/failure alerts. |
| `TG_CHAT_ID` | Optional Telegram chat/channel ID for alerts. |

Even without Google Drive configured, every rendered video and caption `.txt` is uploaded as a GitHub Actions Artifact (`video-{slug}-{videoId}`, retained for 3 days).

### Generating `RCLONE_CONF_BASE64`

```bash
rclone config   # Configure remote named "gdrive"
base64 -w 0 ~/.config/rclone/rclone.conf
```