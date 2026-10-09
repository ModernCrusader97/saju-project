# v29 공전 기준점 수정 원리 재적용

사용자가 이전 배포 v29에서 해결했다고 확인한 공유 `Vector3` 문제를 현재 복원 계보에 재적용했다. 새 발견이나 v29 원본 소스의 동일 복원으로 주장하지 않는다. 기준은 원격 `fix/galaxy-background-resume-20261010`의 `b4459dd9fb74af57f3cfeed9bfb630393096f448`, 작업 브랜치는 `fix/galaxy-orbit-anchor-20261010`이다.

먼저 비공개 원격 19개 브랜치 HEAD, 그 브랜치들이 포함하는 `GalaxyCanvas` 변경 이력, local-authoring 및 cloud-environment 보존 ZIP의 중첩 소스·패치를 대조했다. 은하 소스는 두 버전만 확인됐으며 모두 `QuadraticBezierCurve3(ownerPos, mid, friendPos)`와 끝점의 `.copy()` 갱신을 사용한다. 재사용 가능한 기준점 분리 수정은 확인되지 않았다. [대조 기록](qa/galaxy-orbit-anchor/remote-source-audit.json)에 SHA와 코드 발췌를 보존했다. Library 파일·호스팅 소스·새 인증은 사용하지 않았다.

커브 끝점은 프레임마다 바뀌지만 `node.worldPos`는 원래 공전 기준으로 유지돼야 한다. 두 객체가 같은 벡터를 참조하면 인연선 갱신이 원래 기준 좌표를 덮어쓴다. 다음 프레임은 이미 회전한 기준에 절대 시뮬레이션 각도를 다시 적용해 속도와 경로를 누적한다. 정지 상태에서도 같은 각도가 반복 적용됐다. 숨김 시간 누적과 별개의 전경 문제다.

실행 코드 변경은 `GalaxyCanvas`의 커브 생성 한 곳이다. 양 끝점만 복제해 커브가 원래 기준점을 덮어쓰지 못하게 했다.

```ts
new THREE.QuadraticBezierCurve3(ownerPos.clone(), mid, friendPos.clone())
```

기존 각속도 `0.052 / sqrt(max(1, radius / 6))` rad/s와 speedScale, 자전·위성·소행성대·펄스·카메라 계수, visibility/delta, 정지·resize·cleanup, 모델·재질·UV·B형 외형을 변경하지 않았다.

| 검증 | 수정 전 | 수정 후 |
| --- | --- | --- |
| 실제 React/Three CPU, 각 FPS로 1시간 | 3 통과·13 실패 | 16 통과·0 실패 |
| 실제 빌드·WebGL native uniform readback, 각 FPS로 1시간 | 4 통과·8 실패 | 12 통과·0 실패 |
| 기존 복귀 CPU / 실제 WebGL 회귀 | 앞선 b4459dd 기록 보존 | 17 통과 / 5 통과 |
| 기존 지도 로딩·날짜 rollover DOM 회귀 | 관련 기존 검사 | 15 통과·0 실패 |
| 기존 은하 브라우저 회귀 | 관련 기존 검사 | 통과, 1440/768/390/320px |
| 타입 / 수정 후 production build | 수정 전 build 통과 | 통과 / 통과 |
| 새 QA lint | 통과 | 통과, 오류·경고 0 |
| 관련 기존 lint | 오류 6·경고 4 | 같은 규칙·심각도·문구. 전체 lint 통과를 주장하지 않음 |

CPU와 WebGL 각각 30/60/144fps에서 108,000/216,000/518,400 프레임을 진행했다. CPU는 실제 애니메이션 클로저·노드 생성·Three 객체·재질 시간·자원 해제를 실행한다. 시계·rAF·Canvas2D·GPU 환경만 경계 대역이다. 원래 기준 벡터를 회전시킨 독립 분석 경로와 매초 비교하고, 각 프레임의 각도 변화와 누적 이동을 검사했다. 가까운/바깥 친구를 함께 넣어 반경에 따른 속도도 확인했다.

수정 후 CPU 기준점 변위는 정확히 0이며 최대 경로 오차는 약 `1.02e-8`, 반경 오차는 약 `3.56e-15`다. 사용자 정지 시 친구 위치가 고정되고, 초기화는 원래 좌표로 돌아오며, 착륙 중에도 기준점이 변하지 않는다. 수정 전 정상 공전은 반경 자체가 확대되지는 않았지만 경로·속도·FPS 간 결과가 틀렸다. 착륙 중에는 기준점이 최대 약 28.035 이동했다. 반경 확대와 각도 누적을 혼동하지 않는다.

WebGL 검사는 실제 빌드의 애니메이션과 renderer를 매 프레임 실행하고 **모든 uniform 전송을 native로 유지**한다. 긴 검사에서 중간 native draw/clear만 생략하고 매 합성 60초마다 실제 shader를 렌더한다. `gl.getUniform()`으로 읽은 실제 `modelMatrix`의 행성 중심과 경로를 비교하고 `gl.finish()` 후 PNG를 보존했다. 수정 후 최대 중심 경로 오차는 모든 FPS에서 약 `2.52e-7`이고 최종 중심 좌표가 일치한다. GPU 관측 허용 오차는 `2e-5`다. [60fps 수정 전](qa/galaxy-orbit-anchor/before-gpu-60fps.png), [수정 후](qa/galaxy-orbit-anchor/after-gpu-60fps.png)는 합성 인물만 포함한다.

전후 CPU·GPU·호스트 harness SHA-256은 동일하다. 앱 소스 SHA-256과 실제 빌드 fingerprint는 전후 다르며 결과 JSON에 기록했다. 수정 전 실패는 장치나 실행 오류가 아닌 기준점·분석 경로·속도·정지·초기화·착륙 불변식 실패다. [CPU 전](qa/galaxy-orbit-anchor/before-cpu-results.json), [CPU 후](qa/galaxy-orbit-anchor/after-cpu-results.json), [GPU 전](qa/galaxy-orbit-anchor/before-gpu-results.json), [GPU 후](qa/galaxy-orbit-anchor/after-gpu-results.json), [검사 요약](qa/galaxy-orbit-anchor/validation-summary.json)에 전체 근거가 있다.

물리 GPU에서 실제 30/60/144fps를 달성했거나 한 시간 전체 shader 영상을 그렸다는 주장은 하지 않는다. Chromium 151.0.7922.173·SwiftShader·합성 시계·폐기되는 로컬 D1 검사다. OS 탭 절전·물리 모바일 장치·hosted 로그인은 미실행이며, 이번 작업은 네이티브 숨김 복귀 수정이 아니다. v29 원본 패치의 바이트 동등성은 미확인이다.

checkout 루트에서 재실행한다. 별도 임시 설치의 jsdom/Playwright 경로를 지정하며 저장소 의존성은 추가하지 않는다. 기본 전체 `test` 스크립트가 없어 관련 Node·브라우저 검사를 직접 실행했다.

```bash
SAJU_QA_PHASE=after SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js \
  node scripts/qa/galaxy-orbit-anchor.mjs
npm run build
SAJU_QA_PHASE=after SAJU_QA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs \
SAJU_QA_CHROME=/path/to/chromium \
  node --import ./scripts/sites-env.mjs scripts/qa/galaxy-orbit-anchor-browser.mjs
SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js \
  node scripts/qa/galaxy-background-clock.mjs
SAJU_QA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs SAJU_QA_CHROME=/path/to/chromium \
  node --import ./scripts/sites-env.mjs scripts/qa/galaxy-background-browser.mjs
SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js \
  node --test --test-reporter=tap scripts/qa/guin-map-loading-dom.mjs scripts/qa/daily-rollover-dom.mjs
SAJU_QA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs SAJU_QA_BROWSER=/path/to/chromium \
SAJU_QA_SECTION='galaxy form keeps same birth' \
  node --import ./scripts/sites-env.mjs scripts/qa/universe-browser.mjs
npx tsc --noEmit --incremental false
npx eslint scripts/qa/galaxy-orbit-anchor.mjs scripts/qa/galaxy-scene-host.mjs scripts/qa/galaxy-orbit-anchor-browser.mjs
```

수정 전 원본을 재현하려면 QA 스크립트 3개를 독립된 기준 checkout에 놓고 `SAJU_QA_PHASE=before`로 실행한다. 이번 전후 기록은 같은 harness를 실제 수정 전·후 코드에서 실행한 측정값이다.

main·기존 브랜치·PR·배포·인증·권한은 변경하지 않는다. 비밀키·`.env`·실제 사용자 DB는 포함하지 않는다.
