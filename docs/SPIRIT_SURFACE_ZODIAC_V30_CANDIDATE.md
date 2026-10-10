# v30 정령 표면 좌표 수정 후보와 12지 원본 조사

기준은 실제 배포된 v30 소스 `a5535893645f35d4000ec773bff61caef19463cf`입니다.
`fix/spirit-surface-zodiac-v30-20261010`은 이를 바탕으로 만든 별도 후보입니다.
v30 보존은 `archive/sites-v30-galaxy-fixes-20261010`의
`56d5a1682a89ebe0727fefe67f58c028a03252cc`에서 완료했고, 원격 재조회로
415개 파일과 기존 24개 브랜치의 보존을 확인했습니다.

이번 작업은 보존된 코드로 만든 새 구현입니다. 확보되지 않은 `a97c418`과
동일한 복원이라고 주장하지 않습니다. 앞서 재구현·검증한
`de85ce2ed7f9c655f532d9a8a16be8855e6dd661`의 십간 연결과 표면 부착 경로를
현재 v30에 적용했습니다. 후보는 추가 배포하지 않았습니다.

## 병화의 늘어진 패턴 원인과 수정

v30의 정령 loader는 병화를 포함한 9개 천간에 구형 행성용
`createPlanetMaterial`을 적용했습니다. 이 재질은 vertex의 `position`을
단위 방향으로 정규화하고, fragment에서도 보간한 방향을 다시 정규화합니다.
구형이 아닌 B 몸체에서는 길이 방향 정보가 압축되고, 부위마다 좌표 밀도가
달라집니다. 실제 v30 GLB에서 머리·몸통의 긴 줄과 발 쪽 작은 무늬를 재현했습니다.
병화의 색 패턴은 이 3차원 방향을 사용하므로, 원래 UV를 재작성해 해결할 문제가
아니었습니다.

정령에는 기존 `createStemMaterial`의 `character-rest` 좌표를 연결합니다.
고정된 모델 깊이 1.35를 rest 좌표에 포함하고, 이후 화면 회전·배율은 제외합니다.
원래 POSITION/NORMAL/UV/index와 몸체·팔·눈·표정 morph의 중립 상태를 보존합니다.
기존 study shader, 색상·emission 수치, atlas, 행성 재질·은하 경로는 동일합니다.
멈춘 상태의 드래그와 resize도 현재 시간·카메라로 부착 효과를 갱신합니다.

실제 GLB 62,124개 비퇴화 삼각형 중심에서 좌표 Jacobian의 특이값을 면적으로
가중해 측정했습니다. 이는 **좌표 왜곡**의 측정이며, 모든 불꽃 무늬 방향이나
최종 픽셀 크기가 같다는 뜻은 아닙니다.

| 검증 | v30 | 후보 rest 좌표 |
| --- | ---: | ---: |
| 방향별 밀도 비율, 면적 기준 95백분위 | 17.0471 | 1.000003 |
| 작은 방향의 밀도, 1백분위 | 0.00915 | 0.999997 |
| 큰 방향의 밀도, 99백분위 | 5.7510 | 1.000003 |
| 기존 UV 경계 중복점의 rest 좌표 틈 | 해당 좌표 없음 | 2,143쌍 모두 0 |

초기 fire 캡처는 원본 v30의 delta API에 0을 전달해 재질 시간이 0초에 머물렀고,
후보의 absolute API는 2.25초였으므로 같은 시간 비교가 아니었습니다. 이 초기
캡처를 같은 시간의 시각 개선이나 승인 근거로 사용하지 않습니다. 좌표 Jacobian
측정과 `coordinates-*` 진단 격자의 좌표 압축 증거는 이 시간 오류와 독립입니다.
후속 QA를 원본 v30과 후보에서 다시 실행했습니다. 매 프레임 reset 후 1/60초 간격으로
135회를 갱신했고, 원본 `uLsTime`과 후보 `uStemTime`의 실제 GPU 업로드 값이 모두
2.25초임을 assert했습니다. 여섯 프레임의 카메라·조명·몸체 변환은 정확히 일치합니다.
아래 이미지는 보정한 결과이며 [시간·변환·이미지 SHA 비교](qa/spirit-surface-v30/timing-comparison.json)를
함께 보존합니다. fire 화면은 각 버전의 전체 runtime 재질·효과를 비교하므로 좌표 변경만의
영향을 분리하거나 외형 승인을 뜻하지 않습니다. `coordinates-*`는 명시적인 진단 격자이며
제품 화면이 아닙니다. 이 harness는 그림자를 끄고, 그림자는 아래 별도 QA로 검증했습니다.

| 화면 | 수정 전 | 후보 |
| --- | --- | --- |
| 실제 병화 | [정면](qa/spirit-surface-v30/before/fire-front.png) | [정면](qa/spirit-surface-v30/after/fire-front.png) |
| 좌표 진단 | [정면](qa/spirit-surface-v30/before/coordinates-front.png) | [정면](qa/spirit-surface-v30/after/coordinates-front.png) |
| 실제 병화 측면 | [측면](qa/spirit-surface-v30/before/fire-side.png) | [측면](qa/spirit-surface-v30/after/fire-side.png) |

## 불꽃 카드의 사각 그림자 수정

후보 loader는 효과를 추가한 뒤 모든 mesh에 `castShadow=true`를 지정했습니다.
丙·丁의 투명 billboard `InstancedMesh`에는 alpha를 반영하는 `customDepthMaterial`이
없어 보이지 않는 카드 면도 바닥 그림자에 포함됐습니다. 이 두 천간의 instanced
불꽃 카드만 casting에서 제외하고, 원래 B mesh 8개와 다른 효과의 caster flags는 보존했습니다.

`ee6e974` 후보를 수정 전 negative control로 사용했습니다. 실제 Canvas 조명과
`ShadowMaterial` 바닥·그림자를 켠 상태에서 두 천간 × high/low × 세 방향, 총 12개
조건을 reset 후 2.25초에 비교했습니다. 카드 casting만 끄는 참조와 수정 전의 픽셀
차이는 합계 800개였고, 수정 후 12개 조건 모두 0개입니다. 몸체 casting만 끈 참조와는
조건별 5,845–7,129개 픽셀이 달라 실제 몸체 그림자가 유지됨을 확인했습니다.
다른 여덟 천간 × 두 품질의 caster 목록 16개도 수정 전후 정확히 일치합니다.

실제 `ElementalSpiritCanvas`를 모바일 크기·StrictMode·reduced motion으로 실행해
丙·丁의 ready, 정지 화면 안정성, 같은 시간의 drag 회전, 정확한 reset, play/pause,
unmount를 검증했습니다. 이 standalone QA 페이지는 사이트 CSS를 가져오지 않습니다.
Three r186.1은 Canvas가 요청한 `PCFSoftShadowMap`을 render 시 `PCFShadowMap`으로
변환하므로 실제 관측 type은 1이며, Canvas 설정은 변경하지 않았습니다.
[그림자 검증과 캡처](qa/spirit-fire-shadow/README.md),
[조건별 비교](qa/spirit-fire-shadow/comparison.json)에 근거와 한계를 기록했습니다.

## 연결한 십간과 효과 범위

| 천간 | 몸체 재질 | 검증된 표면 효과 |
| --- | --- | --- |
| 甲 | 나무껍질 | 실제 삼각형에 뿌리내린 가지·가지 끝 잎 |
| 乙 | 덩굴 | 짧은 동일 mesh 표면 덩굴과 잎 |
| 丙 | 불꽃 | 실제 삼각형에서 방출되는 기존 불꽃 |
| 丁 | 숯·잔불 | 실제 삼각형에서 방출되는 기존 잔불 |
| 戊 | 사암 | 몸체 재질만 적용 |
| 己 | 승인된 옥·움직이는 초록빛 | 기존 RGB-triplet atlas adapter |
| 庚 | 브러시드 티타늄 | 몸체 재질만 적용 |
| 辛 | 액체 은빛 | 몸체 재질만 적용 |
| 壬 | 흐르는 물 | 몸체 재질만 적용 |
| 癸 | 이슬 | 삼각형에 고정되어 응결·증발하는 이슬 |

전체 몸체의 완전한 덩굴 구성, 戊 모래 입자, 壬 물보라·foam,
삼각형을 넘어 흐르는 癸 이슬은 완료 범위에 포함하지 않습니다.
부착 효과는 정적 topology와 중립 morph를 전제로 합니다.

## 12지 제작 모델이 보이지 않았던 이유와 남은 원본

기존 `createZodiacPet`은 모든 동물을 primitive로 만들며 authored GLB를
요청하지 않았습니다. 현재 보이는 노란 호랑이는 그 임시 모델입니다.
보존 브랜치 `archive/saju-local-authoring-20261009`의 실제 원격
`956fe6e2a7f3de3a0aabe3c59d9d5db3795c7123`을 조사했습니다.
906개 indexed 파일의 SHA/크기, 15개 ZIP CRC, 중첩 ZIP과 54개 GLB의 식별 정보를
검증했지만 12지 동물 원본은 **0개**였습니다. 몸체·팔·표정·재질 study만 있었습니다.

새 `loadZodiacPet` 경계는 manifest로 버전·SHA를 검증하고 독립적으로 GLB를
파싱할 수 있습니다. 현재 manifest는 모든 12지를 `missing-source`로 기록합니다.
따라서 이번 후보에서도 기존 임시 외형을 유지합니다. 제작 모델 적용 완료로
표시하지 않으며, 존재하지 않는 모델 파일이나 최신 승인 버전을 만들지 않았습니다.

누락이 확인된 선택 원본은 용 C
`2745a970701c86a3bc74eb0008b597607022a5c7ee576d79b287970ac977d366`과 돼지 다리 후보
`d1c6f8625b5fb97cdbde102455cdbf181f335942b7cb0f87aeb07a7fc0fba290`입니다.
다른 열 동물의 최신 버전·승인 증거도 확보하지 못했습니다.
[원본 목록과 조사 방법](qa/zodiac-pet-assets/README.md)에 자세한 증거가 있습니다.
펫 loader의 available 경로 테스트는 명시적인 합성 GLB를 사용하며, 분실된 동물의
외형 검증을 의미하지 않습니다. Library 403 파일은 다운로드하거나 우회하지 않았습니다.

## 검증 결과와 재현

| 검증 | 결과 |
| --- | --- |
| 실제 B GLB 기반 십간·깊이·변환 부착·cleanup CPU | 25개 통과 |
| 펫 provenance·checksum·독립 소유·취소 CPU | 8개 통과 |
| 원본/생성 GLB CPU 해독 | 8 mesh씩, 4,293,332 byte씩 동일 |
| 동일 병화 harness의 정면·사선·측면 | 수정 전/후 각각 6장, 실제 GPU 시간 2.25초·동일 변환, shader 오류 0 |
| 실제 그림자 negative control / 수정 후 | 각각 12조건, 카드 그림자 차이 800 → 0 pixel, B caster 8개·nonfire 16조건 보존 |
| 후속 실제 React Canvas 불꽃 그림자 | 丙·丁 ready/pause/drag/reset/play/unmount 통과 |
| 실제 십간 GLB/PNG WebGL | 수정 전/후 각각 23 render 통과 |
| 실제 React Canvas 모바일·StrictMode | 일곱 재질군 로드, pause/drag/reset/play, context 복구·unmount 통과 |
| WebGL buffer lifecycle | 20회, 생성된 소유 buffer 2,232개 모두 명시적 해제 |
| v30 은하 입장·개인/은하 효과 | 23개/13개 통과 |
| 기존 소유자 mask·연결 샘플링·visibility·modal | 통과 |
| TypeScript / production build | 통과 |
| 변경 파일 lint | 오류 0, 기존 img 경고 1 |
| 후속 loader·불꽃 QA 두 파일 lint | 오류·경고 0 |
| 전체 source lint | 기존 43오류/37경고 → 40오류/37경고, 전체 통과 아님 |

원본 407개 파일 중 402개는 byte 단위로 동일합니다. 변경은 정령 renderer/loader,
update interface, neutral-morph 표면 sampler, 펫 loader의 5개 파일입니다.
기존 `assets/`와 `public/`의 171개 tracked 자산을 모두 보존했습니다.
자원 해제는 effects와 pet을 먼저 해제한 뒤, geometry에 rest attributes가 붙은 채
GPU buffer를 해제하고 마지막으로 원래 attributes를 복구합니다.

```sh
node scripts/sync-approved-jade-assets.mjs
node scripts/qa/spirit-coordinate-density.mjs
node --test scripts/qa/ten-stem-materials.mjs scripts/qa/zodiac-pet-loader.mjs
node scripts/qa/approved-jade-glb-cpu.mjs
SAJU_QA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs node scripts/qa/spirit-fire-surface-browser.mjs
SAJU_QA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs node scripts/qa/spirit-fire-shadow-browser.mjs
SAJU_QA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs node scripts/qa/ten-stem-browser.mjs
SAJU_QA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs node scripts/qa/ten-stem-buffer-lifecycle.mjs
./node_modules/.bin/tsc --noEmit
npm run build
```

CPU 이미지 I/O는 소유권이 명확한 placeholder이고, GLB의 실제 geometry/UV/transforms는
Three GLTFLoader로 해독합니다. 시각 검증은 실제 GLB·PNG를 쓰는 로컬 Chromium
SwiftShader입니다. 물리 모바일 GPU와 배포된 사이트의 로그인 세션·실제 사용자 DB는
검증하지 않았습니다. 기존 hosted 접근은 DNS/프록시 제한으로 차단되어 우회하지 않았습니다.
DB/auth/payment/environment/access policy 변경, main 병합, PR 생성, 추가 배포는 수행하지
않았습니다. 키·`.env`·실제 DB 파일은 후보에 포함하지 않습니다.

[검증 요약](qa/spirit-surface-v30/verification-summary.json),
[좌표 측정](qa/spirit-surface-v30/coordinate-density.json),
[원본 보존](qa/spirit-surface-v30/source-preservation.json),
[전체 source lint](qa/spirit-surface-v30/source-lint-comparison.json)를 함께 보존합니다.
