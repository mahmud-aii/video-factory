# Cloud MCP & Integrations Quick Guide (`VideoFactory`)

This concise checklist covers the **1-click cloud integrations** you can toggle from your tablet/browser inside **Antigravity Web** and **GitHub** — zero local CLI setup required.

---

## 1. Billing Safety Check (Do This First)

- Open **Antigravity Settings → Billing / Usage**.
- Confirm **`AI Credit Overages`** is set to **`Never`** so autonomous cloud sessions never exceed your plan quota.

---

## 2. Recommended Antigravity Web MCP Toggles

Open **Antigravity → Customizations / Plugins (MCP)** and enable:

1. **Context7 MCP**
   - **Why:** Streams live, version-accurate **Remotion v4**, `@remotion/renderer`, `@remotion/media-utils`, and **React 19** documentation straight into the agent context so API signatures never drift.
2. **GitHub MCP / Plugin** *(Connected)*
   - **Why:** Allows the cloud agent to inspect Pull Requests, trigger or monitor `Cloud Video Factory` Matrix runs, and read failed GitHub Actions step logs directly via `gh run view --log-failed`.
3. **Canva MCP** *(Optional OAuth)*
   - **Why:** Connects your brand kits, color palettes, and thumbnail/cover exports via OAuth when onboarding new clients into `clients/<slug>/`.

---

## 3. Enable CodeRabbit AI PR Reviews on GitHub

This repository already includes a factory-tuned [`.coderabbit.yaml`](../.coderabbit.yaml) at the root that automatically checks:
- Non-zero `letterSpacing` leaks on RTL (`Arabic` / `Dari` / `Pashto`) text
- Missing `resolvedAssets` media guards
- Backslashes or invalid paths in `clients/**/batch.json`
- Scene `weight` totals (`!= 100`) and `concurrency > 2` OOM risks
- Accidental secret/token exposure (`RCLONE_CONF_BASE64`, `TG_BOT_TOKEN`)

**To activate (1 minute):**
1. Visit `https://github.com/apps/coderabbitai` from your browser.
2. Click **Install / Configure** under `mahmud-aii` and select **`mahmud-aii/video-factory`**.
3. Every new Pull Request to `main` will automatically receive a factory-aware review.

---

## 4. Optional CI Strict Media Preflight Step

To protect OAuth tokens that don't include the `workflow` scope, `.github/workflows/render-factory.yml` was kept untouched. Whenever you edit the workflow in GitHub's web editor, you can paste the 3-line snippet from [`workflows/qa-step-snippet.yml`](../workflows/qa-step-snippet.yml) right after the `rclone copy` step to fail fast on missing voiceovers or 4K uncompressed B-roll before Remotion starts rendering.
