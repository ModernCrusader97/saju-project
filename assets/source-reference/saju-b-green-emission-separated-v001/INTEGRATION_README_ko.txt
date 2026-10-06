SaJu B 정령 — 초록 발광 분리 수정 / 2026-10-06

이번 수정
이전에는 실제 emission 패스가 녹청색이었지만, 밝은 구름무늬의 표면 반사와 흰 광택이 겹친 전체 영상에서 발광색이 희게 보였습니다. AgX도 밝은 색의 채도를 줄입니다. 같은 HDR 렌더를 AgX/Standard로 대조하고, 실제 emission 패스와 glossy 패스를 분리해 확인했습니다.
이 수정은 발광 강도나 bloom을 늘리지 않습니다. 전용 발광 강도는2.0(최초4.0의50%)입니다. 원래 발광 마스크(노이즈 문턱0.50~0.72)를 유지하고, 빛이 나오는 부분의 반사광 혼합을 별도로 낮춥니다. 발광색은 선형RGB(0.001,0.65,0.08)입니다.

보존된 항목
- 모든 형상·모프·오브젝트 변환
- 카메라·조명·노출·감마·AgX
- 원래 비취 기본색 램프와 구름무늬 노이즈
- 원래 발광 마스크의 위치·진폭과 강도 배수2 (원시 렌더의 픽셀별 광량이 완전히 같다는 뜻은 아닙니다.)

의도적으로 달라진 항목
- 발광 영역의 반사 성분을 감쇠하는 부드러운 마스크를 추가했습니다. 이것은 기본색을 단순히 초록으로 바꾸는 작업과 다릅니다.
- 발광 RGB의 파랑 성분을 줄여 녹청색에서 초록색 빛으로 옮겼습니다.
- 전체 합성의 밝기는 반사광 감쇠 때문에 달라질 수 있습니다. 전체 장면 밝기가 동일하다는 뜻은 아닙니다.
- 실제 원시 emission 패스의 같은28,056픽셀 녹색 채널 평균은0.29925→0.30495로 약1.9%차이입니다. 큰 발광 강도 증폭으로 효과를 만든 것이 아닙니다.

기본 파일
SaJu_Jade_GreenEmission_Separated_v001.blend — 권위 있는 편집 네이티브. 원래 비취 BRDF와 발광을 분리한 노드 구성이 있습니다.
SaJu_Jade_GreenEmission_Separated_v001.glb — 프로젝트 통합용 자체 포함 PBR 미리보기. glTF 코팅/반사/투과 확장을 포함하며, Blender SSS와 완전히 같은 렌더를 보장하지 않습니다.
Jade_ReflectanceBase_1024.png — 실시간용 반사 감쇠가 구워진 기본색.
Jade_GreenEmission_1024.png — 동일 무늬의 초록 발광색. sRGB 데이터.
Jade_ReflectionMask_1024.png — 표면 반사/코팅/투과 감쇠 마스크. 선형 데이터, alpha 포함.

프로젝트 통합 주의
1. GLB의 emissiveTexture와 emissiveStrength2를 함께 유지합니다. 단일 초록 emissive 색으로 덮어쓰지 마세요.
2. KHR_materials_specular의 specularTexture, KHR_materials_clearcoat의 clearcoatTexture, KHR_materials_transmission의 transmissionTexture를 유지합니다. 이 마스크를 지우면 흰 반사 혼합 문제가 다시 생길 수 있습니다.
3. 기본색·발광색은 sRGB, 반사 마스크는 선형으로 해석합니다. 정상 GLTF 로더가 설정한 색 공간을 일괄 변경하지 마세요.
4. 추가 bloom이나 노출 증가는 검증에 사용하지 않았습니다. 제공된 미리보기는 AgX·기존 카메라·기존 조명입니다.
5. 제한된 인사 모프 연구1개가 유지됩니다. 전체 조인트 리그, 10간 최종 세트, 사이트 반영 완료를 뜻하지 않습니다. 이전 선택5 완성 마스터의 동일 복원본도 아닙니다.
6. GLB를 다시 불러와 같은 스튜디오에서 렌더한 결과를 포함했습니다. 브라우저/GPU/모바일 성능은 이 파일 검증 범위 밖입니다.

출처
Blender 공식 설명: AgX는 높은 노출 영역의 색을 탈색합니다.
https://docs.blender.org/manual/en/5.0/render/color_management/displays_views.html
Blender glTF 확장/텍스처 지원:
https://docs.blender.org/manual/en/4.2/addons/import_export/scene_gltf2.html

결과와 진단 파일은 별도 버전이며 이전 작업을 덮어쓰지 않았습니다. Drive 업로드 또는 사이트/저장소 변경은 하지 않았습니다.
