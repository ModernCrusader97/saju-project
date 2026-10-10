# Existing twelve-animal source and runtime audit

This preserves read-only findings made after the user clarified that the task
was connecting the twelve previously created animals, rather than making a new
tiger. The unused new-tiger candidate remains on its separate private branch;
it is not connected to this candidate or the owner-only Site.

The existing `createZodiacPet` source at
`dffb235fbe47c063b8535a21b4fdf3ea8235d6aa` creates all twelve day-branch animals.
Its v29/v30 source SHA-256 is
`d6e8384d03f1a3eec3ec0f916fb9212ac10c14aa32f41c0d8751892ea54b0daa`.
The current loader still returns these same existing models when a manifest
entry has no verified authored GLB. No anatomy or material redesign was made.
The original [twelve-model preview](../../spirit-depth-pets/twelve-pets.png) is
preserved unchanged, SHA-256
`526f9654f18f23f29318f77190b4e0dfdb8e62baf415b900b2216f3dc08d2af2`.
Its own caption calls these temporary forms, rather than finished animal models.

The [per-animal forensic table](saju-existing-zodiac-forensic-20261010.md) records
29 actual remote heads and 90 accessible historical commit objects. The
[CPU comparison](saju-existing-zodiac-cpu-parity.json) checks twelve animals in
high/low quality at four times: 192 source/loader comparisons passed, with zero
animal URL requests. Mesh attributes, indices, materials, hierarchy, placement,
idle and reset agree with the existing source. The exact read-only
[comparison runner](saju-existing-zodiac-parity.cjs) is retained; its absolute
workspace paths and temporary output path describe the original execution.

The independent [Sites audit](sites-report.md),
[12-row linkage](sites-runtime-linkage.json), and
[Native version provenance](sites-native-version-provenance.json) confirm v29
`aa41b1a3601c5254c28bc5a4c853cd5efa50c5cc` and v30
`a5535893645f35d4000ec773bff61caef19463cf`. Both have the same procedural pet
source and compiled pet chunk, with no authored-animal GLB URL. The local v30
tar hash differs from the Native archive hash; whole-archive byte identity is
not claimed.

Dragon `2745a970…` and Pig `d1c6f862…` refer to the 2026-10-09 preservation report.
That report supplies no actual missing file name, source version ID, approval
manifest or current storage URL. The current latest Dragon selection and the
relationship of that Pig limb candidate to the user's current latest Pig are
unverified. For the other ten animals, separate crafted-file/version references
were not established in this scope. Archive 906-file/54-GLB no-hits do not prove
that all originals are globally absent. Library 403 files were neither retried
nor bypassed, and another environment was not used to circumvent that boundary.

The preserved reports and manifest snapshot describe their original inspection
commits. Their old `latest`/`missing` labels are historical evidence, superseded
by the current runtime manifest's scoped `sourceStatus` and universal
`latestApprovedStatus: unverified`. Generated source is available; verified
authored runtime GLBs are not present in this candidate. Actual identified
original files plus their selected version and SHA are needed to connect those
separate crafted models through `loadZodiacPet` without guessing or substitution.

No source/model export, database/auth change, deployment, or latest-model visual
approval was performed by the read-only auditors. Their type/build/new-browser
checks were not run; root candidate validation is recorded separately. Artifact
byte counts and hashes are in [the manifest](sha256-manifest.json).

The root's first provenance-test rerun had 7/8 passes: a concurrent GLTF test
assumed parse-completion order matched returned Promise order. It now associates
resource records with their actual returned scene owners before checking
independent ownership and exactly-once disposal. The corrected test passed 8/8;
no production pet ownership behavior changed for this test correction.
