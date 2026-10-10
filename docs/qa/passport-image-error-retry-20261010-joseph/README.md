# Passport snapshot image error recovery

Basis: 61f1a3dbcc3e4d991198b64e0a624c208ccf8b58, the latest completed galaxy share-feedback branch. New branch: fix/passport-image-error-retry-20261010-joseph.

When a snapshot image fails to decode/load, the old PNG save handler waits forever because its Promise has only onload. Actual trusted Chromium Image error events reproduced a permanently busy save button with no existing error alert in three cases. The two ordinary PNG save cases passed.

The product diff replaces two lines with five in components/planet/CosmicPassportModal.tsx. It registers load/error handlers before assigning src and rejects on error, allowing the existing catch/finally to show the same alert and re-enable saving. Labels, styles, title fitting, copy feedback, dialog behavior, models, routes, auth, billing, permissions and DB code remain byte-preserved outside this image Promise block.

The identical focused native Chrome suite now passes 5/5: corrupt data URI, corrupt HTTP PNG at 1440px, valid-image retry in the same 390px dialog, cached valid image saved twice, and missing-snapshot fallback. These are actual React production-mode bundles with existing Tailwind CSS, native Image load/error events, actual Canvas and 1080x1920 PNG downloads. Image events are not manually dispatched or stubbed. Three ordinary exported PNGs retain byte-identical files and decoded pixels before/after; CSS is identical. The 390px error-state screenshots were opened and inspected directly.

A fresh npm run build and postbuild tsc --noEmit --incremental false passed. Scoped lint has zero errors, the same two existing product warnings (unused Compass and existing img), and zero new QA warnings. No rules or suppressions changed. Raw initial fixture/build/type/lint setup failures are retained under diagnostic: the fixture initially resolved an incompletely copied icon package; safe sparse checkout omitted two existing shader/runtime imports; the first outside-repo baseline lint file was ignored. Complete libraries and exact original tracked inputs corrected setup; programmatic lintText uses the real product filename for baseline comparison. Final gates are separate from those raw failures.

Nine completed fix QA records and the saved-detail transition record were read and reused. Their suites, all completed dragon/UV/reduction work and V5 candidates were not repeated. The product file is the only changed preexisting tracked file. The existing source/config/model inputs materialized for build are unchanged.

Run the focused regression with installed dependencies and Playwright plus Chrome:

~~~powershell
$env:SAJU_QA_PHASE='after'
$env:SAJU_QA_OUTPUT='NEW_ABSOLUTE_OUTPUT_DIRECTORY'
$env:SAJU_QA_SCRATCH='NEW_ABSOLUTE_SCRATCH_DIRECTORY'
$env:SAJU_QA_PLAYWRIGHT_PATH='ABSOLUTE_playwright_index.mjs'
$env:SAJU_QA_CHROME='ABSOLUTE_chrome.exe'
node scripts/qa/passport-image-error-browser.mjs
~~~

SAJU_QA_DEPENDENCY_ROOT optionally selects a complete read-only installed dependency tree. The harness serves only synthetic fixture resources on its own loopback port and records/rejects other requests. It uses its own headless profile and never invokes APIs or user DBs. This is a focused actual-component browser test; it does not claim built full-app browser navigation, hosted authentication or physical mobile-device coverage. Main, earlier branch heads, all old WIP and V4/V5/V6 model candidates are protected separately in the postcommit receipt. No PR, merge or deployment is created.

Raw process logs are committed with -text -diff within this evidence directory. Their original output whitespace and ANSI bytes remain exact; source, QA code and documentation still receive the normal staged whitespace check.
