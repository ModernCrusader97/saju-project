"""Regenerate the V8 dragon from its literal authoring sources and approved original pixels.
Uses the user's installed Blender; installs nothing, imports no previous dragon, and requires a new output folder.
"""
import argparse,ast,hashlib,json,subprocess,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent
REF_SHA='6184555091c80769d6553ae40641dbb44eb6dcc859dd0b8591b7887cc1502e58'
ap=argparse.ArgumentParser()
ap.add_argument('--blender',default=r'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe')
ap.add_argument('--reference',default=str(HERE.parent/'reference'/'approved-2D-concept-original.png'))
ap.add_argument('--out',required=True)
ap.add_argument('--stills',action='store_true')
ap.add_argument('--validate-only',action='store_true')
a=ap.parse_args();out=Path(a.out).resolve();ref=Path(a.reference).resolve();blender=Path(a.blender).resolve()
assert not out.exists(),'Preserve previous work: choose a new output directory'
assert blender.is_file(),'Supply an existing Blender executable with --blender'
assert ref.is_file() and ref.stat().st_size==1651398 and hashlib.sha256(ref.read_bytes()).hexdigest()==REF_SHA,'Approved reference bytes must match'
manifest=json.loads((HERE/'source-manifest.json').read_text(encoding='utf8'))
checks=[]
for item in manifest['authoring_files']:
    p=HERE/item['name'];b=p.read_bytes();sha=hashlib.sha256(b).hexdigest()
    assert len(b)==item['bytes'] and sha==item['sha256'],('Authoring source bytes changed',item['name'])
    if p.suffix=='.py':ast.parse(b.decode('utf8'),filename=str(p))
    checks.append({'name':p.name,'bytes':len(b),'sha256':sha})
out.mkdir(parents=True)
report={'status':'PASS_SOURCE_AND_APPROVED_REFERENCE_BYTES','source_files':checks,'reference_sha256':REF_SHA,'installs':False,'previous_mesh_or_rig_imported':False,'final_user_appearance_approved':False}
(out/'source-verification.json').write_text(json.dumps(report,indent=2),encoding='utf8')
if a.validate_only:
    print(json.dumps(report));sys.exit(0)
def run(name,script,arguments):
    cmd=[str(blender),'--background','--factory-startup','--disable-autoexec','--python-exit-code','1','--threads','4','--python',str(HERE/script),'--',*arguments]
    with (out/(name+'.log')).open('x',encoding='utf8') as log:
        result=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,cwd=str(out),check=False)
    assert result.returncode==0,(name,'failed; preserve the log and inspect it before a new run')
    print('REGENERATION_STAGE_PASS',name,flush=True)
static=out/'static';model=out/'model'
run('static','build_dragon_v8_volume_v22.py',['--out',str(static),'--reference',str(ref)]+(['--stills'] if a.stills else []))
blend=static/'SaJu_Dragon_V8_Volume_Refinement_v22.blend'
run('static-technical-qa','verify_v8_static.py',['--blend',str(blend),'--out',str(out/'static-technical-qa.json')])
run('fresh-rig-idle-glb','bind_idle_export_v8_volume_v22.py',['--static',str(blend),'--out',str(model)])
outputs=[]
for p in sorted(model.iterdir()):
    if p.is_file():outputs.append({'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
report.update(status='PASS_FRESH_V8_STATIC_NEW_RIG_IDLE_AND_GLTF_REGENERATION',outputs=outputs,model_directory=str(model),not_a_photosimilarity_claim=True)
(out/'regeneration-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report))
