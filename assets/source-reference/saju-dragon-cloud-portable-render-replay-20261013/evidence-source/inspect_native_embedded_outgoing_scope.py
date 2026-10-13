"""Read-only packed-data scope check before publishing the existing native asset."""
import ast
import hashlib
import json
import re
import sys
from pathlib import Path
import bpy

root = Path(__file__).resolve().parent
repo = Path('/workspace/saju-cloud-reconstruction-20261013')
asset = repo / 'assets/source-reference/saju-dragon-cloud-v26-reconstruction-20261013/model/SaJu_Dragon_Cloud_V26_Reconstructed_RoundEyes_Final_Idle.blend'
if not asset.is_file():
    matches = list((repo / 'assets/source-reference/saju-dragon-cloud-v26-reconstruction-20261013').rglob('*Final_Idle.blend'))
    assert len(matches) == 1
    asset = matches[0]
original = hashlib.sha256(asset.read_bytes()).hexdigest()
tree = ast.parse((root / 'scan_outgoing_artifact_files.py').read_text())
assignment = next(n for n in tree.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'rules' for t in n.targets))
rules = ast.literal_eval(assignment.value)
bpy.ops.wm.open_mainfile(filepath=str(asset), load_ui=False)
expected = {
    'REGENERATE_build_dragon_v8_static.py': '691202de75b0c3e11934a1fefa12dd1cf200e41edd88ffd9163b695b42308c4c',
    'REGENERATE_bind_idle_export_v8.py': 'b993cb156f937fd58ded34733a149c5431fa86a52a25d124cdcda27171852c89',
}
assert {t.name for t in bpy.data.texts} == set(expected), 'Unexpected native text block'
texts = []
findings = []
for text in bpy.data.texts:
    data = text.as_string().encode('utf8')
    digest = hashlib.sha256(data).hexdigest()
    assert digest == expected[text.name]
    for name, pattern in rules.items():
        hits = list(re.finditer(pattern, data))
        if hits:
            findings.append({'packed_text': text.name, 'rule': name, 'count': len(hits), 'matched_values_omitted': True})
    texts.append({'name': text.name, 'bytes': len(data), 'sha256': digest})
images = [{'name': image.name, 'bytes': len(image.packed_file.data), 'sha256': hashlib.sha256(image.packed_file.data).hexdigest()} for image in bpy.data.images if image.packed_file]
assert len(images) == 1 and images[0]['sha256'] == '6184555091c80769d6553ae40641dbb44eb6dcc859dd0b8591b7887cc1502e58'
assert not bpy.data.libraries
assert hashlib.sha256(asset.read_bytes()).hexdigest() == original
report = {'status': 'PASS_ALL_NATIVE_PACKED_TEXTS_BOUNDED_CREDENTIAL_AND_IMAGE_SCOPE' if not findings else 'REVIEW_REQUIRED_NATIVE_TEXT_CREDENTIAL_FINDING', 'native_sha256': original, 'native_modified': False, 'all_packed_texts': texts, 'all_packed_images': images, 'linked_blender_libraries': 0, 'findings_without_values': findings, 'limits': 'Existing high-confidence credential rules, not exhaustive discovery; approved reference pixels verified by expected hash'}
with (root / 'evidence/native-packed-outgoing-scope.json').open('x') as handle:
    json.dump(report, handle, indent=2)
    handle.write('\n')
print(json.dumps(report), flush=True)
assert not findings
