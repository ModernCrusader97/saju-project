"""Regenerate the approved V7 candidate into a NEW folder using installed Blender.
No Git, app defaults, other models, existing files, installs or network are changed.
"""
import argparse,pathlib,hashlib,json,subprocess,sys,shutil
ap=argparse.ArgumentParser();ap.add_argument('--blender',required=True);ap.add_argument('--output',required=True);ap.add_argument('--reference');ap.add_argument('--stills',action='store_true');ap.add_argument('--validate-only',action='store_true');a=ap.parse_args();here=pathlib.Path(__file__).resolve().parent;blender=pathlib.Path(a.blender);out=pathlib.Path(a.output);reference=pathlib.Path(a.reference) if a.reference else here.parent/'reference/approved-2D-concept-original.png';sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
assert blender.is_file();assert out.is_absolute() and not out.exists(),'Use a new absolute output folder; preserve previous versions';assert reference.is_file() and reference.stat().st_size==1651398 and sha(reference)=='6184555091c80769d6553ae40641dbb44eb6dcc859dd0b8591b7887cc1502e58','Exact approved 2D reference required'
scripts=['build_dragon_v7.py','material_surface_v7.py','runtime_copy_v7.py','weight_binding_v7.py','root_skin_export.py']
for name in scripts:assert (here/name).is_file()
plan={'status':'VALIDATED_COMPONENTS_AND_REFERENCE','source_sha256':{n:sha(here/n) for n in scripts},'reference_sha256':sha(reference),'output':str(out),'stages':['new signed-distance shape and 13-bone periodic rig','continuous head/chin/body material bake','explicit world rest runtime copies','radius-aware distance-relaxed smooth-head binding','BIN-preserving root skin export'],'no_existing_output_overwrite':True}
if a.validate_only:print(json.dumps(plan,indent=2));sys.exit(0)
out.mkdir();(out/'logs').mkdir();records=[]
def run(name,cmd):
 log=out/'logs'/(name+'.log')
 with log.open('x',encoding='utf8') as f:
  process=subprocess.Popen([str(x) for x in cmd],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8',errors='replace')
  for line in process.stdout:print(line,end='',flush=True);f.write(line)
  code=process.wait()
 if code:raise RuntimeError(name+' failed with exit '+str(code)+'; preserved log '+str(log))
 records.append({'stage':name,'log_sha256':sha(log),'exit_code':code})
def stage(name,script,args):run(name,[blender,'--background','--factory-startup','--disable-autoexec','--threads','4','--python-exit-code','1','--python',here/script,'--',*args])
block=out/'shape';material=out/'material';runtime=out/'runtime-copies';binding=out/'binding';filename='SaJu_Dragon_Approved_Shape_v7';extra=['--stills'] if a.stills else []
stage('shape','build_dragon_v7.py',['--out',block,'--reference',reference,*extra])
stage('material','material_surface_v7.py',['--blend',block/(filename+'.blend'),'--expected-input-sha256',sha(block/(filename+'.blend')),'--out',material,*extra])
stage('runtime-copies','runtime_copy_v7.py',['--input',material/(filename+'.blend'),'--expected-input-sha256',sha(material/(filename+'.blend')),'--out',runtime])
stage('binding','weight_binding_v7.py',['--input',runtime/(filename+'.blend'),'--expected-input-sha256',sha(runtime/(filename+'.blend')),'--generator',here/'build_dragon_v7.py','--out',binding])
final=out/'final'
for name in ['runtime','native','textures','reference','qa']:(final/name).mkdir(parents=True)
run('root-skin-export',[sys.executable,here/'root_skin_export.py','--input',binding/(filename+'.glb'),'--output',final/'runtime'/(filename+'.glb'),'--expected-input-sha256',sha(binding/(filename+'.glb')),'--report',final/'qa/root-skin-export-report.json'])
for src,dst in [(binding/(filename+'.blend'),final/'native'/(filename+'.blend')),(material/'textures/Dragon_V7_Body_BaseColor.png',final/'textures/Dragon_V7_Body_BaseColor.png'),(reference,final/'reference/approved-2D-concept-original.png')]:assert not dst.exists();shutil.copyfile(src,dst);assert sha(src)==sha(dst)
files=[{'path':p.relative_to(final).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(final.rglob('*')) if p.is_file()]
with (out/'regeneration-receipt.json').open('x',encoding='utf8') as f:json.dump({'status':'REGENERATED_V7_CANDIDATE_REQUIRES_FRESH_QA_FOR_NEW_OUTPUT','plan':plan,'stages':records,'files':files,'note':'Native/GLB bytes may differ across runs due to serialized names and paths; verify geometry, rig and loop on a newly generated output before promoting it.'},f,indent=2);f.write('\n')
print('V7_REGENERATION_READY',str(final),flush=True)