"""Check saved Blender source packs the exact approved PNG and regeneration code."""
import bpy,sys,argparse,hashlib,json
from pathlib import Path
ap=argparse.ArgumentParser()
ap.add_argument("--blend",required=True);ap.add_argument("--reference",required=True)
ap.add_argument("--script",required=True);ap.add_argument("--out",required=True)
a=ap.parse_args(sys.argv[sys.argv.index("--")+1:])
out=Path(a.out).resolve();assert not out.exists()
bpy.ops.wm.open_mainfile(filepath=str(Path(a.blend).resolve()),load_ui=False)
reference=[im for im in bpy.data.images if im.name.startswith("Approved_2D_Concept_SHA256_")]
assert len(reference)==1
im=reference[0];assert im.packed_file
packed=bytes(im.packed_file.data);expected=Path(a.reference).read_bytes()
assert packed==expected
assert list(im.size)==[1254,1254]
embedded=bpy.data.texts["REGENERATE_build_dragon.py"].as_string()
source=Path(a.script).read_text(encoding="utf8")
assert embedded==source,"Embedded generator differs from delivered source"
report={"status":"PASS_PACKED_SOURCE_BYTES","reference_bytes":len(packed),
 "reference_sha256":hashlib.sha256(packed).hexdigest(),"pixels":list(im.size),
 "embedded_generator_matches_delivered_script":True,
 "generator_sha256":hashlib.sha256(Path(a.script).read_bytes()).hexdigest(),
 "blend_sha256":hashlib.sha256(Path(a.blend).read_bytes()).hexdigest()}
out.write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
print(json.dumps(report),flush=True)

