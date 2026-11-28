# Conductor Specs (`docs/specs/`)

Before introducing a new Lego scene, audio processor, or structural refactor, create a concise spec file in this folder (`docs/specs/<feature-slug>.md`) following the **Conductor Workflow**:

1. **Goal & Context:** Why this scene or capability is needed and which brands use it.
2. **Schema Contract:** Exact TypeScript additions to `src/types.ts` (`SceneItem`, `AudioConfig`, etc.) with forward-slash asset paths.
3. **RTL, Safe-Zone & Brand Compliance:** How `direction: brand.dir`, `letterSpacing: '0px'`, `formatBidiText`, mobile safe zones (`220px` top / `340px` bottom / `>= 64px` horizontal), and brand rules (e.g., `khidmatyar` `<= 5%` gold, `noIconRotation`) are enforced.
4. **Missing-Asset Fallback:** Exact fallback behavior when `resolvedAssets` reports media is absent in the cloud sandbox.
5. **Verification Plan:** `npm run verify` + `npm run qa:stills` checks.
