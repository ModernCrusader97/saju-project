> **All selected source bytes are preserved; one original asset requires restoration after checkout.**
> `public/models/porcelain-hero-blink-v1.glb` is preserved losslessly as `preservation-archives/porcelain-hero-blink-v1.glb.gz` because the connector could not upload the original 13,700,928-byte binary directly and browser upload stalled. The runtime path is absent until you run `python3 scripts/restore-preserved-assets.py` from the repository. The script verifies both archive and original SHA-256 values and refuses to overwrite different content. This is not a ready-to-run checkout claim. Standalone B art has not been integrated into the runtime, and no new Site publication occurred.

# SaJu source preservation snapshot

This private repository preserves the full Sites-adapted SaJu application source from saved Site version 23, commit `843a4a088a9e20760421b4c81f890d026a53ae6b`, plus separately versioned B character art source/reference packages.

## Application
The application files retain the original snapshot content, including its README, package lock, pages/API routes, Saju and planet logic, existing public models, and database schema/migrations. Generated TypeScript build state is excluded. The existing `.openai/hosting.json` is preserved as source provenance; this import does not publish or update a Site.

## Standalone art
- `assets/source-reference/saju-b-jade-reconstruction-baseline-20261006`: candidate-5-based reconstruction baseline and sources.
- `assets/source-reference/saju-b-clear-green050-20261006`: previous completed color/material checkpoint.
- `assets/source-reference/saju-b-green-emission-separated-v001`: latest completed green-emission separation, native Blender source, GLB, textures, material contract, diagnostic evidence and scripts.

These art assets are preserved separately and are not wired into the application's runtime. No browser/mobile/site appearance claim is made. This reconstruction is not the missing October 4 selected-5 final master. Refer to each package's README and validation files for its actual scope.

## Exclusions and validation
No original Git history, credentials, environment secret values, live database records, dependencies, build caches, unrelated projects or private assistant notes are included. The source manifest records payload sizes and SHA-256 values. Binary Git blob identities are also checked during upload.

This is source preservation only. Application build, integration tests and a new Site deployment were not performed for this import. Running elsewhere still needs the appropriate trusted ChatGPT authentication infrastructure, D1 binding and optional owner-configured runtime secret. The original pre-Sites application is not independently verified by this snapshot.
