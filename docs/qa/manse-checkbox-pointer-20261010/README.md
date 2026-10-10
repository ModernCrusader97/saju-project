# Manse checkbox pointer overlap

Basis: `ea018e2228df521ca560e203fe6955c1a2158c27`, freshly verified on the private `fix/manse-form-labels-20261010` branch. Independent branch: `fix/manse-checkbox-pointer-20261010`. [remote-basis.txt](remote-basis.txt) records all 42 existing private branches. Startup checks found no active duplicate browser/build jobs; the original keyboard-QA WIP was retained. No repository AGENTS.md or `.agents/skills` instructions were present.

The actual built Manse page reproduces a product hitbox defect at 390 × 844. The hour group shrinks to 147.625px while its children paint outside it. The entire 13 × 13px checkbox overlaps the hour input (169px²). After the first click disables the hour input, `elementFromPoint` at the freshly measured checkbox center returns that disabled hour input. The second trusted native pointer event targets `manse-hour` and the checkbox remains checked. Coordinates are recomputed after scrolling, screenshots and each state change; they are inside the current checkbox and viewport. This rules out a stale QA-coordinate explanation. The same failure occurs at 320px and 360px. Caption clicks and keyboard toggling already work.

The hour row now allows wrapping (`flex-wrap`), and the hour group retains its contents' minimum width (`min-w-max`). At narrow widths the checkbox moves to the following line and both center clicks reach it. Wider layouts retain the existing flex growth and right alignment. The product change adds only these two classes in `app/manse/page.tsx`. Native labels, inputs, focus order, values, handlers and calculation code remain intact.

## Verification

| Check | Before | After |
| --- | --- | --- |
| Focused pointer suite | 5 pass / 3 fail, exit 1 | 8 pass / 0 fail, exit 0 |
| Center toggles at 320 / 360 / 390px | Cannot uncheck; hour receives second pointer | Both directions pass; zero overlap |
| Center toggles at 430 / 1100px | Pass | Pass |
| Caption clicks, Tab / Shift+Tab / Space, disabled-hour skipping | Pass | Pass |
| Existing label/default/calculation suite | Completed basis suite: 5/5 | Related regression rerun: 5/5 |
| Page errors, API requests, outbound calls | Zero | Zero |
| Nonincremental TypeScript check | — | Exit 0 |
| Own production build | Completed basis build reused for reproduction | Fresh candidate build, exit 0 |
| Scoped ESLint | 0 errors / 4 existing warnings | Same page warnings; new QA has none, exit 0 |
| `git diff --check` | — | Exit 0 |

The same new native Chromium script runs on the verified basis build and the candidate's own production build. It measures current rectangles, computed layout and hit targets, records trusted pointer events, checks both toggle directions at five widths, and exercises existing caption and keyboard behavior. [before-results.json](before-results.json), [after-results.json](after-results.json), compressed logs and [validation-summary.json](validation-summary.json) retain source hashes and observations. The reused baseline build belongs to the completed label task and its source hash matches that task's saved validation; its candidate-only symlink was removed before building the correction.

The actual [before 390px checked form](before-form-390-unknown.png) and [after form](after-form-390-unknown.png) were visually inspected. Both known-time and unknown-time 1100px form images are byte identical before and after. Narrow rows wrap without document overflow, and the hour input remains 80px wide. [labels-regression.json](labels-regression.json) confirms all five native label associations, caption-to-input focus, keyboard behavior, initial values/bounds and an explicit local calculation still work. No unrelated completed suites were repeated.

[preservation.json](preservation.json) compares all 673 preexisting tracked files: 672 are byte identical and only the Manse page changes. Removing exactly the two added classes restores the original source bytes. This preserves previous label attributes, Home/modal/error fixes, styles, model assets and the original keyboard-QA WIP hash. [lint-comparison.json](lint-comparison.json) verifies the same four existing unused-icon warnings; no lint rule is suppressed. Build warnings about bundle size and static route classification remain outside this layout fix.

## Reproduction and limits

Use installed repository dependencies and a local Playwright installation. Set `SAJU_QA_PLAYWRIGHT_PATH` to Playwright's `index.mjs`; these scripts use `/usr/bin/chromium`.

```sh
npm run build
node scripts/qa/manse-checkbox-pointer.mjs
node scripts/qa/manse-form-labels.mjs
node_modules/.bin/tsc --noEmit --incremental false
node_modules/.bin/eslint app/manse/page.tsx scripts/qa/manse-checkbox-pointer.mjs
git diff --check
```

All browser events use native Chromium. No force click, style override, handler invocation or product pointer-event workaround is used. Identity and local D1 are synthetic and ephemeral; no API call, actual user DB or external AI runs. Physical devices, screen readers, other browsers, hosted authentication and calendar accuracy were not tested. `SHA256SUMS` covers this evidence. Immutable commit, normal private push and complete remote file readback proof are saved separately after the commit exists. Main, PRs, deployment, authentication, payment, permissions, design expansion, models and original-source searches are outside this task.
