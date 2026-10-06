import bpy,os,hashlib,json,struct
P=os.path.dirname(os.path.abspath(__file__));SRC=os.path.dirname(P)+'/saju_jade_emission050_20261006/SaJu_B_Jade_Emission050_20261006.blend';bpy.ops.wm.open_mainfile(filepath=SRC);s=bpy.context.scene;s.frame_set(1)
body=bpy.data.objects['B candidate5 reconstructed | seamless body and mittens'];m=bpy.data.materials['Deep cloudy jade green mineral light'];p=m.node_tree.nodes.get('Principled BSDF');r=p.inputs['Emission Color'].links[0].from_node.color_ramp
old=list(r.elements[-1].color);new=(.001,.65,.30,1);assert p.inputs['Emission Strength'].default_value==2
base_node=p.inputs['Base Color'].links[0].from_node;base_colors=[(e.position,tuple(e.color)) for e in base_node.color_ramp.elements]
geom=hashlib.sha256(b''.join(struct.pack('<3f',*v.co) for v in body.data.vertices)).hexdigest();r.elements[-1].color=new
assert [(e.position,tuple(e.color)) for e in base_node.color_ramp.elements]==base_colors
s['emission_revision']='Strength remains 2.0 (50 percent original). Only selective emission RGB is cooler richer jade green; base jade pattern/light/camera/exposure unchanged.'
audit={'source':os.path.basename(SRC),'emission_strength_before':2.0,'emission_strength_after':p.inputs['Emission Strength'].default_value,'old_emission_color_linear_rgba':old,'new_emission_color_linear_rgba':list(new),'base_jade_ramp_unchanged':True,'geometry_coordinate_sha256':geom,'camera_lighting_exposure_unchanged':True,'emission_cloud_thresholds_unchanged':[e.position for e in r.elements],'tone_mapping':s.view_settings.view_transform,'frame':1}
json.dump(audit,open(P+'/color_only_audit.json','w'),indent=2)
bpy.ops.wm.save_as_mainfile(filepath=P+'/SaJu_B_Jade_Green050_WIP.blend');s.render.filepath=P+'/Jade_richer_green_50.png';bpy.ops.render.render(write_still=True)
print('GREEN50_COLOR_ONLY_RENDER_DONE',json.dumps(audit),flush=True)
