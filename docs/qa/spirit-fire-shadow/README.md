# 불꽃 카드 그림자 회귀 검증

loader가 효과를 넣은 뒤 모든 mesh를 shadow caster로 지정하면서 丙·丁의 투명
billboard plane까지 기본 depth pass에 포함됐습니다. 두 효과는 `InstancedMesh`이고
alpha를 반영하는 `customDepthMaterial`이 없습니다. 수정은 두 천간의 instanced
불꽃 카드 casting만 제외합니다. 원래 B mesh 8개와 다른 천간·효과의 flags는 유지합니다.

수정 전 제어는 native v30이 아니라 `ee6e9740054394b0bee30563f35e957b49adf4bb`
후보의 loader입니다. native v30에는 이 불꽃 카드가 없습니다. 캡처 시점의 HEAD는
수정 전후 모두 이 후보 base이고, report의 `loaderSHA256`이 실제 실행한 소스를 구별합니다.
수정 전 SHA는 `714a0d668bb16ae31dd67e7d6103028e80e601547fe5b142062d481bd99eea6f`,
수정 후 SHA는 `d352f7d268ae0326bb25b0bb5bc060640b2c6156382fc4369fa68b8049e78b2c`입니다.
최종 수정의 assert는 원래 loader에서 실패했고 그 [실패 보고서](negative-control-assertion.json)를
보존했습니다. [비교 보고서](comparison.json)는 실제 두 실행의 입력과 결과를 다시 검증한 기록입니다.

독립 WebGL harness는 실제 GLB·PNG·불꽃 shader를 로드합니다. 양쪽에서 매 조건 reset 후
135회 × 1/60초로 실제 재질·효과 시간을 2.25초에 맞췄습니다. 丙·丁 × high/low ×
정면/사선/측면 총 12조건의 조명·카메라·모델 자세·그림자 바닥과 원래 B caster flags가
수정 전후 정확히 같습니다. 원본 깊이 1.35와 중립 morph도 보존합니다.

`shadowMap.enabled=true`, Canvas의 key light 위치 `[-3,4,4]`·강도 2.1·bias -0.0002,
1024 map, 12×12 `ShadowMaterial` 바닥의 opacity 0.09·높이 -0.016을 사용했습니다.
실제 Canvas의 low 품질 관측 map은 512입니다. 두 경로 모두 Canvas처럼
`PCFSoftShadowMap`(2)을 요청하지만, 설치된 Three r186.1의 renderer는 이를 첫 render에서
`PCFShadowMap`(1)으로 변환합니다. 실제 관측 값 1을 assert하며 Canvas 소스는 변경하지 않았습니다.

카드 casting만 끈 참조와 수정 전 runtime의 차이는 12조건 합계 800 pixels입니다.
수정 후에는 모든 조건이 0이고, 수정 전 참조의 픽셀 SHA와 수정 후 production SHA도
정확히 같습니다. 丁의 정면에서는 처음부터 차이가 0이지만 사선·측면에서 오류를 검출했습니다.
몸체 casting도 끄면 조건별 5,845–7,129 pixels가 달라져 실제 몸체 그림자가 남아 있음을
검증합니다. 다른 여덟 천간 × high/low의 caster 목록 16개도 정확히 일치합니다.

| 병화 화면 | 수정 전 | 수정 후 |
| --- | --- | --- |
| 실제 그림자 측면 | [캡처](before/병인-high-side.png) | [캡처](after/병인-high-side.png) |
| 실제 Canvas 정지 | [캡처](before/병인-canvas-paused.png) | [캡처](after/병인-canvas-paused.png) |
| 실제 Canvas 회전 | [캡처](before/병인-canvas-rotated.png) | [캡처](after/병인-canvas-rotated.png) |

Actual React QA는 production `ElementalSpiritCanvas`를 390×844·touch·reduced motion·
StrictMode로 실행합니다. Vite 관측 plugin이 생성된 renderer와 loader 결과를 기록하고
shader clock을 읽으며, 조명·casting·animation 설정을 바꾸지 않습니다. 丙·丁에서
ready, 정지 화면 200ms 안정성, 시간 유지 drag 회전, pixel 단위 정확한 reset,
play로 시간 진행 후 pause, unmount 뒤 render 중지와 canvas 제거를 확인했습니다.
이는 실제 컴포넌트 동작 검증이며 standalone 페이지는 사이트 CSS를 가져오지 않습니다.

현재 수정 후 재현:

```sh
SAJU_QA_PHASE=after \
SAJU_QA_PLAYWRIGHT_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs \
node scripts/qa/spirit-fire-shadow-browser.mjs
```

수정 전 제어는 별도 `ee6e974` checkout의 cwd에서 같은 현재 harness 경로를 실행해
재현할 수 있습니다. `SAJU_QA_PHASE=before`는 카드 casting이 true임을 기대합니다.
최종 수정 기대값의 실패 제어는 같은 checkout에서 phase를 after로 실행합니다.

[수정 전](before/report.json)과 [수정 후](after/report.json)의 shader/page 오류와
외부 요청은 0입니다. 모델 해제 후 geometry는 0이고 texture 4개는 살아 있는
renderer·studio environment·shadow map의 리소스입니다. production 캡처에는 정상
runtime flags를 사용하며, casting을 끄는 참조는 그림자 기여도를 측정하는 probe입니다.
PNG는 high 독립 render 6장과 low 실제 Canvas 4장을 각 phase에 보존했고, low 독립
render를 포함한 모든 12조건에는 픽셀 SHA와 assert 결과를 기록했습니다.

검증은 로컬 Chromium SwiftShader이며 물리 GPU나 hosted 로그인 검증이 아닙니다.
동시간 표면 캡처는 [별도 보정 보고서](../spirit-surface-v30/timing-comparison.json)에 있습니다.
그 표면 캡처는 native/candidate 전체 재질 경로를 비교하며 좌표 변경만을 분리하거나
외형 승인을 뜻하지 않습니다. 이번 후속 변경은 이후 이슬·덩굴·모래 구현을 검증하지 않습니다.
