"""Preserve every new audit file using SHA-addressed chunks and new ZIP parts."""
import datetime
import hashlib
import json
import zipfile
from pathlib import Path

out = Path(__file__).resolve().parent
audit = Path('/workspace/saju-cloud-repro-audit-20261013')
repo = Path('/workspace/saju-cloud-reconstruction-20261013')
art = repo / 'assets/source-reference/saju-dragon-cloud-portable-render-replay-20261013'
manifest_path = out / 'new-five-item-preservation-manifest.json'
assert not manifest_path.exists(), 'Create a new snapshot only'
files = [(p, 'audit/' + str(p.relative_to(audit))) for p in sorted(audit.rglob('*')) if p.is_file()]
files += [(p, 'repo/' + str(p.relative_to(repo))) for p in sorted(art.rglob('*')) if p.is_file()]
files.append((Path(__file__).resolve(), 'snapshot-tools/build_and_verify_new_snapshot.py'))
files.append((art / 'snapshot-tools/restore_cloud_snapshot.py', 'restore_cloud_snapshot.py'))
CHUNK = 4 * 1024 * 1024
PART = 56 * 1024 * 1024
unique, rows, parts = {}, [], []
archive = None
part_bytes = 0
part_number = 0

def close_part():
    global archive
    if archive is not None:
        filename = Path(archive.filename)
        archive.close()
        parts.append({'file': filename.name, 'bytes': filename.stat().st_size, 'sha256': hashlib.sha256(filename.read_bytes()).hexdigest()})
        archive = None

for source, relative in files:
    digest = hashlib.sha256()
    keys = []
    size = 0
    with source.open('rb') as handle:
        while chunk := handle.read(CHUNK):
            key = hashlib.sha256(chunk).hexdigest()
            keys.append(key)
            digest.update(chunk)
            size += len(chunk)
            if key in unique:
                continue
            if archive is None or part_bytes + len(chunk) > PART:
                close_part()
                part_number += 1
                part_bytes = 0
                filename = out / ('SaJu_Cloud_FiveItem_Replay_All_New_Private_Part%02d_20261013.zip' % part_number)
                archive = zipfile.ZipFile(filename, 'x', compression=zipfile.ZIP_STORED)
            entry = 'chunks/' + key + '.bin'
            archive.writestr(entry, chunk)
            unique[key] = {'part': Path(archive.filename).name, 'entry': entry, 'bytes': len(chunk)}
            part_bytes += len(chunk)
    rows.append({'restore_relative_path': relative, 'bytes': size, 'sha256': digest.hexdigest(), 'chunks': keys})
close_part()
archives = {part['file']: zipfile.ZipFile(out / part['file']) for part in parts}
for name, opened in archives.items():
    assert opened.testzip() is None, name
for row in rows:
    digest = hashlib.sha256()
    size = 0
    for key in row['chunks']:
        entry = unique[key]
        data = archives[entry['part']].read(entry['entry'])
        assert len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == key
        digest.update(data)
        size += len(data)
    assert size == row['bytes'] and digest.hexdigest() == row['sha256'], row['restore_relative_path']
for opened in archives.values():
    opened.close()
manifest = {
    'status': 'PASS_NEW_SNAPSHOT_ZIP_CRC_CHUNK_AND_EACH_FULL_FILE_SHA256',
    'created_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'source_files': rows,
    'source_total_bytes': sum(row['bytes'] for row in rows),
    'unique_raw_chunk_bytes': sum(entry['bytes'] for entry in unique.values()),
    'unique_chunks': unique,
    'parts': parts,
    'chunk_bytes': CHUNK,
    'verified_art_count': 5,
    'audit_tests_or_archive_creation_counted_as_improvements': False,
    'old_158_file_restore_repeated': False,
    'old_versions_overwritten_or_deleted': False,
    'remote_body_rehashed': False,
    'restore_command': 'python3 restore_cloud_snapshot.py --manifest new-five-item-preservation-manifest.json --out NEW_ABSOLUTE_DESTINATION',
    'source_binary_aliases': 'Relocated inputs and regenerated GLB are preserved again in this new snapshot. Their SHA values equal the already preserved source content.',
    'commit_push_status_at_snapshot': 'Pending preservation metadata readback and final exact-index credential check',
}
with manifest_path.open('x') as handle:
    json.dump(manifest, handle, indent=2)
    handle.write('\n')
print(json.dumps({'status': manifest['status'], 'files': len(rows), 'source_bytes': manifest['source_total_bytes'], 'unique_bytes': manifest['unique_raw_chunk_bytes'], 'parts': parts, 'manifest_sha256': hashlib.sha256(manifest_path.read_bytes()).hexdigest()}), flush=True)
