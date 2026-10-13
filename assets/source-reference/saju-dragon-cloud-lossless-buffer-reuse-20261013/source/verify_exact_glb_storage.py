import argparse,copy,hashlib,json,struct
from pathlib import Path

COMPONENT_BYTES={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}
ELEMENT_COMPONENTS={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def read_glb(path):
    raw=Path(path).read_bytes()
    magic,version,length=struct.unpack_from('<III',raw)
    assert (magic,version,length)==(0x46546C67,2,len(raw))
    chunks=[];pos=12
    while pos<len(raw):
        size,kind=struct.unpack_from('<II',raw,pos);pos+=8
        chunks.append((kind,raw[pos:pos+size]));pos+=size
    assert pos==len(raw) and [x[0] for x in chunks]==[0x4E4F534A,0x004E4942]
    spec=json.loads(chunks[0][1]);binary=chunks[1][1]
    assert len(spec['buffers'])==1 and 'uri' not in spec['buffers'][0]
    assert len(binary)-spec['buffers'][0]['byteLength'] in range(4)
    return raw,spec,binary
def logical_accessor_bytes(spec,binary,a):
    assert 'sparse' not in a and 'bufferView' in a
    v=spec['bufferViews'][a['bufferView']]
    element=COMPONENT_BYTES[a['componentType']]*ELEMENT_COMPONENTS[a['type']]
    stride=v.get('byteStride',element);start=v.get('byteOffset',0)+a.get('byteOffset',0)
    assert a.get('byteOffset',0)+stride*(a['count']-1)+element<=v['byteLength']
    assert start%COMPONENT_BYTES[a['componentType']]==0
    return b''.join(binary[start+i*stride:start+i*stride+element] for i in range(a['count']))
def invariant_document(g):
    c=copy.deepcopy(g)
    for v in c['bufferViews']:v.pop('byteOffset',None)
    c['buffers'][0].pop('byteLength')
    return c
ap=argparse.ArgumentParser();ap.add_argument('--original',required=True);ap.add_argument('--candidate',required=True);ap.add_argument('--out',required=True);a=ap.parse_args()
original,og,ob=read_glb(a.original);candidate,cg,cb=read_glb(a.candidate)
report={'original_sha256':hashlib.sha256(original).hexdigest(),'candidate_sha256':hashlib.sha256(candidate).hexdigest(),'original_bytes':len(original),'candidate_bytes':len(candidate),'checks':{},'accessors':[]}
try:
    assert report['original_sha256']=='a2a1e0a27d5a07cf7c2ec2358f981711b03ce961e8be6ae538d36022caeda2e6','Wrong original WIP'
    assert invariant_document(og)==invariant_document(cg),'Document changed beyond buffer storage offsets/length'
    report['checks']['all_accessors_formats_names_counts_bounds_and_document_semantics_exact']=True
    for i,(v,w) in enumerate(zip(og['bufferViews'],cg['bufferViews'])):
        old=ob[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
        new=cb[w.get('byteOffset',0):w.get('byteOffset',0)+w['byteLength']]
        assert old==new,'bufferView bytes changed '+str(i)
        assert w.get('byteOffset',0)%4==0,'Unaligned buffer view'
    report['checks']['all_bufferView_raw_bytes_identical_including_unused_padding']=True
    for i,(x,y) in enumerate(zip(og['accessors'],cg['accessors'])):
        old=logical_accessor_bytes(og,ob,x);new=logical_accessor_bytes(cg,cb,y)
        assert old==new,'Decoded logical accessor bits differ '+str(i)
        report['accessors'].append({'index':i,'type':x['type'],'componentType':x['componentType'],'count':x['count'],'logical_bytes':len(old),'decoded_component_bits_sha256':hashlib.sha256(old).hexdigest(),'equal':True})
    report['checks']['all_decoded_component_bits_identical_including_float_sign_bits']=True
    for k in ['meshes','materials','nodes','skins','animations','scenes','scene','cameras','images','textures','samplers','extensionsUsed','extensionsRequired']:
        assert og.get(k)==cg.get(k),k+' changed'
    report['checks']['geometry_indices_colors_UV_materials_skeleton_animations_cameras_and_scene_exact']=True
    report['saved_bytes']=len(original)-len(candidate)
    assert report['saved_bytes']>=300000,'No meaningful storage saving (need at least 300000 bytes)'
    report['checks']['meaningful_storage_reduction_without_new_extensions']=True
    report['saved_percent']=100*report['saved_bytes']/len(original)
    report['status']='PASS_EXACT_GLB_STORAGE_EQUIVALENCE_ALL_79_ACCESSORS'
except AssertionError as e:
    report['status']='FAIL_EXACT_GLB_STORAGE_EQUIVALENCE';report['failure']=str(e)
    with Path(a.out).open('x') as f:json.dump(report,f,indent=2);f.write('\n')
    print(json.dumps({'status':report['status'],'failure':str(e)}));raise
with Path(a.out).open('x') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in report.items() if k!='accessors'}))
