"""Lossless V4 export cleanup: remove only unused head TEXCOORD_0 and its own bytes.
Conservative schema/hash guards reject any unexpected texture or reference.
"""
import argparse,copy,hashlib,json,struct
from pathlib import Path
BASE='971aa616c595b5a0d5128b75a86ba3e032e115483ee7d22db031f7e520b54f9c'
ALLOWED={'KHR_materials_clearcoat','KHR_materials_specular','KHR_materials_ior'}
def sha(b):return hashlib.sha256(b).hexdigest()
def parse(raw):
 assert struct.unpack_from('<III',raw)==(0x46546c67,2,len(raw))
 n,kind=struct.unpack_from('<II',raw,12);assert kind==0x4e4f534a
 size,kind=struct.unpack_from('<II',raw,20+n);assert kind==0x004e4942 and size==len(raw)-28-n
 return json.loads(raw[20:20+n]),raw[28+n:]
def walk(obj,path=''):
 if isinstance(obj,dict):
  for key,value in obj.items():
   yield path+'/'+key,key,value
   yield from walk(value,path+'/'+key)
 elif isinstance(obj,list):
  for i,value in enumerate(obj):yield from walk(value,path+'/'+str(i))
def accessor_refs(g):
 refs=[]
 for mi,mesh in enumerate(g['meshes']):
  for pi,p in enumerate(mesh['primitives']):
   for key,value in p['attributes'].items():refs.append((p['attributes'],key,value,f'/meshes/{mi}/primitives/{pi}/attributes/{key}'))
   if 'indices' in p:refs.append((p,'indices',p['indices'],f'/meshes/{mi}/primitives/{pi}/indices'))
   assert not p.get('targets') and not p.get('extensions')
 for i,skin in enumerate(g.get('skins',[])):
  if 'inverseBindMatrices' in skin:refs.append((skin,'inverseBindMatrices',skin['inverseBindMatrices'],f'/skins/{i}/inverseBindMatrices'))
 for ai,anim in enumerate(g.get('animations',[])):
  for si,sampler in enumerate(anim['samplers']):
   for key in ['input','output']:refs.append((sampler,key,sampler[key],f'/animations/{ai}/samplers/{si}/{key}'))
 return refs
def view_refs(g):
 refs=[]
 for i,a in enumerate(g['accessors']):
  assert not a.get('sparse') and not a.get('extensions')
  if 'bufferView' in a:refs.append((a,'bufferView',a['bufferView'],f'/accessors/{i}/bufferView'))
 for i,image in enumerate(g.get('images',[])):
  if 'bufferView' in image:refs.append((image,'bufferView',image['bufferView'],f'/images/{i}/bufferView'))
 return refs
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--input',required=True);ap.add_argument('--output',required=True);ap.add_argument('--report',required=True)
 args=ap.parse_args();src,dst,report_path=map(lambda s:Path(s).resolve(),[args.input,args.output,args.report]);assert not dst.exists() and not report_path.exists() and src!=dst
 raw=src.read_bytes();assert sha(raw)==BASE,'Requires exact accepted V4 GLB'
 original,bin_before=parse(raw);g=copy.deepcopy(original)
 assert g.get('extensionsRequired',[])==[] and set(g.get('extensionsUsed',[]))<=ALLOWED
 # These known extensions are material-only; no unknown extension object is edited.
 for pointer,key,value in walk(g):
  if key=='extensions':assert pointer.startswith('/materials/') and set(value)<=ALLOWED
 assert len(g['buffers'])==1 and 'uri' not in g['buffers'][0]
 target=g['meshes'][3]['primitives'][0];assert target['material']==3
 material=g['materials'][3];assert material['name']=='Continuous_Head_V2_Preserved_PBR'
 texture_refs=[pointer for pointer,key,value in walk(material) if key.lower().endswith('texture') or key=='texCoord']
 assert not texture_refs,'Head material or an extension uses texture coordinates'
 attr=target['attributes']['TEXCOORD_0'];assert attr==18
 refs=accessor_refs(g);incoming=[r[3] for r in refs if r[2]==attr];assert incoming==['/meshes/3/primitives/0/attributes/TEXCOORD_0']
 accessor=g['accessors'][attr];view_id=accessor['bufferView'];assert view_id==18
 assert accessor=={'bufferView':18,'componentType':5126,'count':10959,'type':'VEC2'}
 view=g['bufferViews'][view_id];assert view=={'buffer':0,'byteLength':87672,'byteOffset':1656072,'target':34962}
 incoming_views=[r[3] for r in view_refs(g) if r[2]==view_id];assert incoming_views==['/accessors/18/bufferView']
 start=view['byteOffset'];end=start+view['byteLength'];assert start%4==0 and (end-start)%4==0
 for i,v in enumerate(g['bufferViews']):
  assert v['buffer']==0 and not v.get('extensions')
  lo=v.get('byteOffset',0);hi=lo+v['byteLength']
  if i!=view_id:assert hi<=start or lo>=end,'View overlaps deleted UV bytes'
 live_uv=g['meshes'][3]['primitives'][1]['attributes']['TEXCOORD_0'];assert live_uv==25 and g['materials'][4]['pbrMetallicRoughness']['baseColorTexture']=={'index':0}
 del target['attributes']['TEXCOORD_0']
 for container,key,value,pointer in accessor_refs(g):
  assert value!=attr
  if value>attr:container[key]=value-1
 del g['accessors'][attr]
 for container,key,value,pointer in view_refs(g):
  assert value!=view_id
  if value>view_id:container[key]=value-1
 del g['bufferViews'][view_id]
 for v in g['bufferViews']:
  if v.get('byteOffset',0)>=end:v['byteOffset']-=end-start
 bin_after=bin_before[:start]+bin_before[end:]
 g['buffers'][0]['byteLength']-=end-start
 assert g['buffers'][0]['byteLength']==len(bin_after)
 # Prove every surviving view has the exact original byte stream and metadata.
 retained=[]
 for old_id,old in enumerate(original['bufferViews']):
  if old_id==view_id:continue
  new_id=old_id-(old_id>view_id);new=g['bufferViews'][new_id]
  old_bytes=bin_before[old.get('byteOffset',0):old.get('byteOffset',0)+old['byteLength']]
  new_bytes=bin_after[new.get('byteOffset',0):new.get('byteOffset',0)+new['byteLength']]
  assert old_bytes==new_bytes
  retained.append({'old_buffer_view':old_id,'new_buffer_view':new_id,'bytes':len(new_bytes),'sha256':sha(new_bytes)})
 # Inverse all index/offset changes; semantic JSON must reconstruct baseline exactly.
 restored=copy.deepcopy(g)
 for c,k,v,p in accessor_refs(restored):
  if v>=attr:c[k]=v+1
 restored['accessors'].insert(attr,copy.deepcopy(original['accessors'][attr]))
 for c,k,v,p in view_refs(restored):
  if p==f'/accessors/{attr}/bufferView':continue
  if v>=view_id:c[k]=v+1
 restored['bufferViews'].insert(view_id,copy.deepcopy(view))
 for i,v in enumerate(restored['bufferViews']):
  if i!=view_id and v.get('byteOffset',0)>=start:v['byteOffset']+=end-start
 restored['meshes'][3]['primitives'][0]['attributes']['TEXCOORD_0']=attr
 restored['buffers'][0]['byteLength']+=end-start
 assert restored==original,'Unexpected semantic JSON change'
 encoded=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
 payload=struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(bin_after),0x004e4942)+bin_after
 output=struct.pack('<III',0x46546c67,2,12+len(payload))+payload
 assert len(output)<len(raw)
 dst.parent.mkdir(parents=True,exist_ok=True);report_path.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(output)
 report={'status':'PASS_UNUSED_HEAD_UV_LOSSLESS_BUFFER_CLEANUP','source_sha256':sha(raw),'output_sha256':sha(output),'source_bytes':len(raw),'output_bytes':len(output),'saved_bytes':len(raw)-len(output),'saved_percent':(len(raw)-len(output))/len(raw)*100,'attribute_pointer':'/meshes/3/primitives/0/attributes/TEXCOORD_0','removed_accessor':18,'removed_buffer_view':18,'removed_float32_vec2_count':10959,'removed_bin_bytes':87672,'material':material,'all_head_material_and_extension_texture_references':texture_refs,'accessor_incoming_references_before':incoming,'buffer_view_incoming_references_before':incoming_views,'used_body_uv_retained':{'old_accessor':25,'new_accessor':24,'material':'Continuous_Body_Clean_UV_PBR','texture_index':0},'retained_buffer_views_byte_identical':retained,'all_other_semantic_json_equal_after_inverse_remap':True,'positions_indices_normals_colors_skin_clip_materials_images_unchanged':True,'native_blend_modified':False,'no_geometry_reduction_or_v5_retest':True}
 report_path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print(json.dumps({k:v for k,v in report.items() if k!='retained_buffer_views_byte_identical'},indent=2))
if __name__=='__main__':main()
