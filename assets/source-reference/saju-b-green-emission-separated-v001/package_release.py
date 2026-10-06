from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import hashlib,json,zipfile,struct
P=Path(__file__).resolve().parent;F='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';B='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc';f=lambda n:ImageFont.truetype(F,n);b=lambda n:ImageFont.truetype(B,n)
im=Image.new('RGB',(1510,815),'#eff1ec');d=ImageDraw.Draw(im);d.text((40,25),'비취 정령 · 빛 자체의 초록색을 분리',font=b(34),fill='#17372b');d.text((42,82),'발광 강도 50%(2.0) 고정  |  발광색과 흰 표면 반사의 혼합을 수정',font=f(22),fill='#486252')
for x,title,fn in [(35,'이전 · 전체 렌더','before_beauty.png'),(530,'수정 · 전체 렌더','after_green_verified.png'),(1025,'수정 · 발광 성분만','after_emission_only_AgX.png')]:
 im.paste(Image.open(P/fn).convert('RGB').resize((450,450)),(x,133));d.text((x+10,604),title,font=b(26),fill='#17372b')
d.text((43,668),'같은 형상·기본 무늬·조명·카메라·노출입니다. 빛이 나는 부분의 흰 반사 혼합을 줄였습니다.',font=f(21),fill='#486252');d.text((43,706),'오른쪽은 실제 렌더에서 빛 방출 성분만 분리한 검증 화면입니다. 추가 bloom은 없습니다.',font=f(21),fill='#486252');d.text((43,751),'원본 재질과 GLB 재가져오기 모두 확인했습니다. 사이트 적용과 최종 디자인 승인은 별도입니다.',font=f(20),fill='#486252')
im.save(P/'SaJu_Jade_Green_Emission_Before_After_Proof.jpg',quality=95)
im=Image.new('RGB',(1080,675),'#eff1ec');d=ImageDraw.Draw(im);d.text((35,25),'편집 원본과 GLB 재가져오기 확인',font=b(30),fill='#17372b')
for x,t,fn in [(45,'Blender 원본','after_green_verified.png'),(565,'GLB 재가져오기','glb_reimport_green.png')]:
 im.paste(Image.open(P/fn).convert('RGB'),(x,97));d.text((x+10,593),t,font=b(25),fill='#17372b')
im.save(P/'SaJu_Jade_Native_vs_GLB_Verification.jpg',quality=95)
# Verify required shader maps survive export.
dat=(P/'SaJu_Jade_GreenEmission_Separated_v001.glb').read_bytes();sz=struct.unpack('<I',dat[12:16])[0];g=json.loads(dat[20:20+sz]);m=[m for m in g['materials'] if m.get('name')=='Jade Green Emission Separated | PBR'][0];ext=m['extensions'];assert ext['KHR_materials_emissive_strength']['emissiveStrength']==2
for extn,tex in [('KHR_materials_specular','specularTexture'),('KHR_materials_clearcoat','clearcoatTexture'),('KHR_materials_transmission','transmissionTexture')]:assert tex in ext[extn]
assert not [r for tag in ['buffers','images'] for r in g.get(tag,[]) if r.get('uri')]
json.dump({'material':m,'animations':[a.get('name') for a in g.get('animations',[])],'external_dependencies':False},open(P/'gltf_material_contract.json','w'),indent=2)
files=['SaJu_Jade_GreenEmission_Separated_v001.blend','SaJu_Jade_GreenEmission_Separated_v001.glb','Jade_ReflectanceBase_1024.png','Jade_GreenEmission_1024.png','Jade_ReflectionMask_1024.png','SaJu_Jade_Green_Emission_Before_After_Proof.jpg','SaJu_Jade_Native_vs_GLB_Verification.jpg','before_beauty.png','after_green_verified.png','after_emission_only_AgX.png','glb_reimport_green.png','emission_raw_0001.exr','after_emission_raw_0001.exr','emission_raw_AgX.png','emission_raw_Standard.png','beauty_raw_Standard.png','gloss_direct_AgX.png','INTEGRATION_README_ko.txt','final_validation.json','gltf_material_contract.json','diagnose_passes.py','test_separation.py','refine_separation.py','smooth_isolation.py','bake_export_final.py','verify_and_reimport.py','package_release.py','verification.log']
manifest=[{'file':n,'bytes':(P/n).stat().st_size,'sha256':hashlib.sha256((P/n).read_bytes()).hexdigest()} for n in files];json.dump(manifest,open(P/'manifest.json','w'),indent=2);(P/'SHA256SUMS.txt').write_text('\n'.join(x['sha256']+'  '+x['file'] for x in manifest)+'\n');files+=['manifest.json','SHA256SUMS.txt']
z=P/'SaJu_Jade_GreenEmission_Separated_Integration_v001.zip'
with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as a:
 for name in files:a.write(P/name,name)
with zipfile.ZipFile(z) as a:assert a.testzip() is None
print(json.dumps({'zip':str(z),'bytes':z.stat().st_size,'sha256':hashlib.sha256(z.read_bytes()).hexdigest(),'files':len(files)}))
