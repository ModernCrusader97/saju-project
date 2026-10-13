"""Run the existing guarded verifiers against the current five-item art bundle.

This driver changes no asset or verification threshold. Each output is new.
"""
import hashlib
import json
import subprocess
import time
from pathlib import Path

AUDIT = Path(__file__).resolve().parent
REPO = Path('/workspace/saju-cloud-reconstruction-20261013')
ART = REPO / 'assets/source-reference'
V26 = ART / 'saju-dragon-cloud-v26-reconstruction-20261013/source'
LOSSLESS = ART / 'saju-dragon-cloud-lossless-buffer-reuse-20261013/source'
V25 = ART / 'saju-dragon-volume-review-v22-face-v25-20261012/latest-static-face-v25/source'
OUT = AUDIT / 'batch-regression'
assert not OUT.exists(), 'Use a new batch output directory'
OUT.mkdir()
BEFORE = AUDIT / 'relocated/inputs/before.blend'
AFTER = AUDIT / 'relocated/inputs/after.blend'
ORIGINAL = AUDIT / 'relocated/inputs/original.glb'
CANDIDATE = AUDIT / 'relocated/lossless-regenerated.glb'
NATIVE = Path('/workspace/saju-cloud-restoration-check-20261013/delivery/SaJu_Dragon_Cloud_V26_Reconstructed_RoundEyes_Final_Idle.blend')
GENERATION = LOSSLESS.parent / 'evidence/input-original-generation-report.json'
BLENDER = ['blender', '--background', '--factory-startup', '--python-exit-code', '1', '--threads', '4', '--python']
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
inputs = {str(p): sha(p) for p in (BEFORE, AFTER, ORIGINAL, CANDIDATE, NATIVE)}
commands = [
    ('exact-glb-storage', ['python3', str(LOSSLESS / 'verify_exact_glb_storage.py'), '--original', str(ORIGINAL), '--candidate', str(CANDIDATE), '--out', str(OUT / 'exact-glb-storage.json')]),
    ('three-runtime', ['node', str(LOSSLESS / 'pinned_original_runtime_verifier.mjs'), '--glb', str(CANDIDATE), '--out', str(OUT / 'three-runtime.json'), '--three-root', '/workspace/saju-project/node_modules/three', '--generation-report', str(GENERATION)]),
    ('khronos', ['node', str(LOSSLESS / 'pinned_original_khronos_verifier.mjs'), '--glb', str(CANDIDATE), '--out', str(OUT / 'khronos.json'), '--validator', '/workspace/saju-cloud-validation-tools/node_modules/gltf-validator']),
    ('static-geometry', BLENDER + [str(V25 / 'verify_v8_static.py'), '--', '--blend', str(AFTER), '--out', str(OUT / 'static-geometry.json')]),
    ('eye-only-no-shrink', BLENDER + [str(V26 / 'verify_eye_only_change_v2.py'), '--', '--before', str(BEFORE), '--after', str(AFTER), '--out', str(OUT / 'eye-only-no-shrink.json')]),
    ('strict-lid-contact', BLENDER + [str(V26 / 'verify_upper_lid_contact.py'), '--', '--blend', str(AFTER), '--out', str(OUT / 'strict-lid-contact.json')]),
    ('actual-motion-contact', BLENDER + [str(V26 / 'verify_face_and_mane_contact_in_motion.py'), '--', '--blend', str(NATIVE), '--out', str(OUT / 'actual-motion-contact.json')]),
    ('native-current-glb-roundtrip', BLENDER + [str(V26 / 'verify_native_cloud_final.py'), '--', '--blend', str(NATIVE), '--glb', str(CANDIDATE), '--out', str(OUT / 'native-current-glb-roundtrip'), '--source-static', str(V25 / 'build_dragon_v8_volume_v25.py'), '--source-bind', str(V26 / 'bind_cloud_reconstructed_round_eyes_idle.py')]),
]
rows = []
for name, command in commands:
    print('START', name, flush=True)
    start = time.monotonic()
    with (OUT / (name + '.log')).open('x') as log:
        result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
    rows.append({'name': name, 'command': command, 'exit_code': result.returncode, 'elapsed_seconds': round(time.monotonic() - start, 3), 'log': name + '.log'})
    print('FINISH', name, result.returncode, flush=True)
    if result.returncode:
        break
unchanged = all(sha(Path(p)) == h for p, h in inputs.items())
report = {'status': 'PASS_CUMULATIVE_FIVE_ITEM_ART_REGRESSION' if len(rows) == len(commands) and all(r['exit_code'] == 0 for r in rows) and unchanged else 'FAIL_CUMULATIVE_ART_REGRESSION', 'checks': rows, 'input_hashes': inputs, 'all_asset_inputs_unchanged': unchanged, 'heavy_158_file_restore_repeated': False, 'geometry_generation_repeated': False, 'verifier_thresholds_modified': False, 'tests_count_as_new_improvements': False}
(OUT / 'cumulative-regression-summary.json').write_text(json.dumps(report, indent=2) + '\n')
assert report['status'].startswith('PASS'), report['status']
print(report['status'], flush=True)
