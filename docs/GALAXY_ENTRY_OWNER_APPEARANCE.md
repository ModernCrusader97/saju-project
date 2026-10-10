# 은하 진입 연결과 같은 소유자 행성 외형 수정

기준은 실제 비공개 원격에서 확인한 `8ba3b9763bcaa88a8a3f2e108fa331a49800090f`입니다. 독립 브랜치 `fix/galaxy-entry-owner-appearance-20261010`에서 두 문제를 재현하고 수정했습니다. 이 작업은 복원 소스 계보에 대한 새 수정입니다. 배포된 v29의 정확한 소스와 일치한다는 주장이나, 미확보 후보 `a97c418`을 동일하게 복원했다는 주장은 하지 않습니다.

## 원인과 변경

기존 진입은 고정된 `node.worldPos`에서 끝났지만, 다음 프레임은 이미 경과한 전역 은하 시간으로 공전 위치를 계산했습니다. 따라서 착륙 종료와 다음 공전 위치가 달랐습니다. 또한 `sin(tπ) × 4.5`의 마지막 수직 속도는 약 −5.05 units/s로, 수직 속도 0인 공전과 연결되지 않았습니다.

이제 같은 기존 공전 함수로 매 프레임 현재 목적지 `O(time)`를 계산하고, 진입 시작 시의 접근 오프셋에 `(1−t)³`을 곱해 더합니다. 종료 시 오프셋과 그 미분이 모두 0이므로 위치와 속도가 공전에 이어집니다. 원래 각속도 `.052 / sqrt(max(1, radius / 6))`, 시작 좌표, 2.8초 진입, 불변 기준 좌표, 관계선의 cloned endpoints를 유지합니다. 진입 위치 계산을 추적 카메라 갱신 앞으로 옮겨 같은 프레임의 위치를 추적합니다. pause/속도 0/reduced motion/초기화도 함께 검증했습니다.

같은 소유자 생일 **2000-01-01 12:30**을 개인 화면 → 실제 로컬 지도 생성 → 은하로 전달했습니다. 세션과 저장된 API owner의 네 기둥은 모두 `무오 / 병자 / 기묘 / 무오`였습니다. 기본 pangaea에서는 재질 이름, 셰이더 프로필·색·고정 마스크가 같았습니다. 1024/512 호출값은 내부에서 같은 512×256으로 제한되므로 원인이 아니었습니다.

확인된 외형 차이는 개인에만 기존 표면 효과가 붙고, 은하는 `pangaea`를 고정 사용한다는 점입니다. 개인의 무/병 본체에는 5개 배치가 있었고 은하에는 0개였습니다. `archipelago` 선택 시 개인/은하 마스크 RGBA FNV1a는 각각 `1100551764` / `2245384427`로 달랐습니다.

`createPlanetAppearance`가 기존 `createPlanetMaterial`과 `createSurfaceEffects`를 함께 생성하도록 두 본체를 연결했습니다. 효과는 본체 mesh 자식이며 **개인 geometry radius 1.85 / 은하 geometry radius 1**을 사용합니다. 은하의 기존 scale 1.3/.88을 상속하므로 이중 확대하지 않습니다. 기존 효과 시계, pause, 초기화, node 교체·언마운트 시 명시적 `disposeSurfaceEffects`를 연결했습니다. Strict Mode 포함 instance buffer/geometry/material 자원 30개 및 재생성 후 45개가 각각 한 번만 해제됐습니다.

지도 복원 함수는 지도 ID·저장된 소유자·네 기둥을 먼저 검증하고 snapshot 또는 null을 반환합니다. 이름·생일·정확한 시간·네 기둥을 포함한 전체 owner key가 같으면 이후의 mask/view 선택을 보존합니다. 반환된 마스크는 해당 owner 본체에만 적용합니다. 다른 지도, unbound legacy URL, 다른 소유자/시간에는 전달하지 않으며 친구는 기존 pangaea를 사용합니다. 지도 A→B에서 이전 마스크가 남지 않도록 로드마다 기본값을 설정합니다.

카메라·조명·공전/자전·위성/띠 크기·mesh 해상도는 기존 화면 맥락을 유지했습니다. 개인과 은하는 다른 반구를 보여 주며 노출도 1.05/1.45로 다릅니다. 동일한 재질·무늬여도 최종 화면의 시점과 밝기는 다를 수 있습니다. 원인 조사에서 effects만 숨기거나 exposure/light/camera만 바꾼 독립 WebGL 대조군으로 이 차이를 구분했습니다. [원인 조사 기록](qa/galaxy-entry-appearance/before-owner-investigation.json)은 기준 소스의 결과입니다.

## 검증

[전체 결과](qa/galaxy-entry-appearance/validation-summary.json)와 같은 테스트의 [수정 전 WebGL](qa/galaxy-entry-appearance/before-entry-appearance-browser.json), [수정 후 WebGL](qa/galaxy-entry-appearance/after-entry-appearance-browser.json)을 함께 보존했습니다. before/after는 동일한 harness SHA를 사용합니다. 진입 fixture affinity를 91로 고정해 같은 기준 좌표를 사용했습니다.

| 검사 | 수정 전 | 수정 후 |
| --- | --- | --- |
| 실제 React/Three 진입 CPU, 30/60/144fps, 진입 전 0/20/3600초, 속도·pause·reset·reduced motion | 11 PASS / 12 FAIL | 23 PASS / 0 FAIL |
| 십간 기존 효과, 정규화 instance 배치·반지름·70/30·시계·해제 | 0 PASS / 13 FAIL | 13 PASS / 0 FAIL |
| 실제 빌드 Worker/WebGL 진입·동일 owner·마스크 재진입/새로고침·십간 셰이더 | 1 PASS / 7 FAIL | 8 PASS / 0 FAIL |

실제 WebGL 진입 경계의 최대 프레임 속도는 30/60/144fps에서 각각 **181.48 / 362.26 / 869.29 → .287 / .288 / .287 units/s**로 바뀌었습니다. 수정 후 경계 모든 프레임(9/16/37개)에 실제 본체 draw와 native `modelMatrix`가 있으며 CPU 위치와의 최대 차이는 `9.34e−7` 미만입니다. 이전 경계에는 순간 이동한 본체가 카메라 밖으로 나가 draw가 빠지는 프레임도 있었습니다. CPU에서 종료 양쪽 1ms 유한차분 속도 차이는 `5.23e−5 units/s` 미만입니다.

추가 검증은 다음과 같습니다.

- owner mask/session 10개 + 기존 이름/session 12개, 지도 비동기 DOM 회귀 7개 통과.
- 기존 한 시간 공전 30/60/144fps 회귀 16개, background/pause/visibility CPU 17개 및 실제 WebGL 5개 통과.
- 320/390/768/1440 UI 검사 통과. 전체 프로젝트 typecheck 및 production build exit 0.
- 승인 원본 46개 checksum, 아틀라스 PNG/raw 일치 검사 통과. 실제 Three GLTFLoader로 원본 GLB와 sync가 생성한 runtime GLB를 CPU 파싱해 8개 mesh의 유한 정점·UV·world transforms를 확인했습니다. 둘 모두 기준의 추적 원본과 4,293,332바이트가 같습니다. runtime body는 sync가 만드는 ignored 파일이며 원본이 추적 파일입니다. [GLB 결과](qa/galaxy-entry-appearance/approved-glb-cpu.json).
- 기존 4개 runtime 파일의 targeted lint는 **4 errors / 9 warnings → 4 errors / 9 warnings**입니다. 새 helper 2개와 QA 4개는 errors/warnings 0입니다. 기존 GPU fallback `set-state-in-effect`와 내부 링크 등 진단은 남아 있습니다. 전체 lint 통과로 표시하지 않습니다.

개인 pangaea 및 archipelago 화면의 before/after PNG는 각각 바이트 단위로 동일합니다. [해시 및 대조 결과](qa/galaxy-entry-appearance/visual-comparison.json). 아래 캡처는 합성 데이터의 실제 WebGL canvas입니다.

| 비교 | 수정 전 | 수정 후 |
| --- | --- | --- |
| 진입 2.8초 | [고정 착륙 위치](qa/galaxy-entry-appearance/before-entry-60fps-168.png) | [현재 공전 위치](qa/galaxy-entry-appearance/after-entry-60fps-168.png) |
| 진입 2.95초 | [순간 이동 후 화면](qa/galaxy-entry-appearance/before-entry-60fps-177.png) | [연속 공전](qa/galaxy-entry-appearance/after-entry-60fps-177.png) |
| 같은 owner, pangaea 은하 | [효과 누락](qa/galaxy-entry-appearance/before-galaxy-owner-pangaea.png) | [기존 효과 연결](qa/galaxy-entry-appearance/after-galaxy-owner-pangaea.png) |
| 같은 owner, archipelago | [개인](qa/galaxy-entry-appearance/after-personal-archipelago.png) | [은하](qa/galaxy-entry-appearance/after-galaxy-owner-archipelago.png) |

## 재실행과 범위

프로젝트 의존성 설치 후 `npm run build`와 `npx tsc --noEmit`를 실행합니다. CPU React harness는 `SAJU_QA_JSDOM_PATH`, 브라우저 harness는 `SAJU_QA_PLAYWRIGHT_PATH`/`SAJU_QA_CHROME`으로 설치된 도구 경로를 받을 수 있습니다. 이 환경에서는 `/usr/bin/chromium` 151.0.7922.173을 사용했습니다.

```sh
node scripts/qa/galaxy-entry-motion.mjs
node scripts/qa/galaxy-owner-effects.mjs
node --test scripts/qa/galaxy-owner-mask-session.mjs scripts/qa/map-name-session.mjs
node --import ./scripts/sites-env.mjs scripts/qa/galaxy-entry-appearance-browser.mjs
```

이 검증의 GPU는 SwiftShader이며 rAF/시간은 합성 제어입니다. 실제 Worker·일회성 합성 D1·WebGL shader/draw/readback을 사용하되 물리 기기 FPS나 OS 탭 정지 성능을 측정하지 않았습니다. pre-roll은 draw를 샘플링하며 진입 경계 2.7초부터는 매 프레임 native draw를 수행합니다. GLB CPU 검사는 이미지 디코딩을 Texture placeholder로 대체했고 정령/pet의 새 raster 검사를 주장하지 않습니다. 배포된 v29에 대한 직접 검증은 수행하지 못했습니다.

기존 planet 효과만 연결했습니다. 별도 정령 십간 재질 rebuild 브랜치를 가져오지 않았고, 전체 덩굴 몸체·새 모래·물보라·흐르는 이슬 구현이 끝났다는 주장은 하지 않습니다. 승인된 B형 몸체·팔·depth1.35·UV·pet 및 원본 shader/material/asset 파일은 이 변경에 포함되지 않습니다.

사용자 우선순위로 중단한 lint render profiling은 코드 변경 없이 별도 `qa/galaxy-effect-state-20261010`의 `da5c36c97b3b9b24f9eebddd0c4b9123c9f6274a`에 기록하고 원격 SHA/문서 바이트를 확인했습니다. [중단 시점 기록](https://github.com/ModernCrusader97/saju-project/blob/qa/galaxy-effect-state-20261010/docs/GALAXY_EFFECT_STATE_CHECKPOINT.md). main/기존 브랜치/`maint/guin-map-loading-20261009`에 쓰기, PR/병합/배포, 인증·권한 변경, Library 403 우회는 수행하지 않았습니다.
