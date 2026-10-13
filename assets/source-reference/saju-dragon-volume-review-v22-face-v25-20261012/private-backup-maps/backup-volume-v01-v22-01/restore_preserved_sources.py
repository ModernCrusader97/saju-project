import argparse,json,hashlib,zipfile
from pathlib import Path
ap=argparse.ArgumentParser();ap.add_argument("--manifest",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();mp=Path(a.manifest).resolve();m=json.loads(mp.read_text(encoding="utf8"));out=Path(a.out).resolve();assert not out.exists(),"Use a new restore folder; original files are never overwritten";out.mkdir(parents=True);archives={};restored=[]
for row in m["source_files"]:
 p=(out/row["restore_relative_path"]).resolve();assert p.is_relative_to(out);p.parent.mkdir(parents=True,exist_ok=True);h=hashlib.sha256()
 with p.open("xb") as f:
  for key in row["chunks"]:
   c=m["unique_chunks"][key];zp=mp.parent/c["part"];assert zp.is_file();z=archives.setdefault(str(zp),zipfile.ZipFile(zp));data=z.read(c["entry"]);assert len(data)==c["bytes"] and hashlib.sha256(data).hexdigest()==key;f.write(data);h.update(data)
 assert p.stat().st_size==row["bytes"] and h.hexdigest()==row["sha256"];restored.append(str(p))
for z in archives.values():z.close()
(out/"restore-verification.json").write_text(json.dumps({"status":"PASS_RESTORED_ALL_SOURCE_FILE_SHA256","files":len(restored),"originals_overwritten":False},indent=2),encoding="utf8");print("Restored",len(restored),"exact source files into",out)
