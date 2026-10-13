import argparse,bpy,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from measure_face_fixes import upper_contact
ap=argparse.ArgumentParser();ap.add_argument('--blend',required=True);ap.add_argument('--out',required=True);a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);p=Path(a.out);assert not p.exists();bpy.ops.wm.open_mainfile(filepath=a.blend,load_ui=False);rows=upper_contact();maximum=max(r['max_gap'] for r in rows);minimum=min(r['min_gap'] for r in rows);passed=maximum<=.002 and minimum>=-.015;r={'status':'PASS_PRESERVED_STRICT_UPPER_LID_CONTACT' if passed else 'FAIL_UPPER_LID_FIX_REGRESSION','maximum_gap':maximum,'minimum_gap':minimum,'maximum_allowed_gap':.002,'minimum_allowed_gap':-.015,'eyes':rows};p.write_text(json.dumps(r,indent=2));print(json.dumps({k:v for k,v in r.items() if k!='eyes'}),flush=True);assert passed,'The earlier reconstructed eyelid-contact fix must remain intact'
