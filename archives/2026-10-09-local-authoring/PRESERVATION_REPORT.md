# SaJu local authoring preservation — 2026-10-09

This isolated archive preserves 906 authoring/source/QA file entries across 15 ZIP files (441 asset entries and 465 application/candidate/QA entries). It is preservation, not integration, approval of candidates, or deployment. Unpack all ZIPs into one empty folder; original version-specific directories remain distinct.

## Versions and provenance

- Repository archive baseline: `2e2d82b05f87b39ff8057ae914e8dfa01100a974`; all pre-existing repository files are retained.
- Application snapshot: clean local `saju_planet_preview` checkout at `843a4a088a9e20760421b4c81f890d026a53ae6b`. Includes 149 tracked source/assets/configuration files; hosting metadata and a tracked TypeScript incremental cache are intentionally excluded.
- Assets: B gestures v1/v2/v3/v4, five elements v1 including corrected version, ten stems v1/v2, arm candidates v5, and the recovered elemental B form. Native Blender sources and backups, GLB exports, embedded materials, generators, animation previews, render comparisons and validation records remain separated by original directory.
- Independent candidates: orbital calendar, name boundary, passport export title fit, question-boundary investigation, contract audit, and combined standalone verification runner. These are separate historical candidates; no patch has been applied to the app by this archival task.

## Verification status

Archive CRC checks passed; every preserved entry has a SHA-256 inventory; uploaded ZIP Git blob SHA-1 values matched the locally computed Git blob hashes. The archive manifests provide ZIP SHA-256 hashes. Credential-pattern and sensitive-file-name scans found no matches in included payloads; nested original deliverable ZIPs were inspected recursively. No credentials, environment secrets, private user databases, dependencies, Git internals or unrelated project/personal materials are included.

Historical model/runtime/QA reports are preserved as evidence of their original runs, not claims that those checks were rerun here. No application build, browser/mobile QA, Blender re-render, integration test or deployment was performed for this preservation task. Models and candidates remain prototypes where their own reports say so.

## Known omissions and limits

This is a historical preservation set, NOT a complete backup of the latest selected models or latest application revision. The following five items are explicitly missing:

1. Latest selected Dragon C model (용 C): SHA-256 `2745a970701c86a3bc74eb0008b597607022a5c7ee576d79b287970ac977d366` has no match in the preserved file inventories, including the 54 GLBs.
2. Latest pig limb candidate (돼지 팔다리 후보): SHA-256 `d1c6f8625b5fb97cdbde102455cdbf181f335942b7cb0f87aeb07a7fc0fba290` has no match in the preserved file inventories, including the 54 GLBs.
3. Restored application revision `2709bb7`: not included and unavailable in the local checkout used for this archive. The preserved application snapshot is `843a4a0`.
4. Mobile-home candidate `c5d13cf`: its previously reported local directory is absent in the current workspace; its previously inaccessible Library copy was not retried.
5. Spirit/material candidate `a97c418`: its previously reported local directory is absent in the current workspace; its previously inaccessible Library copy was not retried.

Older B ten-stem v1/v2 Blender/GLB source versions ARE preserved. Their inclusion does not imply that the missing latest home/material candidates, Dragon C, pig candidate, or revision `2709bb7` were preserved.

- Other historical files not present in the accessible local authoring workspace cannot be claimed preserved here.
- Existing redundant model delivery ZIPs were replaced by exact source/file preservation with hashes. Render-frame intermediates and Python caches are excluded; original preview videos and comparison images are retained.
- Temporary QA output copies, upload receipts, transfer utilities, internal planning notes and hosting metadata are omitted. Original standalone user-deliverable ZIPs are retained alongside their separate source/QA records for reproducibility.
- Source modules in the tracked `build/` directory are required authoring code and retained; compiled deployment outputs are not included.

See `preservation-asset-inventory.json`, `source-file-inventory.json`, `consolidated-manifest.json`, `source-archive-manifest.json`, and `excluded-files.json`.
