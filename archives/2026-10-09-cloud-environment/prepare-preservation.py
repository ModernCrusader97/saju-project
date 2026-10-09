from pathlib import Path, PurePosixPath
from collections import Counter, defaultdict
import datetime
import gzip
import hashlib
import io
import json
import os
import re
import shutil
import stat
import struct
import subprocess
import zipfile

evidence = Path(__file__).resolve().parent
baseline = json.loads((evidence / 'baseline.json').read_text())
source = Path('/workspace/scratch/saju-restore-verify-20261009')
worktree = Path(baseline['preservation_worktree'])
destination = worktree / 'archives/2026-10-09-cloud-environment'
destination.mkdir(parents=True, exist_ok=True)
assert not any(destination.iterdir()), 'Do not overwrite an existing preservation payload'

def git(*args, cwd=source):
    return subprocess.run(['git', *args], cwd=cwd, capture_output=True, check=True).stdout

assert git('rev-parse', 'HEAD').decode().strip() == baseline['base_sha']
assert git('status', '--porcelain', '--untracked-files=all') == b''
assert git('rev-parse', 'HEAD', cwd=worktree).decode().strip() == baseline['base_sha']

remote_blobs = defaultdict(list)
base_paths = {}
for ref, commit in baseline['remote_refs'].items():
    for row in git('ls-tree', '-lr', '-z', commit).split(b'\0'):
        if not row: continue
        meta, filename = row.split(b'\t', 1)
        mode, kind, blob, size = meta.decode().split()
        if kind != 'blob': continue
        name = filename.decode()
        remote_blobs[blob].append({'ref': ref, 'commit': commit, 'path': name, 'size': int(size)})
        if commit == baseline['base_sha']: base_paths[name] = blob

secret_patterns = {
    'private_key': re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
    'aws_access_key': re.compile(rb'(?:AKIA|ASIA)[A-Z0-9]{16}'),
    'google_api_key': re.compile(rb'AIza[A-Za-z0-9_-]{35}'),
    'openai_key': re.compile(rb'sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}'),
    'github_token': re.compile(rb'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})'),
    'slack_token': re.compile(rb'xox[baprs]-[A-Za-z0-9-]{20,}'),
    'signed_download_url': re.compile(rb'[?&](?:X-Amz-Signature|sig|signature|access_token|auth_token)=[^&\s"<>]{12,}', re.I),
}
excluded = []
audits = []

def forbidden(name):
    path = PurePosixPath(name)
    return path.is_absolute() or '..' in path.parts or any(p in {'.git', '.aws', '.codex', '.agents', 'node_modules', '.wrangler', '.sites-runtime', 'npm-cache', 'xdg-config', '__pycache__'} for p in path.parts) or any(p.startswith('.env') for p in path.parts) or path.suffix.lower() in {'.db', '.sqlite', '.pem', '.key'} or path.name.endswith(('.sqlite-wal', '.sqlite-shm', '.tsbuildinfo'))

def scan_bytes(data):
    return [name for name, pattern in secret_patterns.items() if pattern.search(data)]

def glb_metadata(data):
    assert len(data) >= 12 and data[:4] == b'glTF', 'Invalid GLB header'
    version, length = struct.unpack_from('<II', data, 4)
    assert version == 2 and length == len(data), 'GLB version/length mismatch'
    offset = 12
    metadata = None
    while offset < len(data):
        size, kind = struct.unpack_from('<II', data, offset)
        assert offset + 8 + size <= len(data), 'GLB chunk outside file'
        if kind == 0x4E4F534A: metadata = json.loads(data[offset + 8:offset + 8 + size].decode().rstrip(' \t\r\n\0'))
        offset += 8 + size
    assert offset == len(data) and isinstance(metadata, dict)
    return {'version': version, 'bytes': length, 'mesh_count': len(metadata.get('meshes', [])), 'material_count': len(metadata.get('materials', [])), 'animation_count': len(metadata.get('animations', [])), 'validation': 'Header/chunks/JSON only; no native render or animation playback'}

def inspect_data(name, data, depth=0):
    findings = scan_bytes(data)
    result = {'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'sensitive_pattern_classes': findings}
    if name.lower().endswith('.zip'):
        assert depth < 4, 'Archive nesting limit'
        members = []
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            assert archive.testzip() is None, 'ZIP CRC failure'
            assert sum(member.file_size for member in archive.infolist()) < 256 * 1024 * 1024, 'Unexpected archive expansion'
            for member in archive.infolist():
                if member.is_dir(): continue
                if forbidden(member.filename) or stat.S_ISLNK(member.external_attr >> 16):
                    findings.append('forbidden_archive_member'); members.append({'path': member.filename, 'excluded': True}); continue
                audit = inspect_data(name + '!/' + member.filename, archive.read(member), depth + 1)
                members.append(audit)
                findings.extend(audit['sensitive_pattern_classes'])
        result['format'] = 'zip'; result['members'] = members; result['crc_verified'] = True
    elif name.lower().endswith('.gz') or (name.lower().endswith('.blend') and data[:2] == b'\x1f\x8b'):
        decoded = gzip.decompress(data)
        assert len(decoded) < 256 * 1024 * 1024
        findings.extend(scan_bytes(decoded))
        result['format'] = 'gzip'; result['uncompressed_bytes'] = len(decoded); result['uncompressed_sha256'] = hashlib.sha256(decoded).hexdigest()
        result['crc_verified'] = True
        if decoded[:4] == b'glTF': result['glb'] = glb_metadata(decoded)
        elif decoded[:7] == b'BLENDER': result['blend_header_verified'] = True
    elif name.lower().endswith('.glb'): result['format'] = 'glb'; result['glb'] = glb_metadata(data)
    elif name.lower().endswith('.blend'):
        result['format'] = 'blend'; result['blend_header_verified'] = data[:7] == b'BLENDER'; result['validation'] = 'Preserved bytes; not opened in Blender'
    elif name.lower().endswith('.bundle'):
        result['format'] = 'git_bundle'; result['validation'] = 'Known incremental a10d920 bundle; verification recorded separately'
    result['sensitive_pattern_classes'] = sorted(set(findings))
    return result

records = []
artifact_payload = {}
native_models = []

def category(path):
    if path.suffix.lower() == '.blend': return 'native_blender_file_as_present'
    if path.suffix.lower() in {'.glb', '.gltf', '.fbx', '.obj'}: return 'exported_model_as_present'
    if '/assets/source-reference/' in str(path): return 'preserved_source_package_file'
    if '/lib/planet/' in str(path) or '/components/planet/' in str(path): return 'material_effect_or_scene_source'
    if path.suffix.lower() in {'.gz', '.zip', '.bundle'}: return 'existing_preservation_archive'
    return 'source_or_document_as_present'

def collect(path, disposition, root=None):
    name = str(path.relative_to('/workspace'))
    if forbidden(name): excluded.append({'path': name, 'reason': 'credential/private data/tool state filename'}); return
    data = path.read_bytes()
    blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    sha = hashlib.sha256(data).hexdigest()
    audit = inspect_data(name, data)
    if audit['sensitive_pattern_classes']:
        excluded.append({'path': name, 'reason': 'sensitive pattern detector', 'pattern_classes': audit['sensitive_pattern_classes']}); return
    if path.suffix.lower() in {'.zip', '.gz', '.glb', '.blend', '.bundle'}: audits.append(audit)
    kind = category(path) if disposition == 'tracked_source' else 'verification_artifact_as_present'
    relative = str(path.relative_to(root)) if root else None
    record = {'source_path': str(path), 'workspace_relative_path': name, 'bytes': len(data), 'sha256': sha, 'git_blob_sha1': blob, 'provenance': kind, 'original_status': 'Exact existing bytes; authorship/earliest authoring provenance not independently established', 'remote_before_exact_locations': remote_blobs.get(blob, []), 'disposition': disposition, 'validation_limit': 'Byte/integrity preservation; no new native GPU/Blender visual validation'}
    if disposition == 'tracked_source':
        record['repository_relative_path'] = relative
        record['storage'] = {'kind': 'existing_git_history', 'exact_locations': remote_blobs.get(blob, [])}
        assert remote_blobs.get(blob), 'Tracked source differs from all pinned remote trees; preserve as draft instead of assuming synced'
    elif disposition == 'runtime_asset':
        record['provenance'] = 'checksum_restored_runtime_copy'
        record['original_status'] = 'Generated/restored runtime copy; exact bytes verified against source and remote'
        if remote_blobs.get(blob):
            record['storage'] = {'kind': 'existing_git_history', 'exact_locations': remote_blobs[blob]}
        else:
            target = destination / 'runtime-assets' / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)
            record['storage'] = {'kind': 'git_blob', 'path': str(target.relative_to(worktree))}
    else:
        member = name
        artifact_payload[member] = data
        record['provenance'] = 'verification_artifact_as_present'
        record['storage'] = {'kind': 'zip_member', 'path': str((destination / 'cloud-verification-artifacts.zip').relative_to(worktree)), 'member': member}
    records.append(record)
    if path.suffix.lower() in {'.glb', '.blend', '.gz'}: native_models.append(record)

for repo_root in (Path('/workspace/saju-project'), source, Path('/workspace/scratch/saju-preserve-a10d920-20261009/restore-probe')):
    for name in git('ls-files', '-z', cwd=repo_root).decode().split('\0'):
        if name: collect(repo_root / name, 'tracked_source', repo_root)

runtime_files = [*sorted((source / 'public/spirits/jade-v002').glob('*')), source / 'public/models/porcelain-hero-blink-v1.glb']
for path in runtime_files:
    if path.is_file(): collect(path, 'runtime_asset', source)

artifact_roots = sorted(p for p in Path('/workspace/scratch').glob('saju-*-evidence-20261009') if p != evidence)
artifact_roots.append(Path('/workspace/scratch/saju-preserve-a10d920-20261009'))
artifact_roots.extend(p / 'outputs' for p in sorted(Path('/workspace/scratch').glob('saju-*-run-20261009')) if (p / 'outputs').is_dir())
artifact_roots.append(source / 'outputs')
for folder in artifact_roots:
    for current, dirs, names in os.walk(folder, followlinks=False):
        dirs[:] = [d for d in dirs if d not in {'npm-cache', 'xdg-config', 'runtime', 'restore-probe', 'node_modules', '.git', '.wrangler', '.sites-runtime', '__pycache__'} and not Path(current, d).is_symlink()]
        for name in sorted(names):
            path = Path(current, name)
            if not path.is_symlink() and name != '.git': collect(path, 'artifact')

zip_path = destination / 'cloud-verification-artifacts.zip'
with zipfile.ZipFile(zip_path, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, data in sorted(artifact_payload.items()):
        member = zipfile.ZipInfo(name, date_time=(2026, 10, 9, 0, 0, 0)); member.compress_type = zipfile.ZIP_DEFLATED; member.external_attr = 0o100644 << 16
        archive.writestr(member, data)
zip_audit = inspect_data(str(zip_path.relative_to(worktree)), zip_path.read_bytes())
assert not zip_audit['sensitive_pattern_classes']

bundle = Path('/workspace/scratch/saju-preserve-a10d920-20261009/SaJu_Map_GET_Race_Reapplied_a10d920_20261009/a10d920.bundle')
verified = subprocess.run(['git', 'bundle', 'verify', str(bundle)], cwd=source, capture_output=True, text=True)
assert verified.returncode == 0
heads = git('bundle', 'list-heads', str(bundle)).decode().strip()
assert heads.startswith('a10d920e6e492ba16f75a16cbbbf53a63eb4f178 ')

manifest = {
    'schema_version': 1, 'created_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'base_sha': baseline['base_sha'], 'preservation_branch': baseline['preservation_branch'],
    'remote_refs_at_start': baseline['remote_refs'], 'active_uncommitted_source': [],
    'paused_investigation': baseline['paused_investigation'],
    'scope': 'Actual files in the selected cloud execution environment; local dot authoring candidates handled by a different worker/branch',
    'excluded_policy': ['Secrets and .env/private keys', 'Actual user databases', 'node_modules/build caches/host runtime registries', 'Unrelated personal files', 'Library 403 files not acquired; no retries or alternate transfer'],
    'missing_inputs': [
        {'name': 'SaJu_Mobile_Home_Validated_20261009_0708.zip', 'library_file_id': 'libfile_063ee0caabbc8191a4a106468826f1dc', 'status': 'Not present; previous supported download CONNECT 403; not retried', 'sha256': None},
        {'name': 'SaJu_Ten_Stem_Material_Commit_a97c418_20261009.zip', 'library_file_id': 'libfile_ea461fe7b4b08191a368a1023c392bfb', 'status': 'Not present; previous supported download CONNECT 403; not retried', 'supplied_sha256_unverified': '816ba284a1c7b4fa7c836c02dacd7be5a02843dabb695c4f02e3cb2e31da8702'},
        {'name': '2709bb7', 'status': 'Original commit absent/unavailable; no claim of complete recovery'},
    ],
    'records': records, 'excluded_records': excluded,
    'artifact_zip': {'path': str(zip_path.relative_to(worktree)), 'bytes': zip_path.stat().st_size, 'sha256': hashlib.sha256(zip_path.read_bytes()).hexdigest(), 'member_count': len(artifact_payload), 'crc_verified': True},
    'bundle_verification': {'path': str(bundle), 'exit_code': verified.returncode, 'heads': heads, 'limitation': 'Incremental bundle requires existing 40f0c9a baseline; existing recovery proof retained'},
    'limitations': ['Model bytes and structural checks; no new Blender/native GPU/mobile validation', 'Latest Library home/material candidates absent', 'No environment Publish, deployment, hosted auth, or fresh automatic cloud restore validation', 'Evidence may include expected red failures and documented harness errors; preserve without relabeling as passes'],
}
with (destination / 'inventory.json').open('x') as file: json.dump(manifest, file, ensure_ascii=False, indent=2); file.write('\n')
with (destination / 'archive-inspection.json').open('x') as file: json.dump({'individual_archives_and_models': audits, 'new_artifact_zip': zip_audit, 'secret_pattern_classes': list(secret_patterns), 'bundle_verification': manifest['bundle_verification']}, file, ensure_ascii=False, indent=2); file.write('\n')
with (destination / 'inventory.tsv').open('x') as file:
    file.write('source_path\tbytes\tsha256\tprovenance\tdisposition\tstorage\n')
    for row in records:
        storage = row['storage']; label = storage.get('path', 'existing remote history') + ('!/' + storage['member'] if 'member' in storage else '')
        file.write('\t'.join((row['source_path'], str(row['bytes']), row['sha256'], row['provenance'], row['disposition'], label)) + '\n')

summary = {'records': len(records), 'dispositions': dict(Counter(r['disposition'] for r in records)), 'unique_sha256': len({r['sha256'] for r in records}), 'native_model_records_including_duplicate_checkouts': len(native_models), 'excluded_records': excluded, 'artifact_zip': manifest['artifact_zip'], 'runtime_assets': [{'path': row['workspace_relative_path'], 'storage': row['storage']['kind'], 'new_payload_path': row['storage'].get('path'), 'bytes': row['bytes'], 'sha256': row['sha256'], 'remote_before_exact_blob': bool(row['remote_before_exact_locations'])} for row in records if row['disposition'] == 'runtime_asset'], 'payload_root': str(destination)}
with (evidence / 'preparation-summary.json').open('x') as file: json.dump(summary, file, ensure_ascii=False, indent=2); file.write('\n')
print(json.dumps(summary, ensure_ascii=False, indent=2))
