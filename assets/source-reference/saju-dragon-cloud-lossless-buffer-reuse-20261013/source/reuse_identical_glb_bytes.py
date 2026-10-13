"""Share byte-identical aligned buffer ranges; preserve every accessor and bufferView definition."""
import argparse,copy,hashlib,json,struct
from pathlib import Path

ap=argparse.ArgumentParser();ap.add_argument('--source',required=True);ap.add_argument('--out',required=True);ap.add_argument('--report',required=True);a=ap.parse_args()
src=Path(a.source).resolve();out=Path(a.out).resolve();report_path=Path(a.report).resolve()
assert src!=out and not out.exists() and not report_path.exists(),'Preserve all existing files'
data=src.read_bytes();source_hash=hashlib.sha256(data).hexdigest()
assert source_hash=='a2a1e0a27d5a07cf7c2ec2358f981711b03ce961e8be6ae538d36022caeda2e6','Unexpected original WIP'
assert struct.unpack_from('<III',data)==(0x46546C67,2,len(data))
json_len,json_type=struct.unpack_from('<II',data,12);assert json_type==0x4E4F534A
g=json.loads(data[20:20+json_len]);bin_len,bin_type=struct.unpack_from('<II',data,20+json_len)
assert bin_type==0x004E4942 and 28+json_len+bin_len==len(data)
binary=data[28+json_len:];assert len(g['buffers'])==1 and 'uri' not in g['buffers'][0]
assert not any(x in g.get('extensionsUsed',[]) for x in ['KHR_draco_mesh_compression','EXT_meshopt_compression'])
views=g['bufferViews'];assert all(v['buffer']==0 for v in views)
blocks=[binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']] for v in views]
assert all(len(b)==v['byteLength'] for b,v in zip(blocks,views))
kept=[];aliases={}
for i in sorted(range(len(views)),key=lambda i:len(blocks[i]),reverse=True):
    match=None
    for j in kept:
        if views[i].get('target')!=views[j].get('target') or views[i].get('byteStride')!=views[j].get('byteStride'):continue
        start=blocks[j].find(blocks[i])
        while start>=0 and start%4:start=blocks[j].find(blocks[i],start+1)
        if start>=0:match=(j,start);break
    if match is None:kept.append(i)
    else:aliases[i]=match
assert sum(len(blocks[i]) for i in aliases)>=300000,'No meaningful byte-exact opportunity'
packed=bytearray();offsets={}
for i in sorted(kept):
    packed.extend(b'\0'*(-len(packed)%4));offsets[i]=len(packed);packed.extend(blocks[i])
for i,(parent,start) in aliases.items():offsets[i]=offsets[parent]+start
candidate_spec=copy.deepcopy(g)
for i,v in enumerate(candidate_spec['bufferViews']):
    if offsets[i] or 'byteOffset' in v:v['byteOffset']=offsets[i]
candidate_spec['buffers'][0]['byteLength']=len(packed)
candidate_json=json.dumps(candidate_spec,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode('utf-8');candidate_json+=b' '*(-len(candidate_json)%4)
packed.extend(b'\0'*(-len(packed)%4))
result=struct.pack('<III',0x46546C67,2,28+len(candidate_json)+len(packed))+struct.pack('<II',len(candidate_json),0x4E4F534A)+candidate_json+struct.pack('<II',len(packed),0x004E4942)+packed
with out.open('xb') as f:f.write(result)
report={'status':'BYTE_IDENTICAL_STORAGE_REUSE_CANDIDATE_QA_PENDING','source_file':str(src),'source_sha256':source_hash,'candidate_sha256':hashlib.sha256(result).hexdigest(),'source_bytes':len(data),'candidate_bytes':len(result),'saved_bytes':len(data)-len(result),'saved_percent':100*(len(data)-len(result))/len(data),'reused_ranges':[{'view':i,'existing_view':p,'existing_range_offset':s,'bytes':len(blocks[i])} for i,(p,s) in sorted(aliases.items())],'accessor_component_types_or_values_changed':False,'bufferView_count_unchanged':True,'accessor_count_unchanged':True,'extensions_added':False,'runtime_dependencies_added':False,'UV_cleanup_repeated':False,'original_overwritten':False}
with report_path.open('x') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps(report))
