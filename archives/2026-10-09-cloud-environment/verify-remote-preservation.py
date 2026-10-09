#!/usr/bin/env python3
"""Read only known source/artifact blobs from an independent remote fetch."""
import datetime
import gzip
import hashlib
import io
import json
import struct
import subprocess
import zipfile
from collections import Counter
from pathlib import Path

EVIDENCE = Path('/workspace/scratch/saju-cloud-preservation-evidence-20261009')
PROBE = EVIDENCE / 'remote-probe.git'
PAYLOAD = 'c481d7616eb7ca3f938e64a41e11e4551504a5cc'
DOT = '956fe6e2a7f3de3a0aabe3c59d9d5db3795c7123'
BASE = 'archives/2026-10-09-cloud-environment/'
ACTIVE_PREFIX = '/workspace/scratch/saju-restore-verify-20261009/'


def git(*args):
    return subprocess.check_output(['git', '-C', str(PROBE), *args])


def blob(commit, path):
    return git('show', commit + ':' + path)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def assert_record(data, record):
    assert len(data) == record['bytes'], record['workspace_relative_path']
    assert sha(data) == record['sha256'], record['workspace_relative_path']


def glb_header(data):
    magic, version, declared_size = struct.unpack('<4sII', data[:12])
    assert magic == b'glTF' and version == 2 and declared_size == len(data)
    return {'glb_version': version, 'declared_bytes_match': True}


def main():
    output = EVIDENCE / 'remote-binary-verification.json'
    if output.exists():
        raise SystemExit('Refusing to overwrite an existing verification result')
    assert git('rev-parse', 'refs/heads/verified-cloud').decode().strip() == PAYLOAD
    assert git('rev-parse', 'refs/heads/verified-dot').decode().strip() == DOT
    inventory = json.loads(blob(PAYLOAD, BASE + 'inventory.json'))
    sums = blob(PAYLOAD, BASE + 'SHA256SUMS').decode()
    payload_checks = []
    for line in sums.splitlines():
        digest, filename = line.split('  ', 1)
        data = blob(PAYLOAD, BASE + filename)
        assert sha(data) == digest, filename
        payload_checks.append({'path': BASE + filename, 'bytes': len(data),
                               'sha256': digest, 'matches': True})
    assert len(payload_checks) == 9

    active = [record for record in inventory['records']
              if record['source_path'].startswith(ACTIVE_PREFIX)]
    tracked = [record for record in active if record['disposition'] == 'tracked_source']
    source_checks = []
    raw_glb = None
    for record in tracked:
        path = record['repository_relative_path']
        data = blob(PAYLOAD, path)
        assert_record(data, record)
        check = {'path': path, 'bytes': len(data), 'sha256': sha(data), 'matches': True}
        if path.endswith('.glb'):
            check.update(glb_header(data))
        elif path.endswith('.blend'):
            assert data.startswith(b'BLENDER'), path
            check['blender_header'] = True
        elif path.endswith('.glb.gz'):
            decoded = gzip.decompress(data)
            check.update(glb_header(decoded))
            check['gzip_crc_verified'] = True
            check['decoded_sha256'] = sha(decoded)
            raw_glb = decoded
        source_checks.append(check)
    assert len(source_checks) == 361

    zip_spec = inventory['artifact_zip']
    zip_data = blob(PAYLOAD, zip_spec['path'])
    assert len(zip_data) == zip_spec['bytes'] and sha(zip_data) == zip_spec['sha256']
    artifact_records = [record for record in inventory['records']
                        if record['disposition'] == 'artifact']
    by_member = {record['storage']['member']: record for record in artifact_records}
    with zipfile.ZipFile(io.BytesIO(zip_data)) as archive:
        names = archive.namelist()
        assert len(names) == zip_spec['member_count'] == len(by_member) == 243
        assert set(names) == set(by_member)
        assert archive.testzip() is None
        for name in names:
            assert_record(archive.read(name), by_member[name])

    runtime_checks = []
    for record in active:
        if record['disposition'] != 'runtime_asset':
            continue
        storage = record['storage']
        if storage['kind'] == 'existing_git_history':
            location = next(location for location in storage['exact_locations']
                            if location['commit'] == inventory['base_sha'])
            data = blob(PAYLOAD, location['path'])
            assert_record(data, record)
            runtime_checks.append({'runtime_path': record['workspace_relative_path'],
                                   'source_path': location['path'], 'bytes': len(data),
                                   'sha256': sha(data), 'matches': True})

    compressed = inventory['compressed_remote_comparison']
    dot_zip = blob(DOT, compressed['archive_path'])
    assert len(dot_zip) == compressed['archive_bytes']
    assert sha(dot_zip) == compressed['archive_sha256']
    # Only the known porcelain member is opened, not home/material candidates.
    with zipfile.ZipFile(io.BytesIO(dot_zip)) as archive:
        porcelain = archive.read(compressed['member'])
    assert len(porcelain) == compressed['member_bytes']
    assert sha(porcelain) == compressed['member_sha256']
    glb_header(porcelain)
    assert raw_glb is not None and raw_glb == porcelain
    runtime_checks.append({'runtime_path': compressed['member'],
                           'source_commit': DOT, 'zip_path': compressed['archive_path'],
                           'bytes': len(porcelain), 'sha256': sha(porcelain),
                           'member_crc_verified': True, 'matches_root_gzip_bytes': True})
    models = [record for record in active
              if record['source_path'].endswith(('.blend', '.glb', '.glb.gz'))]
    type_counts = Counter('blend' if record['source_path'].endswith('.blend')
                          else 'glb_gzip' if record['source_path'].endswith('.glb.gz')
                          else 'glb' for record in models)
    result = {
        'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'method': 'Fresh independent shallow Git fetch into an empty bare repository; no shared object storage or credentials read/change',
        'payload_commit': PAYLOAD, 'latest_code_base': inventory['base_sha'],
        'dot_commit': DOT, 'all_checks_passed': True,
        'payload_checksums_verified': payload_checks,
        'active_tracked_paths_verified': len(source_checks),
        'active_source_checks': source_checks,
        'model_paths': len(models), 'model_type_counts': dict(type_counts),
        'model_unique_sha256': len({record['sha256'] for record in models}),
        'runtime_checks': runtime_checks,
        'evidence_zip': {'path': zip_spec['path'], 'bytes': len(zip_data),
                         'sha256': sha(zip_data), 'members': len(by_member),
                         'member_crc_and_sha256_verified': True},
        'compressed_porcelain_source': {'commit': DOT,
                                        'path': compressed['archive_path'],
                                        'bytes': len(dot_zip), 'sha256': sha(dot_zip),
                                        'only_known_model_member_opened': True},
        'limits': ['No GPU/Blender native visual validation',
                   'No Library downloads or candidate reconstruction',
                   'No claim that unavailable 2709bb7 or latest Library candidates were restored',
                   'Source/evidence byte verification; no product changes or repeated application test run']
    }
    with output.open('x') as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)
        handle.write('\n')
    print(json.dumps({key: result[key] for key in ['utc', 'payload_commit', 'dot_commit',
                                                  'all_checks_passed', 'active_tracked_paths_verified',
                                                  'model_paths', 'model_type_counts', 'model_unique_sha256',
                                                  'evidence_zip']}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
