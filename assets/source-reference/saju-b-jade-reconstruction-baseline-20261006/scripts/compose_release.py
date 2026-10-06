from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
p=Path(__file__).resolve().parent
font='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';bold='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
f=lambda s:ImageFont.truetype(font,s);b=lambda s:ImageFont.truetype(bold,s)
# Comparison board uses unmodified actual model renders, only placed/resized for layout.
W,H=1600,870;im=Image.new('RGB',(W,H),'#eff1ec');d=ImageDraw.Draw(im)
d.text((48,30),'B 정령 · 비취 재질 적용 비교',font=b(38),fill='#17372b')
d.text((50,89),'선택한 5번 팔 형태를 참고해 새로 만든 캐릭터 | 같은 모델·조명·카메라',font=f(21),fill='#486252')
cols=[('색유리 대조','새로 제작한 분홍 유리','release_glass.png'),('비취 · 비발광','짙은 초록 + 구름무늬','release_jade_control.png'),('비취 · 초록빛','광물 무늬에 선택적 발광','release_jade_glow_v002.png')]
for i,(title,sub,fn) in enumerate(cols):
 x=50+i*505;im.paste(Image.open(p/fn).convert('RGB').resize((490,490)),(x,146));d.text((x+14,651),title,font=b(28),fill='#17372b');d.text((x+14,693),sub,font=f(21),fill='#486252')
d.line((50,743,1548,743),fill='#c7d1c8',width=2)
d.text((50,765),'새 재제작 비교판입니다. 이전 최종본의 동일 복원이나 사이트 적용본은 아닙니다.',font=f(22),fill='#3c5548')
d.text((50,802),'몸통과 팔은 하나의 닫힌 표면으로 연결했습니다. 전체 제스처 리그는 아직 미완성입니다.',font=f(21),fill='#3c5548')
im.save(p/'SaJu_B_Jade_Material_Comparison_20261006.jpg',quality=95)
# Form comparison, clearly including source model and a bounded new pose study.
im=Image.new('RGB',(1510,790),'#eff1ec');d=ImageDraw.Draw(im);d.text((40,26),'선택5 형태 참고 · 새 연결부와 포즈 검토',font=b(33),fill='#17372b')
for i,(title,fn) in enumerate([('기존 후보5 원본',p.parent/'source/candidate_5_neutral.png'),('새 비취 재제작 · 중립',p/'release_jade_glow_v002.png'),('제한된 인사 포즈 연구',p/'release_wave_v002.png')]):
 x=30+i*495;im.paste(Image.open(fn).convert('RGB').resize((475,475)),(x,105));d.text((x+10,600),title,font=b(24),fill='#17372b')
d.text((42,664),'왼쪽은 원래 후보 원본입니다. 오른쪽 두 장은 새로운 연결 표면과 제한된 포즈 연구입니다.',font=f(21),fill='#486252')
d.text((42,701),'손 모으기는 어깨 접힘이 보여 제외했습니다. 완성된 새 리그나 10간 적용 완료를 뜻하지 않습니다.',font=f(21),fill='#486252')
im.save(p/'SaJu_B_Connection_Pose_Review_20261006.jpg',quality=95)
