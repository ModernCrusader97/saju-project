# Saved archive: compact list and on-demand reading

Base: `a5a76df53d628191ecdbbee71626d8dc4480a481`, equivalent to the private Site v25 source tree. This improvement does not modify models, textures, shaders, the three universe views, authentication, sharing, payments, schema, or production data.

## Changes

- `/api/saju?view=summary` returns only the seven fields used by the archive list: ID, creation time, category, title, summary, name, and day master. D1 projects these fields before returning rows to the Worker. The existing owner/date index and prepared owner parameter remain in use.
- `/api/saju` keeps its original full-record response for compatibility. `/api/saju/:id` still provides the complete reading and chat data.
- `/saved` fetches the compact list once per visit. Opening a record requests only that reading; repeated viewing reuses an in-memory cache for the mounted page. Nothing new is persisted in browser storage.
- Selection is reflected in the URL, including direct links and Back/Forward. Canceled or superseded requests cannot replace a newer selection. Network failures have retry controls and do not appear as an empty archive.
- Search still checks name, title, summary, and day master. Category filters, ordering, and keyboard activation are retained.

## Measured local result

A disposable local D1 database with 120 synthetic, deliberately long readings produced:

- Previous full-list response: 2,029,054 bytes
- Compact list response: 38,382 bytes
- Transfer reduction: 98.11%
- Query plan: `SEARCH fortunes USING INDEX idx_fortunes_owner_created (owner_id=?)`
- No temporary sort in that plan

This measures response size, not production latency. D1 still reads each matching record to extract its summary; this is not pagination, a covering index, or a claim of reduced database rows scanned. The benefit is avoiding full-reading transfer and full JSON parsing in the Worker/browser during list browsing. Very large archives can still benefit from a separately designed pagination/search change.

## Verification

- TypeScript: `npx tsc --noEmit` passed.
- Changed-file ESLint and `git diff --check` passed.
- Normal checksum-prepared build: `npm run build` passed, with the existing large-chunk warning. The build copies four approved v002 runtime assets and restores the preserved GLB after checksum verification.
- Approved art verification: `node scripts/qa/verify-approved-assets.mjs` passed for all 46 manifest entries, exact native RGBA8 atlas matching, and the restored GLB.
- Existing local integration harness: `node scripts/integration-preview.mjs`, 23 checks passed. It uses synthetic identities, a disposable local D1 database, and intercepted external calls. No production records were accessed.
- New API/SQL harness: `node scripts/qa/saved-archive.mjs`, four groups passed. It checks exact projected values and order, omitted detail fields, compact size, existing index use, anonymous/cross-owner rejection, and compatibility of full-list/detail APIs. The baseline failed the compact-response assertion before the implementation.
- New lifecycle harness: `node scripts/qa/saved-archive-dom.mjs`, six groups passed. It mounts the actual page and response reader in JSDOM with mocked API/router boundaries. Coverage includes list-once/detail-on-demand, cache reuse, URL selection, Back/Forward, cancellation, late responses, direct links, errors and retries, all four search fields, categories, case folding, no matches, Space activation, mismatched detail IDs, and unmount cleanup.
- Independent review found a stale-error state on Back to a previously failed reading. The regression reproduced it, then passed after the correction. The old page also fails the new list-request assertion.

For the DOM harness, install its isolated test tool without changing application dependencies: `npm install --prefix .sites-runtime/test-tools --no-save --ignore-scripts jsdom@30.1.2`. An existing installation can be selected with `SAJU_QA_JSDOM_PATH`.

## Verification limits and deployment

- JSDOM checks do not establish actual browser navigation, layout, mobile appearance, or GPU behavior. Chromium could not start in this cloud executor because Unix socket creation is unavailable, including after an allowed escalation. No browser screenshot was produced.
- The initial text-only recovery was superseded by the supported Sites source-opening workflow after explicit user approval of a short-lived site-source write credential. The complete v25 source tree (`e8b36f1d70fbb8543984b35bc3c48af30ca7910c`) matches the private GitHub base exactly. All original art assets are now present and checksum-verified; no art files were edited.
- At the time this report was written, this patch was prepared for authorized private publication; the deployment receipt is reported separately. Private v25 remains preserved as the rollback. The user explicitly approved the short-lived site-source write credential; it was used only through the supported source workflow. No hosted-login bypass credential, sharing expansion, or production migration was performed.
