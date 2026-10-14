"""Create same-origin web copies from SHA-verified approved originals only."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--records', required=True)
parser.add_argument('--input-root', required=True)
parser.add_argument('--allow-partial', action='store_true', help='Explicit WIP preparation only; never a complete asset acceptance')
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
records = json.loads(Path(args.records).read_text())
expected = records['expected_selected_originals']
assert len(expected) == 60 and len({row['key'] for row in expected}) == 60
assert len({row['sha256'] for row in expected}) == 60
version = 'v20261013-' + records['source_index_decoded_content_sha256'][:8] + '-webp960lossless-1'
inputs = {}
for path in Path(args.input_root).rglob('*.png'):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    inputs.setdefault(digest, []).append(path)
missing = [row['key'] for row in expected if row['sha256'] not in inputs]
if missing and not args.allow_partial:
    raise SystemExit('APPROVED_ORIGINALS_MISSING: ' + ', '.join(missing))
entries, proof = [], []
for row in expected:
    index = row['cycle_index']
    main = f'ganzi-{index:02d}-{row["sha256"][:12]}.webp'
    thumb = f'ganzi-{index:02d}-{row["sha256"][:12]}-thumb.webp'
    entry = {'key': row['key'], 'src': f'/mascots/{version}/{main}', 'thumbnailSrc': f'/mascots/{version}/{thumb}', 'ready': False, 'originalSha256': row['sha256'], 'width': 960, 'height': 960}
    if row['sha256'] in inputs:
        source = inputs[row['sha256']][0]
        raw = source.read_bytes()
        assert len(raw) == row['bytes']
        with Image.open(source) as image:
            image.load()
            original_size = image.size
            for size, name in [(960, main), (256, thumb)]:
                resized = image.convert('RGBA')
                resized.thumbnail((size, size), Image.Resampling.LANCZOS)
                canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
                canvas.paste(resized, ((size - resized.width)//2, (size - resized.height)//2))
                destination = root / 'public/mascots' / version / name
                destination.parent.mkdir(parents=True, exist_ok=True)
                import io
                buffer = io.BytesIO()
                canvas.save(buffer, format='WEBP', lossless=True, method=6)
                data = buffer.getvalue()
                if destination.exists():
                    assert destination.read_bytes() == data, 'Refuse to overwrite different existing web asset'
                else:
                    destination.open('xb').write(data)
                field = 'sha256' if size == 960 else 'thumbnailSha256'
                entry[field] = hashlib.sha256(data).hexdigest()
                entry['bytes' if size == 960 else 'thumbnailBytes'] = len(data)
        assert hashlib.sha256(source.read_bytes()).hexdigest() == row['sha256']
        entry['ready'] = True
        proof.append({'key': row['key'], 'source': str(source), 'original_sha256': row['sha256'], 'original_bytes': len(raw), 'original_size': original_size, 'web': entry, 'original_modified': False})
    entries.append(entry)
manifest = {'version': version, 'complete': not missing, 'verifiedOriginalCount': len(proof), 'missingOriginalKeys': missing, 'entries': entries}
target = root / 'lib/planet/ganzi-mascot-manifest.json'
if target.exists():
    previous = json.loads(target.read_text())
    if previous['version'] != version:
        raise ValueError('New version requires a separate manifest review')
target.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'status': 'PASS_ALL_60_ORIGINALS_AND_WEB_DERIVATIVES' if not missing else 'PARTIAL_WIP_ASSET_PREPARATION_NOT_COMPLETE', 'version': version, 'verified_originals': len(proof), 'missing_keys': missing, 'proof': proof}, ensure_ascii=False))
