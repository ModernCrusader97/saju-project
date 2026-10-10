# Actual B surface vegetation

This change covers 甲 woody branches and 乙 short connected vines in the spirit
pipeline. Planet surfaces, the approved body positions/UVs, facial meshes and
pet assets are not changed by these modules.

The implementation worktree starts at `ee6e974` on
`feature/spirit-attached-effects-20261010`. These checks establish behavior of
the current source and original runtime GLB. They do not identify the missing
deployed v29 source or assert that this source is v29.

## Fixture and command

Run from the project root:

```sh
SAJU_QA_PHASE=optimized node scripts/qa/surface-vegetation.mjs
```

The script parses `public/spirits/jade-v002/body.glb` with the actual Three
GLTFLoader. Only image decoding uses disposable CPU texture placeholders; no
sphere or approximate character replaces the body. The fixture selects the
33,207-position mesh named
`B_candidate5_reconstructed_|_seamless_body_and_mittens`, retains the approved
model offset and depth scale `1.35`, and uses the shared accent router.

The immutable POSITION buffer SHA-256 is
`f7e39c85723b4220d0e69161e4405c3232d514b18be56e8a3854ec6fff48da8b`.
The UV buffer SHA-256 is
`f3300a24812551e09c6b6a4bc31795feb19c80dc22cf1708cda7a64890e9539c`.
The script checks both buffers again after the effects and morph tests.

Results are written to ignored `outputs/surface-vegetation/<phase>.json`.
`before.json` records the initial failure: original B face roots were not
excluded, and the connected-vine module did not exist. `collision.json`
records the additional original B centerline intersections found by an
independent double-sided Three Raycaster: one at low quality, three at high.

## Implementation

甲 derives its face exclusion from the original named eye, eyebrow, glint and
mouth meshes transformed into body-local coordinates. It retains the prior
proxy-head exclusion for that separate geometry. Roots, normal directions and
tangent frames resolve actual current triangles. The existing four tapered
trunk/fork geometries remain. Generation checks the curves' piecewise
centerlines as well as the outward root ray. A temporary tree of actual posed
triangle bounds accelerates those segment checks and is released after
generation.

The instance matrix compensates the effect parent's affine transform, so a
rotated, nonuniformly scaled parent does not bend a branch through the body.
The bark and branch-leaf vertex normal hook uses cofactor columns for that
instance transform; the default Three shortcut supports nonuniform scale but
does not support shear. Integrated WebGL validation must compile this hook.

乙 uses the shared welded-edge triangle walker. It crosses genuine shared
edges, keeps both anchors at a crossed edge, and stops at boundaries or
ambiguous connectivity. One fixed path on an existing moving morph surface is
preferred when morph support is enabled; the remaining candidates use surface
area weighting. Accessory and animation updates never resample the paths.
Leaves start at the same path's middle and tip, with their roots on the actual
rendered stem. The stem grows and fades, then its leaves grow continuously;
all animation is a function of absolute time.

Tube and joint offsets account for both incident normals at each corner and a
conservative bound on the parent transform. This includes the radial thickness,
not only the centerline. Segments, joints and leaves use three fixed instance
batches. Joint geometry is 6×4 at low quality and 6×5 at high quality.

Accessories hide only a covered branch root and all its leaves, or a covered
vine segment midpoint, joint, or leaf root. Zero scale preserves every seed and
instance index. Removing an accessory reconstructs the identical matrices.

## CPU coverage

The four quality/stem checks cover:

- Original B facial roots excluded; unchanged source POSITION and UV buffers.
- Real shared-edge connectivity and nonnegative normalized barycentric anchors.
- Independently measured leaf-root distance to a visible rendered tube below
  `1e-6`, including posed triangles and rotated/nonuniform parents.
- Entire tube cross-sections outside their incident posed triangle planes.
- Woody curved/fork centerlines outside the original body in the reference
  pose, a tilted nonuniform parent and the production wave weight `0.45`.
- Actual `Gentle_wave_pose=0.65` stress attachment following on a moving
  original right-arm triangle and its connected leaves, followed by exact
  matrix restoration at weight zero.
- Identical matrices when paused or seeking backward/resetting absolute time.
- Local box and sphere accessory masks, all branch leaves hidden with a
  covered root, and exact restoration after removing the mask.
- Every final owned geometry, material and instance batch disposed once;
  updates and repeated disposal after disposal do not resurrect the effects.
- Router-reported budgets below six geometry draws, 1,200 instances and 30,000
  additional triangles per stem.

The original B budgets measured through the router are:

| Stem | Quality | Paths/branches | Instances | Draws | Triangles |
| --- | --- | ---: | ---: | ---: | ---: |
| 甲 | low | 30 branches | 120 | 5 | 12,600 |
| 甲 | high | 44 branches | 176 | 5 | 24,816 |
| 乙 | low | 6 short paths | 318 | 3 | 9,144 |
| 乙 | high | 10 short paths | 706 | 3 | 26,008 |

## Limits

Vines are short connected crawls; this change does not cover the entire body
with a continuous vine. The explicit morph option resolves posed vertices, but
skinning, changing topology and collapsed triangles require another adapter.
Branch filtering occurs at creation and checks centerlines beyond the intended
root inset `0.006 × detailScale`. It is not a continuous collision simulation
for branch thickness or unrelated moving parts. Vine offsets clear their
incident faces; contact with unrelated body components also has no continuous
physical collision simulation. Arbitrary extreme parent deformation is not
claimed safe. CPU checks alone do not establish physical mobile GPU performance
or final lighting appearance; the integrated browser suite supplies WebGL,
shader compilation, body/mask rendering and shadow evidence.
