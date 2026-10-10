# Home birth-form validation state

Basis: `6c2c4285e167d4feb9f966e0208ab1b81e9cd04c`, verified from the completed private input-catch maintenance branch. Independent branch: `fix/home-input-validation-state-20261010`. [remote-basis.txt](remote-basis.txt) records the 40 preexisting remote branches.

A failed birth-form submission stores a validation error until another submission. Changing 2000-02-30 to the valid leap day 2000-02-29 leaves the old nonexistent-date error visible. Correcting an empty hour, or choosing unknown time so that hour is disabled and omitted from validation, likewise leaves the obsolete hour error. The actual input parser accepts these corrected drafts while native Chromium still displays the previous error. Existing mobile-home checks covered initial rejection and successful submission, but not these edits after an error.

One product line adds a change handler to the existing Home birth form. An input change retires the prior submission's error. The next manual submission still validates the current draft and reports an error when needed. Focus alone retains the message, and changes in the separate reading modal retain the birth-form error.

## Verification

| Check | Before | After |
| --- | --- | --- |
| Focused native Chromium + actual CPU parser | 4 pass / 4 fail | 8 pass / 0 fail |
| Invalid edited draft rejected again on resubmission | Blocked by stale-state assertion | Pass |
| Corrected draft's explicit destination query | Pass | Pass |
| Page errors, API requests and outbound calls | Zero | Zero |
| Nonincremental TypeScript check | — | Exit 0 |
| Own production build | — | Exit 0 |
| Scoped ESLint | 0 errors / 3 warnings | Same diagnoses, exit 0; new QA has none |
| `git diff --check` | — | Exit 0 |

The same new QA script runs against the original `6c2c428` source/build and the corrected worktree's fresh build. At 390 × 844 it uses native pointer/input events to verify corrected leap-day, corrected known hour, unknown-time transition, focus-only retention, incomplete-draft revalidation, explicit corrected submission and separate-form scope. Corrected DOM values pass the actual repository CPU parser. The existing destination query remains `{name, y, m, d, h, unknown}` with the corrected input and trimmed name. Only the destination document response is a local fixture, so the planet renderer does not execute.

[validation-summary.json](validation-summary.json), before/after reports, full-form screenshots and compressed logs retain source hashes and evidence. All four final screenshots were inspected: the corrected date and unknown-time inputs are visible alongside the stale error before and its removal after. The focused checks were repeated to replace initially incomplete viewport captures with full-form evidence; product code was unchanged during that repeat. Previously completed calendar, cancellation, catch and feature suites were not rerun.

[lint-comparison.json](lint-comparison.json) confirms unchanged scoped diagnostics: the existing location-assignment warning and two image-element warnings. No rule or warning is suppressed, and no warning-only cleanup is added.

[preservation.json](preservation.json) compares all 632 preexisting tracked files: 631 are byte identical and only `app/page.tsx` changes. Removing its one new form attribute exactly reproduces the original page, preserving validation, manual submission, query construction, all labels and styles. Completed input-modal work and all model assets are among the unchanged files. The original uncommitted keyboard-QA script retains its recorded hash.

## Reproduction

Use installed repository dependencies plus a local Playwright installation. Set `SAJU_QA_PLAYWRIGHT_PATH` to Playwright's `index.mjs`; the script uses `/usr/bin/chromium`.

```sh
npm run build
node scripts/qa/home-validation-state.mjs
node_modules/.bin/tsc --noEmit --incremental false
node_modules/.bin/eslint app/page.tsx scripts/qa/home-validation-state.mjs
git diff --check
```

The identity and local D1 are synthetic and ephemeral. No API write, real user DB or external AI call executes. Hosted authentication, other browsers, physical devices and planet rendering are not tested. `SHA256SUMS` covers the evidence. Immutable commit and normal private push/all-file readback proof are saved separately after the commit exists. Main, PRs, deployment, authentication, payment, permissions, models, design, new features and original-source searches are outside this change.
