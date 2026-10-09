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

- Previously reported mobile-home candidate `c5d13cf` and spirit/material candidate `a97c418` directories are absent in this current workspace. Their previously inaccessible Library copies were not retried. They are NOT represented by this archive.
- Other historical files not present in the accessible local authoring workspace cannot be claimed preserved here.
- Existing redundant model delivery ZIPs were replaced by exact source/file preservation with hashes. Render-frame intermediates and Python caches are excluded; original preview videos and comparison images are retained.
- Temporary QA output copies, upload receipts, transfer utilities, internal planning notes and hosting metadata are omitted. Original standalone user-deliverable ZIPs are retained alongside their separate source/QA records for reproducibility.
- Source modules in the tracked `build/` directory are required authoring code and retained; compiled deployment outputs are not included.

See `preservation-asset-inventory.json`, `source-file-inventory.json`, `consolidated-manifest.json`, `source-archive-manifest.json`, and `excluded-files.json`.
