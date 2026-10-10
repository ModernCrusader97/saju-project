# Galaxy slot dialog keyboard maintenance

Basis: `8a358bd77879cabc5d884a098587d38fee7a1306` on the authorized private upstream `maint/galaxy-graphics-error-store-20261010`. Independent branch: `fix/galaxy-fallback-dialog-keyboard-20261010`. The original maintenance WIP remains at `/workspace/saju-galaxy-error-keyboard-20261010`.

The built application reproduced the checkpoint's **8 passes / 2 failures** at 390px and 1440px. Both failures were product defects: the existing slot overlay left focus behind it, allowed Tab to reach the background, lacked dialog semantics and an accessible name for the icon close button, and did not close with Escape. Saved list/detail retries already passed with Enter and Space, exactly one request per attempt, repeated 503 errors, and eventual success.

The existing dialog now names its title and close control, focuses its first close button, contains forward and reverse Tab, closes with Escape, and returns focus to its connected trigger. Handlers are local to the dialog. Opening and returning focus use an immediate centered scroll. A native-frame trace showed the previously pending Tab scroll moving the desktop close button from top 511.56px to -22.44px; nearest alignment did not reliably finish that pending scroll in the tested Chromium build. The error-state summary bar also now sits above the fallback status layer so its information button remains visible and reachable. Its normal 3D layer remains unchanged.

## Verification

| Check | Result |
| --- | --- |
| Before: built Worker, native keyboard, two widths | 8 pass / 2 fail |
| After: built Worker, native keyboard, two widths | 10 pass / 0 fail |
| Existing scene clock/visibility/pause/tracking/resize/unmount/Strict Mode regression | 17 pass / 0 fail |
| Fresh nonincremental TypeScript check | Exit 0 |
| Production build from this worktree | Exit 0 |
| Scoped ESLint | 0 errors; the same 4 baseline warnings |
| `git diff --check` | Exit 0 |

The final browser suite additionally checks visible, unobscured focus after both Tab wraps and Escape, both close buttons with Enter/Space, normal Tab progression after closing, and the healthy dialog after trusted native WebGL context restoration. It uses a synthetic identity and ephemeral local D1. Expected console faults are four unsupported-WebGL messages and eight intentional HTTP 503 messages; unexpected page errors and outbound requests are both zero.

[validation-summary.json](validation-summary.json) links the results to the final application and QA script hashes. [Before](before/results.json), [after](after/results.json), [scene regression](scene-clock-results.json), original/updated lint reports, and compressed command logs retain the actual outcomes. Diagnostic JSON and screenshots retain the pending native scroll and fallback-layer coverage observations. Final screenshots include the open dialog, restored trigger at both widths, and the restored healthy 3D dialog; the 1440px dialog, 390px returned trigger, and healthy dialog were inspected visually.

[preservation.json](preservation.json) compares all 513 preexisting tracked files: 512 remain byte identical; only `GalaxyCanvas.tsx` changes. Removing the explicitly allowed dialog attributes, keyboard handling, focus effect, and error-state summary-layer expression reproduces the original canvas source exactly. The runtime approved B body and its original GLB both retain SHA-256 `0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84`. The preserved WIP's QA script retains SHA-256 `75ea6f5726ce41272841494c3a3316e3f4b88ea7c4888d71e21e981ee9030539`.

## Reproduction

Use the repository's installed dependencies and a local Playwright installation. The recorded run used Chromium 151 with SwiftShader. `SAJU_QA_PLAYWRIGHT_PATH` points to Playwright's `index.mjs`; `SAJU_QA_JSDOM_PATH` points to jsdom's `lib/api.js`.

```sh
npm run build
node scripts/qa/error-keyboard-browser.mjs
node scripts/qa/galaxy-background-clock.mjs
node_modules/.bin/tsc --noEmit --incremental false
node_modules/.bin/eslint components/planet/GalaxyCanvas.tsx scripts/qa/error-keyboard-browser.mjs
git diff --check
```

The baseline report uses the preserved original WIP test. The final script keeps those ten scenarios and strengthens focus visibility and healthy-restoration coverage. Measurements use native keyboard events, requestAnimationFrame and scroll; the tests do not force focus or clicks. Unsupported WebGL and HTTP failures are explicit browser-boundary faults.

Physical GPUs, mobile operating systems, hosted authentication, screen-reader speech, Safari and Firefox were not tested. These local checks do not certify those environments. `SHA256SUMS` covers the evidence files. GitHub push/readback evidence is saved separately after the immutable commit exists.
