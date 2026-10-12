"""Move identity, unanimated skinned mesh nodes to scene roots without altering data.

No mesh, material, skin, joint, animation, accessor, or binary payload is re-exported.
Conservative preconditions reject nonidentity/animated parents and complex graphs.
Run: python root_skin_export.py --input V3.glb --output NEW_V4.glb --report NEW.json
"""
import argparse
import copy
import hashlib
import json
import struct
from pathlib import Path

EXPECTED_V3_SHA256 = '56023b8a0299b1d203d892530f5004e2f4833cda56ed298d4be97bfbb63992c6'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def identity(node):
    return (node.get('translation', [0, 0, 0]) == [0, 0, 0]
            and node.get('rotation', [0, 0, 0, 1]) == [0, 0, 0, 1]
            and node.get('scale', [1, 1, 1]) == [1, 1, 1]
            and node.get('matrix', [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
            == [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--input', required=True)
    ap.add_argument('--output', required=True)
    ap.add_argument('--report', required=True)
    ap.add_argument('--expected-input-sha256', default=EXPECTED_V3_SHA256)
    args = ap.parse_args()
    src, dst, report_path = (Path(s).resolve() for s in (args.input, args.output, args.report))
    if dst.exists() or report_path.exists() or src == dst:
        raise ValueError('Output and report must be new paths; source cannot be overwritten.')
    raw = src.read_bytes()
    if digest(raw) != args.expected_input_sha256:
        raise ValueError('Input hash differs. Inspect the new export before explicitly accepting its hash.')
    magic, version, length = struct.unpack_from('<III', raw)
    assert (magic, version, length) == (0x46546C67, 2, len(raw))
    chunks, offset = [], 12
    while offset < len(raw):
        size, kind = struct.unpack_from('<II', raw, offset)
        assert size % 4 == 0 and offset + 8 + size <= len(raw)
        chunks.append((kind, raw[offset + 8:offset + 8 + size]))
        offset += 8 + size
    assert offset == len(raw) and len(chunks) == 2
    assert chunks[0][0] == 0x4E4F534A and chunks[1][0] == 0x004E4942
    original = json.loads(chunks[0][1])
    spec = copy.deepcopy(original)
    assert len(spec['scenes']) == 1 and spec.get('scene', 0) == 0
    scene = spec['scenes'][0]
    parents = {}
    for i, node in enumerate(spec['nodes']):
        for child in node.get('children', []):
            assert child not in parents, 'Multiple parents are unsupported'
            parents[child] = i
    animated = {channel['target']['node'] for anim in spec.get('animations', [])
                for channel in anim['channels'] if 'node' in channel['target']}
    moved = []
    for i, node in enumerate(spec['nodes']):
        if 'skin' not in node:
            continue
        assert 'mesh' in node and not node.get('children')
        assert identity(node) and i not in animated
        assert i not in spec['skins'][node['skin']]['joints']
        parent = parents.get(i)
        if parent is None:
            assert i in scene['nodes']
            continue
        # Deliberately narrow: only one static identity scene-root parent.
        assert parent in scene['nodes'] and parent not in parents
        assert identity(spec['nodes'][parent]) and parent not in animated
        assert all(parent not in skin['joints'] for skin in spec['skins'])
        spec['nodes'][parent]['children'].remove(i)
        scene['nodes'].append(i)
        moved.append({'node': i, 'name': node.get('name'), 'former_parent': parent})
    assert len(moved) == 10, 'This accepted source must have exactly ten non-root skin nodes'
    # Reconstruct baseline: the only semantic edits must be parent.children and scene.nodes.
    restored = copy.deepcopy(spec)
    restored['scenes'] = copy.deepcopy(original['scenes'])
    for entry in moved:
        parent = entry['former_parent']
        restored['nodes'][parent] = copy.deepcopy(original['nodes'][parent])
    assert restored == original, 'An unrelated JSON property changed'
    encoded = json.dumps(spec, ensure_ascii=False, separators=(',', ':')).encode('utf8')
    encoded += b' ' * ((-len(encoded)) % 4)
    payload = (struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
               + struct.pack('<II', len(chunks[1][1]), 0x004E4942) + chunks[1][1])
    result = struct.pack('<III', 0x46546C67, 2, 12 + len(payload)) + payload
    dst.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with dst.open('xb') as handle:
        handle.write(result)
    report = {
        'status': 'PASS_EXPORT_HIERARCHY_ONLY',
        'input_name': src.name, 'output_name': dst.name,
        'input_sha256': digest(raw), 'output_sha256': digest(result),
        'input_bytes': len(raw), 'output_bytes': len(result),
        'bin_chunk_bytes': len(chunks[1][1]), 'bin_chunk_sha256': digest(chunks[1][1]),
        'bin_chunk_byte_identical': True,
        'moved_skinned_mesh_nodes': moved,
        'former_parent_children': original['nodes'][moved[0]['former_parent']]['children'],
        'new_parent_children': spec['nodes'][moved[0]['former_parent']]['children'],
        'scene_roots_before': original['scenes'][0]['nodes'], 'scene_roots_after': scene['nodes'],
        'all_other_json_properties_equal': True,
        'native_blend_modified': False,
        'primary_spec': 'https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#joint-hierarchy',
        'warning_code': 'NODE_SKINNED_MESH_NON_ROOT',
        'reason': 'Mesh parent transforms are ignored for skinning. Identity, unanimated mesh nodes and their identity, unanimated former parent permit direct scene-root promotion; joint hierarchy remains unchanged.',
    }
    with report_path.open('x', encoding='utf8', newline='\n') as handle:
        json.dump(report, handle, indent=2)
        handle.write('\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
