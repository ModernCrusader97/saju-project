# 승인 십간 재질 연결 재제작 · 2026-10-09

실제 원격을 확인한 `43e2d8dc6efe1654641e639397f37d0ea44f525a`에서 독립 브랜치 `rebuild/ten-stem-materials-20261009`를 만들었다. 이 작업은 현재 GitHub에 보존된 코드와 원본을 사용한 **새 구현**이다. 미확보된 `a97c418` 또는 `2709`와 동일한 복원이라는 주장은 하지 않는다. 기준 확인 당시 원격 main은 `2e2d82b05f87b39ff8057ae914e8dfa01100a974`, 지정된 최신 작업 기준은 `43e2d8d`였다. main 병합, PR, 배포, 새 인증 및 권한 변경은 작업 범위에 포함하지 않았다.

기준 커밋의 loader는 乙만 승인 옥을 사용하고 나머지 9개를 `createPlanetMaterial`로 그렸다. 실험실의 `createStemMaterial`과 실제 삼각형 표면 효과는 연결되지 않았다. 현재 기준에 필요한 모듈이 이미 있어 보존 ZIP을 추출하거나 Library 403 파일을 받지 않았다. `.agents/skills` 및 `AGENTS.md`는 기준 트리와 기존 체크아웃에서 찾지 못했다. 보존 브랜치의 과거 모델/재질은 소실된 최신 후보의 증거로 사용하지 않았다.

| 일간 | 적용 재질 | B형 표면 효과 |
| --- | --- | --- |
| 甲 | 나무껍질 | 실제 표면 법선에 붙는 가지와 가지 끝 잎 |
| 乙 | 덩굴 결 | 짧은 동일 mesh 표면 덩굴과 잎 |
| 丙 | 불꽃 | 삼각형 표면에서 방출하는 기존 불꽃 |
| 丁 | 숯·잔불 | 삼각형 표면에서 방출하는 작은 잔불 |
| 戊 | 사암 | 모래 입체 효과는 비활성 |
| 己 | 승인 옥·움직이는 초록빛 v002 | 원본 field atlas 및 emission 사용 |
| 庚 | 브러시드 티타늄 | 기본 재질 |
| 辛 | 액체 은빛 | 기본 재질의 움직이는 결 |
| 壬 | 흐르는 물 | 물보라·포말 입체 효과는 비활성 |
| 癸 | 이슬 | 표면 제자리 맺힘·소멸, 이동/흐름은 미구현 |

기존 실험실의 己 청화백자 표본은 역사적 실험 코드로 남아 있다. 승인 B형 loader는 그 recipe를 사용하지 않으며 승인 옥으로 명시적으로 연결한다. 캐릭터 Blender 재질, 옛 웹 표본, 현재 승인 웹 재질을 동일한 증거로 취급하지 않는다. 전체 덩굴 몸체, 戊 모래, 壬 물보라, 癸 흐르는 이슬의 완료를 주장하지 않는다.

## 원본과 좌표 보존

`scripts/sync-approved-jade-assets.mjs`가 아래 원본을 체크섬 검증 후 `public/spirits/jade-v002/body.glb`로 복사하는 경로를 그대로 사용한다. 공개 runtime 사본은 기존 ignore 규칙대로 생성물이며 원본과 bytes가 같다.

`assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb`

| 항목 | SHA-256 |
| --- | --- |
| 원본 및 runtime GLB | `0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84` |
| body POSITION | `f7e39c85723b4220d0e69161e4405c3232d514b18be56e8a3854ec6fff48da8b` |
| body NORMAL | `80706bee870329a0829113e63ed178f0a904029265da2c96c69ad50f9b1f9cec` |
| body UV | `f3300a24812551e09c6b6a4bc31795feb19c80dc22cf1708cda7a64890e9539c` |
| body index | `934286d3bdd9361657e390c41762923871cec85a48a7d9775b362aee02dc7830` |

33,207 body vertices, 승인 B형 팔·표정·몸체, 중립 morph 및 기존 Z 깊이 배율 `1.35`를 유지한다. body의 정면 크기는 약 `[1.754513, 2.384798, 1.283860]`이다. 일지 동반자와 월령 배경의 역할 및 기존 planet 재질 경로도 유지한다. 원본 geometry/UV를 변형하거나 덩굴 몸체로 교체하지 않는다.

9개 study recipe는 부모 group을 rest 좌표 기준으로 삼아 그 아래 model의 고정 깊이 변환을 포함한다. 표시용 회전/스케일은 rest 속성을 다시 만들지 않는다. 己의 옥은 검증된 원본 mesh-local adapter를 그대로 쓴다. 표면 sampler는 비활성 morph가 존재하는 실제 B형을 허용하고, active morph/skinning/instancing을 허용하지 않는다. 생성 후 morph를 활성화해도 부착을 거부한다.

Canvas의 모든 render에서 현재 절대 시간과 camera로 효과를 갱신한다. 일시정지 중 drag에도 부착이 따라가며 불꽃 alpha 정렬에 camera를 전달한다. 효과는 instance buffer를 포함해 먼저 정리하고 model에서 제거한다. rest 속성이 붙어 있는 상태에서 일반 geometry/material/texture disposal을 한 번 수행한 **뒤** rest 속성을 복원한다. 옥의 별도 field atlas도 한 번 정리한다. 텍스처 로드 실패 및 atlas 크기 오류의 경로도 검증한다.

## 재현과 검증

변경 전 실제 GLB CPU suite는 25개 중 24개 실패, 기존 rest 속성 복원 검사 1개 통과였다. 모든 연결 실패는 기대한 recipe/옥/효과 연결 부재에서 발생했다. 실제 렌더링에서도 기존 delta clock으로 같은 절대 시간을 두 번 호출하면 프레임이 바뀌는 것을 재현했다. 변경 전 이미지와 렌더링 결과를 보존했다. 초기 browser harness의 texture 잔존 한도 1은 renderer 내부 transmission/environment texture 3을 고려하지 못했다. 최종 검사는 geometry 0과 여러 차례 추가 교체 후 texture 수의 동일성을 확인한다.

검증 로그·JSON·비교 이미지는 [QA 근거](qa/ten-stem-rebuild/)에 있다.

| 검증 | 결과 |
| --- | --- |
| 실제 GLB CPU 통합 | 25/25 통과: 십간 × low/high, 원본 해시, 깊이 반영 rest 속성, neutral morph triangle 부착, 변환된 가지 끝 잎, reset/반복 시간, cleanup once, 실패 경로 |
| 승인 원본 패키지 | 46개 파일 체크섬 및 PNG/raw atlas 일치 통과 |
| 옥 원본 runtime tests | v001/v002 합계 21/21 통과 |
| 타입 | `tsc --noEmit --incremental false` 통과 |
| 빌드 | `npm run build` 통과; 큰 client chunk 및 vinext route 분류 경고는 남음 |
| 실제 WebGL renderer | 십간 × low/high 20개와 oblique/side 3개, 실제 GLB/PNG, 원본 해시/크기/pet 간격, 움직이는 pixel, 정확한 reset, 안정적인 GPU 정리 검증 |
| 실제 WebGL buffer 수명 | Three `0.186.1`에서 십간 × low/high 20개, 소유 VBO 2,232개 각각 1회 삭제, 삭제 후 `gl.isBuffer()` false, 잔존 소유 버퍼/bytes 0 |
| 실제 Canvas component | Strict Mode/mobile viewport에서 7개 재질/효과 유형의 reduced-motion 일시정지·drag·정확한 reset, 재생/일시정지, WebGL 복구와 실제 draw 재개, unmount 후 draw 중단 통과 |
| 기존 깊이·pet browser 회귀 | 6개 검사, 동반자 12종 × low/high 통과; 눈 부착/정면·측면 간격/월령 역할 포함 |
| 기존 DOM 회귀 | 21/21 통과; chat/daily/guin/saved 및 malformed saved-list 포함 |
| 실제 built Worker chat 회귀 | 합성 in-memory D1로 3/3 통과 |
| saved archive API 회귀 | 합성 기록 120개, 요약/상세/소유자/인덱스 검사 통과 |
| 기존 전체 Worker 통합 | 23개 검사 통과; 페이지·정적 자산·일반 기능·mock 전용 AI fixture 및 제한 포함 |

변경된 7개 소스/QA 파일의 lint는 오류 0개이며 Canvas의 기존 `<img>` 경고 1개가 남아 있다. 생성물 `outputs`를 제외한 전체 lint는 기존 오류 43개에서 40개로 감소했다. 변경 파일의 기존 `prefer-const` 3개를 정리했으며, 나머지 기존 오류는 이번 재제작 범위 밖이라 그대로 남긴다. 구체적 파일과 규칙은 lint 근거 JSON에 기록한다.

## GPU buffer 정리 후속 검증

초기 재제작 `3e4e8e9dc273e956f332d2431d1751489772663c`에는 `restBinding.dispose()`를 geometry disposal보다 먼저 실행하는 문제가 있었다. 실제 설치 버전은 Three `0.186.1`이다. 그 버전의 `WebGLGeometries.onGeometryDispose()`는 현재 `geometry.attributes`를 순회하고 `WebGLAttributes.remove()`가 각 `gl.deleteBuffer()`를 호출한다. rest 속성을 먼저 제거하면 renderer의 geometry 카운트가 0이어도 해당 속성의 삭제 경로가 빠진다.

실제 승인 B GLB를 로드하고 렌더링한 수정 전 甲/high 검증에서 네 rest VBO의 업로드를 확인했다. 각 `398,484` bytes, 합계 `1,593,936` bytes였으며 dispose 두 번 뒤에도 네 버퍼의 delete 호출은 0이고 `gl.isBuffer()`는 true였다. 수정 전 추가 CPU 검사는 non-jade 9간 × 2 quality, 18개에서 정리 시점의 rest 속성 부재로 실패했다. 수정은 정리 순서만 바꾸며 형상·재질·효과 생성 알고리즘을 변경하지 않는다. 렌더러 23개, 실제 Canvas 동작, 깊이·12종 pet 회귀, 타입·빌드를 재실행해 통과했고, 23개 렌더의 pixel hash가 검토 대상 커밋의 기록과 모두 일치했다.

`scripts/qa/ten-stem-buffer-lifecycle.mjs`는 업로드하는 TypedArray를 실제 WebGLBuffer와 연결하고 모델·효과·instance buffer의 생성/삭제 및 실제 유효성을 확인한다. 수정 후 20개 case에서 소유 버퍼 2,232개가 각각 한 번 삭제됐고, 살아 있는 소유 버퍼와 bytes가 0이었다. CPU 25개도 통과했다. 계측은 WebGLBuffer wrapper의 강한 참조를 유지해 GC가 누락된 명시적 삭제를 가리지 못하게 한다. 따라서 GC를 기다리면 자원이 언제 반환되는지 또는 영구 메모리 누수 크기를 측정한 결과라는 주장은 하지 않는다. 전후 근거는 [수정 전](qa/ten-stem-rebuild/buffer-lifecycle-before.json), [수정 후](qa/ten-stem-rebuild/buffer-lifecycle-after.json)에 있다.

같은 브라우저에서 乙 표면 효과 constructor를 이미 로드된 중립 B형 mesh에 3회씩 별도 호출했다. low는 `408.0 / 398.7 / 544.1ms`, high는 `508.2 / 451.4 / 449.6ms`였다. 이 구간은 sampler/path/initial update를 포함하지만 네트워크·GLB 및 이미지 디코드·GPU 렌더는 제외한다. 선행 20개 case 뒤 같은 local 테스트 환경에서 별도 한 번의 loader 구간은 low `572.9ms`, high `636.0ms`로 해당 I/O·rest binding·효과 생성도 포함한다. 제한된 환경/표본이며 모바일 시간, 전체 CPU case 시간, p95 또는 cold load 시간으로 일반화하지 않는다. 이번 후속 수정에서는 생성 알고리즘 최적화를 하지 않는다.

```sh
node scripts/sync-approved-jade-assets.mjs
node scripts/qa/ten-stem-materials.mjs
node scripts/qa/verify-approved-assets.mjs
npx tsc --noEmit --incremental false
npm run build
npm run lint -- --ignore-pattern outputs

# 설치된 Playwright와 Chromium의 실제 경로를 지정한다.
SAJU_QA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs \
SAJU_QA_CHROME=/path/to/chromium node scripts/qa/ten-stem-browser.mjs
SAJU_QA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs \
SAJU_QA_CHROME=/path/to/chromium node scripts/qa/ten-stem-buffer-lifecycle.mjs
SAJU_QA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs \
SAJU_QA_CHROME=/path/to/chromium node scripts/qa/spirit-depth-pets.mjs
```

CPU suite는 실제 GLB를 GLTFLoader로 파싱하고 browser image/network I/O만 대체한다. 따라서 texture의 실제 표시 근거는 GLB/PNG를 그대로 읽는 WebGL 검사다. 시각 검증은 Chromium SwiftShader이며 물리 모바일 GPU, 실제 터치 기기, hosted 로그인, 실제 사용자 DB 및 배포는 실행하지 않았다. Canvas component는 최소 크기 CSS를 가진 독립 테스트 mount를 사용하므로 전체 사이트 디자인 검증이라는 주장은 하지 않는다. 기존 `universe-browser.mjs` 전체 suite는 실행하지 않고 실제 loader/Canvas와 깊이·pet browser 회귀를 실행했다. DOM/API 검증은 임시 도구 및 폐기 가능한 합성 in-memory D1을 사용했다. 비밀키, `.env`, 실제 사용자 DB, npm 도구/cache, runtime 생성물은 브랜치에 포함하지 않는다.
