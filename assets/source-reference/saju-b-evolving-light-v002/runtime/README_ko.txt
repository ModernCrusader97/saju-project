SaJu 옥 정령 / 빛의 국소 변화 v002

목표
승인된 형상, 옥 바탕색, 원본 표면 질감은 고정한다. 빛은 작은 영역에서 생기고, 옅어지고, 연결된다. v001에서 보였던 빛 무늬의 원형 이동을 제거했다. 좌표 이동, 마스크 공전, 회전, 전역 강도 맥동은 없다.

정확한 소스 계약
- 같은 Blender 네이티브 3D Noise / FBM / Normalize=True를 세 번 평가한다.
- Scale 4.3 / Detail 3.2 / Roughness 0.65 / Lacunarity 2.0.
- 각 입력은 canonicalSourcePosition + 고정 상수이다.
  A=(0,0,0), B=(5.21,8.73,2.91), C=(-7.43,3.17,11.61).
- 상수는 이미 atlas RGB 채널에 반영되어 있다. 런타임에서 다시 더하면 안 된다.
- 좌표에는 시간이 들어가지 않는다. base texture UV도 바꾸지 않는다.
- 128×128×128 endpoint grid i/127, canonical domain [0,1]^3.
- 16×8 Z tiles, 2048×1024. tileX=z%16, tileY=floor(z/16).
- 각 texel RGBA=(fieldA,fieldB,fieldC,255), unsigned normalized 8-bit.
- PNG는 RGBA8. raw는 interleaved RGBA unsigned bytes 8,388,608바이트.
- source row 0은 첫 Z tile row 내 canonical Y-min이다. 원본 PNG 맨 위 행도 source row 0이다.
- RGB는 색상이 아닌 선형 데이터다. PNG의 RGB에 sRGB 변환을 적용하면 안 된다.
- v001 scalar atlas, grayscale PNG, uint16/raw 계약과 호환되지 않는다.

시간 변화
T=6초. A→B→C→A를 각 2초에 걸쳐 전환한다.
phase=wrap(t,6)/2; segment=floor(phase); u=fract(phase)
e=u*u*(3-2*u); theta=PI/2*e
현재 field 가중치 cos(theta), 다음 field 가중치 sin(theta), 나머지는 0.
field=clamp(0.5 + dot(weights, fields-0.5), 0, 1)
가중치 제곱합이 1이므로 독립·동분산·중심화 field의 분산을 보존한다. 단순 선형 교차 전환의 중간 대비 약화를 피한다. 실제 atlas의 유한 샘플, field 상관, threshold/clamp 때문에 전체 발광 면적 또는 평균 밝기가 수학적으로 상수인 것은 아니다. 전역 밝기 배율은 쓰지 않는다.
0/2/4/6초에서 일차 시간 미분은 0이다. 6초와 0초 결과는 일치한다.

승인된 재질 값 유지
emissionMask=clamp((field-0.50)/0.22,0,1), 선형 ramp.
isolation=smoothstep(0.38,0.66,field).
선형 초록 RGB=(0.001,0.65,0.08), strength=2.
최종 선형 출력=originalJadeBRDF*(1-isolation)+greenRGB*2*emissionMask.
노출, bloom, tone mapping 강도는 바꾸지 않는다.
originalJadeBRDF는 원래 옥 재질의 전체 비발광 표면 방사휘도다. base-color 텍스처 자체가 아니다. 호스트가 지원하는 반사/투과/coat/SSS 등 모든 기여를 일관되게 분리해야 한다. 이 소스는 특정 엔진 hook을 구현하지 않는다.

파일
- saju-jade-evolution.glsl: ES 1.00/3.00 휴대형 모듈. 직접 8 texel RGB를 fetch하고 trilinear 보간한다.
- saju-jade-evolution.mjs: 순수 JS 참조 구현/좌표 adapter/파라미터.
- animation-parameters.json: 고정 상수와 식.
- atlas-metadata.json, native-field-probes.json: 네이티브 bake와 probe 기록.
- textures/jade_fields_atlas_128.png, .rgba8: 고정 ABC field 데이터.
- textures/Jade_OriginalBaseColor_1024.png: v001의 감쇠 전 원본 옥 바탕 텍스처를 그대로 사용한다.

로더/셰이더 연결 시 지킬 사항
1. raw는 Uint8Array 및 RGBA/UNSIGNED_BYTE로 올린다. PNG는 RGBA8로 decode한다. 두 경로 모두 non-color/linear 데이터로 취급한다.
2. NEAREST min/mag filter, CLAMP_TO_EDGE, mipmap 생성 없음. sRGB decoding, premultiplied alpha, texture 압축 없음.
3. 전체 이미지 row를 뒤집지 않고 업로드하면 flipV=false. 전체 이미지 row를 뒤집어서 업로드했다면 flipV=true. 그림을 보며 추측하지 말고 실제 업로드 row 순서를 확인한다.
4. fragment highp float와 highp sampler2D가 필요하다. ES 3.00에서는 모듈 앞에 SAJU_TEXTURE를 texture로 정의한다. ES 1.00 기본은 texture2D이다.
5. CPU wrapSeconds(t)의 [0,6) 결과를 매 프레임 전달한다. NaN/Infinity를 보내지 않는다. epoch timestamp를 GPU float에 직접 보내지 않는다.
6. 원본 바탕 텍스처 UV와 메시를 움직이지 않는다. atlas는 canonicalSourcePosition 그대로 한 번 읽는다.
7. 제공 adapter는 v001에서 검증된, 변형되지 않은 body glTF mesh-local POSITION만 지원한다. Blender=(gltf.x,-gltf.z,gltf.y). texspace center/halfSize는 파라미터에 기록했다. world-space, skinned position, recentered 또는 transform-baked 메시에는 재검증 없이 쓰지 않는다.
8. shading은 선형 공간에서 합성한 뒤 기존 tone mapping을 적용한다. 스크린샷/MP4에서 추출한 감쇠된 색을 원본 base로 재사용하지 않는다.

검증
runtime 폴더에서 실행:
node --test tests/*.test.mjs
python tests/check_glsl_mesa.py
python tests/verify_png_raw.py
node tests/check_native_atlas.mjs

CPU 테스트: 시간 독립 좌표, L2=1, 경계/loop/미분, finite time, 선형 RGB fixture, 정규화, tile index/flip/clamp, 서로 반대 방향의 국소 변화, 원래 재질 값, 고정 body adapter.
Mesa 테스트: 로컬 OpenGL ES 컨텍스트에서 ES 1.00/3.00 소스 컴파일·링크, RGBA8 실제 텍스처 읽기 및 수치 비교. atlas가 존재하면 실제 atlas 검사도 수행한다.
PNG/raw 테스트: 모든 RGBA byte의 exact match, alpha 255, checksum, 형식/크기.
네이티브 테스트: 세 field를 독립 probe와 비교하고 합성 field/mask 오차, 6초 seam, 시간 불변 좌표, 양방향 공간 변화 검사. 8-bit quantization 및 trilinear 근사 오차를 수치로 기록한다.

이번 파일의 실제 검증 결과
- CPU 10개 테스트 통과.
- Mesa: ES 1.00/3.00 각각 1,117개 수치 검사, 그중 실제 atlas 216개. 최대 절대 오차 0.000000557.
- PNG/raw 모든 byte 일치, alpha 255, 원본 base-color checksum 유지.
- 네이티브 probe 256개, 합성 단계 3,072개 비교. 최대 오차: field 0.012061 / emission mask 0.042085 / isolation 0.046057. atlas는 native field의 128³/RGB8 근사이므로 bit-exact 절차적 noise가 아니다.
- 24,696개 시간/공간 샘플에서 field 샘플 좌표와 ABC 값은 시간에 따라 불변. 0↔6초 seam 오차 0. 각 전환에서 밝아지는 위치와 어두워지는 위치를 모두 확인했다.

범위
이것은 런타임 재질 소스와 검증 자료다. 앱/저장소/Site 수정, 실제 브라우저/Three.js/모바일 기기 통합, 배포를 수행하거나 검증했다고 주장하지 않는다. 네이티브 atlas 수치 결과는 tests/native-atlas-results.json, GPU 결과는 tests/glsl-mesa-results.json이 생성된 뒤 해당 내용으로 확인한다.
