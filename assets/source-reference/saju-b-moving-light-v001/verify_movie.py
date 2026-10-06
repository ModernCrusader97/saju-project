from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np,json,subprocess
P=Path(__file__).resolve().parent;frames=[np.asarray(Image.open(P/'frames'/f'{i:03}.png').convert('RGB')) for i in range(1,74)];assert len(frames)==73 and all(a.shape==(320,320,3) for a in frames);assert np.array_equal(frames[0],frames[72])
delta=frames[18].astype(float)-frames[0].astype(float);a=frames[0].astype(float);b=frames[18].astype(float);mask=((a[:,:,1]>a[:,:,0]*1.08)&(a[:,:,1]>a[:,:,2]*1.05))|((b[:,:,1]>b[:,:,0]*1.08)&(b[:,:,1]>b[:,:,2]*1.05));pos=int(((delta[:,:,1]>8)&mask).sum());neg=int(((delta[:,:,1]<-8)&mask).sum());assert pos>500 and neg>500
raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(P/'SaJu_Jade_MovingLight_12s_Preview_v001.mp4'),'-f','rawvideo','-pix_fmt','rgb24','-']);decoded=np.frombuffer(raw,dtype=np.uint8).reshape(-1,320,320,3);assert len(decoded)==144;repeated=bool(np.array_equal(decoded[:72],decoded[72:]));assert repeated
report={'rendered_frames':73,'movie_loop_frames':72,'fps':12,'loop_seconds':6,'preview_seconds':12,'preview_decoded_frames':144,'native_endpoint_pixel_identical':True,'video_two_repeats_pixel_identical':repeated,'quarter_cycle_green_pixels_brighter':pos,'quarter_cycle_green_pixels_dimmer':neg,'spatial_change_both_directions':True,'emission_strength_constant':2,'base_material_coordinates_static':True,'shader_animation_in_glb':False}
json.dump(report,open(P/'movie_qa.json','w'),indent=2)
F='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';B='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc';f=lambda n:ImageFont.truetype(F,n);bold=lambda n:ImageFont.truetype(B,n)
im=Image.new('RGB',(1380,555),'#eff1ec');d=ImageDraw.Draw(im);d.text((32,22),'비취 안에서 천천히 이동하는 초록빛',font=bold(33),fill='#17372b');d.text((34,77),'바탕 비취·몸·빛의 색은 고정  |  발광 구름무늬만 이동하는 6초 루프',font=f(21),fill='#486252')
for i,(frame,label) in enumerate([(1,'0초'),(19,'1.5초'),(37,'3초'),(55,'4.5초')]):
 x=20+i*340;im.paste(Image.fromarray(frames[frame-1]),(x,121));d.text((x+12,452),label,font=bold(24),fill='#17372b')
d.text((34,507),'6초 뒤 첫 프레임과 픽셀까지 동일하게 이어집니다. 웹사이트 적용은 별도입니다.',font=f(21),fill='#486252');im.save(P/'SaJu_Jade_Moving_Light_Keyframes_v001.jpg',quality=95);print(json.dumps(report))
