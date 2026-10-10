# Collection close button accessible name

The collection modal is used by app/guin/[id]/page.tsx:660. Its icon-only X button had an empty name in native Chromium's accessibility tree, so assistive navigation could not identify its close action. A single aria-label="도감 닫기" line supplies the descriptive name. The component's displayed labels, styles, collection data and close/event handlers remain byte-preserved outside that line.

Basis: f13750ac8776bd360b9b1e9ad6d66de4e8a2e0a2. New private branch: fix/pokedex-close-accessible-name-20261010-joseph. The clean task-owned checkout and its complete installed dependencies are reused sequentially; prior branch refs, all 52 existing remote heads, old WIP bytes and art checkouts are protected separately in the postcommit receipt. No duplicate relevant task/process was running.

The identical native Chrome suite reproduced two empty-name failures at 390 and 1440px, with four existing interaction cases passing. After the one-line fix all six pass. Native Enter/Space close once; backdrop closes once; inside click preserves the modal then Escape closes once; the closed Escape listener no longer fires. The real React component, actual Tailwind styles, Chromium AX tree and keyboard/pointer input are used with synthetic 0/1/10-person collections, no API or DB. The two actual screenshots retain byte-identical PNG files and pixels, displayed text, button geometry/computed colors and CSS.

Fresh current-branch production build and postbuild nonincremental types pass. Relevant lint has zero errors, the same existing product warning (1) and zero QA warnings. No lint rules or suppressions changed. An initial lint-report helper failed because Windows file paths were compared literally to slash paths, before build/types were reached. The original helper and exact error record are retained; normalized path matching completed the comparison. Raw process logs use -text -diff within this evidence folder, retaining their exact emitted bytes and whitespace. Source, QA and documentation still receive the ordinary staged whitespace check.

Ten prior completed QA records, including f13750ac Passport image-error recovery, and the previous keyboard/detail records were read/reused; their suites were not repeated. All completed art/UV/model work is untouched. No main merge, PR, deploy, default model replacement, auth/billing/permission or DB-data edit.

Run with installed dependencies, Playwright and Chrome, using new output/profile folders:

~~~powershell
$env:SAJU_QA_PHASE='after'
$env:SAJU_QA_OUTPUT='NEW_ABSOLUTE_REPORT_DIRECTORY'
$env:SAJU_QA_SCRATCH='NEW_ABSOLUTE_SCRATCH_DIRECTORY'
$env:SAJU_QA_PLAYWRIGHT_PATH='ABSOLUTE_playwright_index.mjs'
$env:SAJU_QA_CHROME='ABSOLUTE_chrome.exe'
node scripts/qa/pokedex-close-name-browser.mjs
~~~

This verifies the actual component with synthetic data, not a hosted/built full-app route, real account/DB, physical mobile device, live screen-reader session or model render. Before/after screenshots were opened directly. Git product source is canonical LF; browser-source hashes record the native CRLF working file.
