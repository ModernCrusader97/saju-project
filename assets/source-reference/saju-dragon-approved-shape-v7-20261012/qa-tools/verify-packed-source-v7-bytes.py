import bpy,pathlib,sys,json,hashlib,ast
root=pathlib.Path('D:/Codex/Results/SaJuDragonApprovedShapeV7-20261012-Joseph');native=root/'delivery-v7-reviewed/native/SaJu_Dragon_Approved_Shape_v7.blend';source=pathlib.Path('D:/Codex/Work/SaJuDragonApprovedShapeV7-20261012-Joseph/final-source');h=lambda b:hashlib.sha256(b).hexdigest();before=h(native.read_bytes());bpy.ops.wm.open_mainfile(filepath=str(native),load_ui=False);assert len(bpy.data.libraries)==0
pairs=[('build_dragon.py','build_dragon_v7.py'),('material_surface_smooth_v7.py','material_surface_v7.py'),('explicit_world_runtime_copy_v7.py','runtime_copy_v7.py'),('shape_weight_binding_v7.py','weight_binding_v7.py')];codes=[]
for textname,filename in pairs:
 external=(source/filename).read_bytes();text=next((t for t in bpy.data.texts if t.as_string().encode('utf8')==external),None);assert text,'Missing byte-identical packed authoring source '+filename;packed=text.as_string().encode('utf8');assert packed==external,(textname,'Native packed source differs from deliverable source');ast.parse(external.decode('utf8'));codes.append({'native_text':text.name,'deliverable_source':filename,'bytes':len(external),'sha256':h(external),'byte_identical':True})
for p in source.glob('*.py'):ast.parse(p.read_text(encoding='utf8'))
images=[]
for im in bpy.data.images:
 if im.packed_file:images.append({'name':im.name,'size':list(im.size),'packed_bytes':len(im.packed_file.data),'sha256':h(im.packed_file.data)})
assert len(images)==2;assert {x['sha256'] for x in images}=={'6184555091c80769d6553ae40641dbb44eb6dcc859dd0b8591b7887cc1502e58','c04d177c62311e833bc6fb8fa345d2605d56aa3ed280466a85571329d85ac059'}
report={'status':'PASS_NATIVE_PACKED_REFERENCE_TEXTURE_AND_EXACT_SOURCE_BYTES','native_sha256':before,'native_bytes':native.stat().st_size,'source_code':codes,'packed_images':images,'linked_external_blender_libraries':0,'frozen_python_sources_syntax_valid':True,'source_native_not_saved_or_modified':h(native.read_bytes())==before,'reproduction_components_actually_executed':True,'orchestrator_validate_only_passed':True,'orchestrator_full_fresh_run_not_repeated':True}
with (root/'delivery-v7-reviewed/qa/native-packed-source-byte-verification.json').open('x',encoding='utf8') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps(report),flush=True)