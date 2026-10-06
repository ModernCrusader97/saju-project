import bpy,os,json,math,fcntl,numpy as np
P=os.path.dirname(os.path.abspath(__file__));bpy.ops.wm.open_mainfile(filepath=P+'/SaJu_Jade_Evolving_Light_v002_Final.blend');s=bpy.context.scene;body=bpy.data.objects['B candidate5 reconstructed | seamless body and mittens'];m=body.data.materials[0];n=m.node_tree.nodes;l=m.node_tree.links;out=next(x for x in n if x.type=='OUTPUT_MATERIAL');em=n.new('ShaderNodeEmission');co=n.new('ShaderNodeCombineColor');co.mode='RGB'
for i in range(3):l.new(n['Evolution weight '+str(i)].outputs[0],co.inputs[i])
l.new(co.outputs[0],em.inputs['Color']);l.new(em.outputs[0],out.inputs['Surface']);img=bpy.data.images.new('weight probe',width=16,height=16,float_buffer=True);img.colorspace_settings.name='Non-Color';tex=n.new('ShaderNodeTexImage');tex.image=img;n.active=tex;s.cycles.samples=1;s.render.bake.margin=2;bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
rows=[]
for f in [1,7,13,19,25,31,37,43,49,55,61,67,73]:
 s.frame_set(f);bpy.context.view_layer.update()
 with open('/tmp/sa-ww2-render.lock','w') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX);bpy.ops.object.bake(type='EMIT');fcntl.flock(lock,fcntl.LOCK_UN)
 a=np.asarray(img.pixels[:],dtype=float).reshape(-1,4)[:,:3];got=a[np.argmax(a.sum(axis=1))];q=((f-1)%72)/24;i=int(q);u=q-i;theta=math.pi/2*u*u*(3-2*u);want=np.zeros(3);want[i]=math.cos(theta);want[(i+1)%3]=math.sin(theta);err=float(np.max(np.abs(got-want)));assert err<1e-5,(f,got,want,err);rows.append({'frame':f,'actual_baked_weights':got.tolist(),'expected_weights':want.tolist(),'maximum_error':err})
r={'native_shader_weight_bakes_pass':True,'samples':rows,'maximum_error':max(x['maximum_error'] for x in rows),'simple_driver':m.node_tree.animation_data.drivers[0].driver.is_simple_expression,'no_auto_execute_override':True};json.dump(r,open(P+'/native_weights_qa.json','w'),indent=2);print('NATIVE_SHADER_WEIGHTS_PASS',r['maximum_error'],r['simple_driver'])
