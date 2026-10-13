import argparse,hashlib,json,zipfile
from pathlib import Path,PurePosixPath
ap=argparse.ArgumentParser();ap.add_argument('--manifest',required=True);ap.add_argument('--out',required=True);a=ap.parse_args();mp=Path(a.manifest).resolve();m=json.loads(mp.read_text());out=Path(a.out).resolve()
if out.exists():raise FileExistsError('Choose a new output folder; preserve all originals')
archives={}
for part in m['parts']:
 p=(mp.parent/part['file']).resolve()
 if not p.is_relative_to(mp.parent):raise ValueError('Archive path escapes input folder')
 if p.stat().st_size!=part['bytes'] or hashlib.sha256(p.read_bytes()).hexdigest()!=part['sha256']:raise ValueError('Archive size/hash mismatch '+p.name)
 z=zipfile.ZipFile(p)
 if z.testzip() is not None:raise ValueError('Archive CRC failure '+p.name)
 archives[part['file']]=z
out.mkdir(parents=True)
for row in m['source_files']:
 rel=PurePosixPath(row['restore_relative_path'])
 if rel.is_absolute() or '..' in rel.parts or '\\' in str(rel):raise ValueError('Invalid restore path')
 p=(out/str(rel)).resolve()
 if not p.is_relative_to(out):raise ValueError('Output path escapes destination')
 p.parent.mkdir(parents=True,exist_ok=True);h=hashlib.sha256();size=0
 with p.open('xb') as f:
  for key in row['chunks']:
   c=m['unique_chunks'][key];data=archives[c['part']].read(c['entry'])
   if len(data)!=c['bytes'] or hashlib.sha256(data).hexdigest()!=key:raise ValueError('Chunk hash mismatch')
   f.write(data);h.update(data);size+=len(data)
 if size!=row['bytes'] or h.hexdigest()!=row['sha256']:raise ValueError('Reconstructed source mismatch')
for z in archives.values():z.close()
print('PASS_RESTORED_EXACT_CLOUD_FILES',len(m['source_files']))
