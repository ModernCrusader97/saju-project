SaJu 비취 정령: 이동하는 초록 발광 런타임 소스 v001

범위
이 폴더는 아트 납품에 동봉하는 엔진 독립 GLSL 함수와 JavaScript 기준 구현입니다.
기존 앱·저장소·Site를 수정하거나 Three.js 등 특정 엔진에 연결한 결과물이 아닙니다.
최종 Blender 편집 파일의 비취 몸체에 적용할 통합 기준이며, 얼굴/눈/입 재질에는 적용하지 않습니다.

파일
- saju-jade-flow.glsl: 텍셀 중심 8개를 직접 읽는 삼선형 atlas 샘플러, 6초 이동, 두 마스크, 선형 합성
- saju-jade-flow.mjs: 동일한 수식의 순수 JavaScript 기준 구현과 고정 매개변수
- textures/Jade_OriginalBaseColor_1024.png: 감쇠를 굽기 전 원래 비취 기본색, sRGB
- textures/jade_field_atlas_128.png: 원래 Blender 절차적 필드를 샘플링한 16-bit grayscale atlas
- textures/jade_field_atlas_128.u16le: 같은 atlas의 little-endian uint16 원시 데이터
- atlas-metadata.json: 실제 atlas 파일의 규격, 방향, 수치 및 해시
- tests/: CPU 테스트와 로컬 Mesa GLSL 컴파일·수치 검증 도구/결과
atlas와 최종 Blender 렌더의 생성·검증은 상위 아트 작업이 담당합니다.

변하지 않는 것 / 이동하는 것
원래 비취 기본색 텍스처, 기본 UV, 표면 노멀, 거칠기와 기존 형상은 그대로 둡니다.
발광 필드 좌표만 canonicalSourcePosition + offset(seconds)로 이동합니다.
반사 억제 마스크도 같은 필드 샘플을 사용하여 발광 무늬와 함께 이동합니다.
전체 몸체에 같은 밝기 배수를 곱하는 애니메이션, 기본색 무늬 회전, bloom, 노출 펄스는 없습니다.

6초 루프
s = seconds를 6으로 양의 나머지 처리한 값
τ = 2πs / 6
offset = (0.14 sin τ, 0.055(1−cos τ), 0.14(sin(τ+π/3)−sin(π/3)))
0초와 6초의 offset은 (0,0,0)이고 접선도 일치합니다.
프레임 기준은 flow_parameters.json의 (frame−1)/12초입니다. 1~72프레임이 한 주기입니다.
JavaScript의 wrapSeconds로 시간을 먼저 [0,6)로 줄여 GPU에 전달하세요.
큰 epoch timestamp나 장시간 누적된 32-bit float 시간을 그대로 GPU에 보내면 정밀도가 낮아집니다.

필드와 마스크
emissionMask = clamp((field−0.50)/(0.72−0.50),0,1)
isolationMask = smoothstep(0.38,0.66,field)
reflectiveFraction = 1−isolationMask
emissionRadiance = linearRGB(0.001,0.65,0.08) × 2 × emissionMask
출력 = 원래 비취의 비발광 표면 방사휘도 × reflectiveFraction + emissionRadiance
모든 계산과 합성은 선형 공간에서 하고, 톤 매핑/디스플레이 변환은 그 뒤에 한 번만 합니다.

중요: 기존 정적 GLB 재질을 그대로 겹치면 안 됩니다
이전 Jade_ReflectanceBase_1024.png에는 정지된 반사 억제가 기본색에 이미 구워져 있습니다.
새 이동 마스크와 함께 쓰면 예전 위치의 어두운 무늬가 남습니다.
런타임 애니메이션을 켤 때 몸체의 기본색은 동봉한 Jade_OriginalBaseColor_1024.png로 바꾸세요.
정적 emissiveTexture와 정적 반사/clearcoat/transmission 감쇠 맵도 중복 적용하지 마세요.
그 대신 원래의 비취 PBR/확장 매개변수와 기본색을 복원한 뒤, 동적 reflectiveFraction을
표면의 비발광 성분 전체에 적용하고 동적 emissionRadiance를 더해야 합니다.
GLSL의 sajuComposeLinear 인수 originalJadeBRDF는 조명을 계산한 표면 방사휘도입니다.
기본색 텍스처나 specularFactor 하나에만 이 배수를 곱하는 것과 같지 않습니다.
원래 BRDF에 포함된 diffuse, specular, clearcoat, transmission, SSS의 처리 위치를 엔진에서 확인하세요.
이 모듈에는 검증되지 않은 Three.js onBeforeCompile 패치가 포함되어 있지 않습니다.
기존 GLB의 정적 emissiveStrength=2를 동적 emissionRadiance에 다시 곱하지 마세요.

몸체 좌표 어댑터
샘플러의 기본 입력은 이미 정규화한 원래 Blender Generated 좌표입니다.
v001 몸체의 mesh-local glTF POSITION에서만 아래 매핑을 확인했습니다.
canonicalBlender = (glTF.x, −glTF.z, glTF.y)
center = (0.000006973743438720703, −0.000013902783393859863, 1.1804927587509155)
halfSize = (0.877256453037262, 0.4755038022994995, 1.1923989057540894)
Generated = 0.5 + (canonicalBlender−center)/(2×halfSize)
JS: gltfLocalToGenerated(position)
GLSL: sajuV001BodyGLTFLocalToGenerated(position)
이 매핑은 flow_parameters.json의 실제 texspace와 원본 GLB의 몸체 POSITION 범위/노드에 근거합니다.
일반적인 모든 glTF의 축 변환 규칙으로 취급하지 마세요.
월드 좌표, 이미 skin/morph 변형된 좌표, 재중심화·크기 정규화된 좌표를 그대로 넣으면 안 됩니다.
원래 몸체의 변형 전 mesh-local 좌표에서 Generated를 산출하여 varying으로 전달하세요.
스키닝·모프·재내보내기 시 좌표 보존을 별도로 확인해야 합니다.

Atlas 저장 규약
128×128×128 scalar grid. 각 축은 0~127, domain의 양 끝을 정확히 포함하는 i/127 격자입니다.
domain minimum = (−0.2, −0.05, −0.3), maximum = (1.2,1.2,1.1)
16열×8행의 타일, 타일당128×128픽셀, 전체2048×1024픽셀, 패딩 없음.
z = tileX + 16×tileY
source column = tileX×128 + gridX
source row = tileY×128 + gridY
PNG 파일의 맨 위 행/원시 데이터의 첫 행 = source row 0 = 첫 z-타일행의 y 최소.
PNG 뷰어에 보이는 위/아래와 GPU의 v 좌표 방향을 혼동하지 마세요.
raw 파일 크기는 2048×1024×2 = 4,194,304 bytes입니다. 각 uint16을 65535로 나누세요.
각 필드값은 색이 아닌 선형 scalar입니다. sRGB 변환, 감마 보정, 톤 매핑을 적용하면 안 됩니다.
이 atlas는 실제 Blender noise의 샘플을 저장합니다. 샘플 사이의 삼선형 보간은 원래 연속 절차적 함수의
유한 해상도 근사이며, 임의의 3D 지점에서 완전히 동일한 값/미세 패턴을 보장하지는 않습니다.

GPU 텍스처 설정
- 랩: CLAMP_TO_EDGE, min/mag: NEAREST, mipmap 생성 안 함
- 한 텍셀의 scalar가 .r에 선형 정규화 값으로 들어가야 함
- 픽셀 중심: ((tileX,tileY)×128+(gridX,gridY)+0.5)/(2048,1024)
- 8개 중심에서 직접 샘플링하여 xyz 보간하므로 인접 z 타일로 번지지 않음
- 하드웨어 float-linear filtering 확장에 의존하지 않음
- float와 sampler 모두 highp 필요. 모듈은 GLES sampler2D의 기본 정밀도를 highp로 선언함
- GLES100: texture2D 기본 사용. GLES300: 모듈 앞에 SAJU_TEXTURE를 texture로 정의
- 버전 선언, highp float 선언, 입력/varying, 출력 및 엔진 셰이더 연결은 호출 측 책임
- source row 0이 v=0 쪽으로 업로드되면 flipV=false
- 전체 source image 행이 반전되어 업로드되면 flipV=true. 개별 타일을 따로 뒤집지 않음
NEAREST R32F에 Uint16을 65535로 나눈 Float32Array를 업로드하는 경로는 동봉 Mesa 검사에서 사용했습니다.
16-bit PNG를 일반 이미지 로더/캔버스로 읽으면 8-bit로 변환될 수 있으므로 16-bit 보존을 실제 확인하세요.
이를 피하려면 동봉 raw를 DataView.getUint16(offset,true)로 읽고 float scalar로 변환할 수 있습니다.
이 raw는 RGBA 픽셀 배열이 아닙니다. 원시 파일은 그대로 GPU의 uint16 정수 sampler에 연결하는 데이터도 아닙니다.
다른 저장 포맷을 쓰면 샘플 결과가 0~1 scalar가 되도록 명시적으로 정규화하세요.

JavaScript 기준 구현
SAJU는 수정할 수 없는 매개변수 객체입니다.
sampleScalarAtlas(data,position)는 정확히2048×1024개의 Uint16Array/Float32Array/Float64Array를 받습니다.
Uint16은 내부에서 /65535, float 배열은 이미 선형 scalar인 것으로 처리합니다.
PNG 디코딩이나 파일 I/O는 제공하지 않습니다.
evaluateJadeFlow(data,canonicalSourcePosition,seconds)는 baseSourcePosition을 바꾸지 않고,
fieldSourcePosition, field, 두 마스크, reflectiveFraction, emissionRadiance를 반환합니다.
이 API는 테스트·파이프라인 검증용이며, 매 프레임 모든 픽셀을 CPU에서 처리하는 용도가 아닙니다.

검증
runtime 폴더에서: node --test
로컬 Mesa 확인: python tests/check_glsl_mesa.py
CPU: 11개 테스트 통과. 원점/주기/접선, 유한값, atlas 경계·타일 중심·보간, uint16,
서로 다른 공간 마스크, 기본 좌표 고정 및 몸체 좌표 변환을 검증했습니다.
Mesa: llvmpipe / OpenGL ES 3.2, GLSL ES100과ES300 각각 컴파일·링크 및289개 수치검사 통과.
인공 affine field에 대한 총578개 검사, 최대 절대 오차3.24×10⁻⁷.
GLSL ES100은 ES3.2 컨텍스트에서 검증했으며, 실제 ES2 장치 인증을 뜻하지 않습니다.
브라우저/WebGL, Three.js, 실제 모바일 GPU, 성능, 최종 엔진의 모든 PBR lobe/투명도 합성은 미검증입니다.
실제 atlas의 native probe 비교 결과가 제공되면 해당 결과를 함께 검토하세요.

동봉 실제 데이터 확인
실제16-bit PNG와raw의2,097,152개 값이 모두 일치하고, raw 해시가 atlas-metadata.json과 같습니다.
125개 공간 좌표×72프레임=9,000개 샘플이 모두 유한값이며0초/6초 필드 오차는0입니다.
node tests/check_native_atlas.mjs 실행 결과는 tests/native-atlas-results.json에 저장됩니다.
이 검사는 native-field-probes.json이 있으면 원래 필드와 atlas 보간의 field/마스크 오차도 계산합니다.
PNG/raw 일치 결과는 tests/png-raw-verification.json에 있습니다.

독립 native probe 비교 (256지점)
field: RMS0.00421, 평균 절대오차0.00316, 최대 절대오차0.01298
emissionMask: 최대 절대오차0.04878
isolationMask: 최대 절대오차0.05803
따라서 이128³atlas가 절차적 필드 전체와 수치적으로 완전히 같다는 뜻은 아닙니다.
렌더러별 조명·SSS·톤 매핑 차이는 이 scalar-field 비교에 포함되지 않습니다.
