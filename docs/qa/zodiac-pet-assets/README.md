# Zodiac pet source audit and loading boundary

The current tiger and other eleven companions are temporary procedural geometry.
The v30 application called `createZodiacPet`, which constructs primitives and has
no authored-model request. The preserved authoring archive was also never an
application integration: its own report says preservation only.

## Recovered animal assets

**Zero authored zodiac animals were found.** The repository archive was read at
immutable commit `956fe6e2a7f3de3a0aabe3c59d9d5db3795c7123`, branch
`archive/saju-local-authoring-20261009`, directory
`archives/2026-10-09-local-authoring`. All 906 indexed file entries were checked
against their byte counts and SHA-256 hashes, and CRC checks passed for all 15
ZIPs. Nested original deliveries were inspected as well.

The 54 indexed GLBs contain B body, gesture, arm, five-element, ten-stem and
porcelain studies. Their JSON mesh/scene names were inspected to confirm their
identities. None is an animal model. A search of accessible workspace GLBs also
found only body/five-element copies. No animal texture, native authoring file or
approval manifest was recovered. Original source files and archive versions were
left intact; no unrelated body model was reused as an animal.

[`source-inventory.json`](source-inventory.json) records every archived GLB's
source path, ZIP, bytes, SHA-256 and identifying mesh/node names, plus hashes for
the archive's own reports and manifests. This is evidence of the accessible
archive contents, not a claim that inaccessible animal files were preserved.

Two missing selected versions have known hashes from the archive's
`PRESERVATION_REPORT.md`:

| Branch | Animal | Missing version | Expected SHA-256 |
| --- | --- | --- | --- |
| 진 | Dragon | Latest selected Dragon C | `2745a970701c86a3bc74eb0008b597607022a5c7ee576d79b287970ac977d366` |
| 해 | Pig | Latest pig limb candidate | `d1c6f8625b5fb97cdbde102455cdbf181f335942b7cb0f87aeb07a7fc0fba290` |

The other ten animals have no accessible version/approval evidence. The public
[`manifest.json`](../../../public/models/zodiac-pets/manifest.json) records all
twelve as `missing-source`, with no guessed model URL or source SHA. Dragon/pig
latest approval status is `missing`; the others are `unverified`. Their fallback
remains `procedural-placeholder`.

## Application contract

`loadZodiacPet(branch, quality = 'high', { signal } = {})` returns
`Promise<ZodiacPet>`. An instance exposes `group`, `update(time)` and idempotent
`dispose()`. The caller retains the existing day-branch selection and places the
group at `(1.10, 0, .12)`. A parent should call `pet.dispose()` before disposing
the remaining avatar hierarchy: the pet detaches and clears its owned group.

All current manifest entries resolve the existing primitive fallback, with
explicit missing-source provenance in `group.userData`. This change does not
restore the missing crafted animals or claim their appearance is approved.

The loading boundary can handle a subsequently recovered, explicitly versioned
manifest entry: fetch its GLB, verify SHA-256, freshly parse it with Three's
`GLTFLoader`, retain original geometry/materials/pose, and uniformly scale an
outer presentation group to fit width `.62`, height `.66` and depth `.85`. The
source node transforms and vertex data remain unchanged. Feet meet the floor,
and the presentation is centered on the pet origin. No procedural animation is
applied to an authored mesh. There is no shared model/resource cache.

Failed/integrity-mismatched loads return an explicitly labelled fallback with
`authoredAssetStatus: 'load-error'`. Cancellation rejects with `AbortError`;
GLTF parsing cannot be interrupted, so a cancelled parse disposes its late
result before exposing it. Disposal deduplicates geometries, materials and
textures, including textures reused across multiple material slots.

## Verification

Run `node --test scripts/qa/zodiac-pet-loader.mjs` from the project root. Tests
cover all twelve mappings in both quality modes, current missing-source data,
shared-texture disposal, independent instance ownership, hash mismatch,
pre-cancelled loading and cancellation during GLTF parsing.

The GLB loader fixture is deliberately synthetic and stays in the test script.
Three actually decodes its mesh data, source transforms and material properties;
only image decoding uses owned CPU texture placeholders. These tests do not
assert rendering or visual fidelity of any inaccessible authored animal. No
authored zodiac GLB is published in this change.
