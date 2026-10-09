# 은하 백그라운드 복귀 검증

원격 `fix/galaxy-form-ime-20261010`의 `db5179b1723b4b462868ce656968a9d2f355720c`를 기준으로 검사했다. 백그라운드에 머문 시간을 한꺼번에 진행하는 결함은 재현되지 않았다. 이번 독립 브랜치는 QA와 근거만 추가한다. 앱·애니메이션·입력·모델·재질의 실행 코드는 기준과 동일하다.

`GalaxyCanvas`는 `visibilitychange`에서 이전 시각을 다시 기록하고 숨겨진 프레임을 건너뛴다. `safeDelta`는 프레임 간격을 최대 50ms로 제한한다. 사용자의 정지 상태는 visibility 이벤트로 변경하지 않는다.

| 검사 | 결과 | 검증 범위 |
| --- | --- | --- |
| 실제 React/Three CPU 코드 + 합성 시계 | 17 통과, 0 실패 | 1초·5분·24시간 숨김, 숨겨진 rAF, 3배속, 사용자 정지, 착륙, 추적 카메라, 반복 복귀, resize, cleanup, Strict Mode |
| 실제 빌드 Worker/Chromium WebGL + 합성 시계 | 5 통과, 0 실패 | 복귀 첫 프레임 및 이후 GPU uniform·PNG 대조, 정지 상태 유지, reduced-motion, resize, 오류·외부 요청 없음 |
| 검증 민감도 | 3개 모두 검출 | 메모리에서만 복귀 시각 초기화 제거 시 8개 실패, 숨김 차단 제거 시 2개 실패, delta 제한 제거 시 1개 실패 |
| 기존 은하 브라우저 회귀 | 통과 | 지도 생성·복원, 선택, 관계 카드, 1440/768/390/320px 가시성 |
| 기존 지도 로딩·날짜 rollover DOM 회귀 | 15 통과, 0 실패 | 늦은 응답 차단, 날짜 변경·복귀, 타이머·cleanup |
| TypeScript / production build | 통과 / 통과 | `tsc --noEmit --incremental false`, `npm run build` |
| 새 QA lint | 오류·경고 0 | 추가한 QA 스크립트 3개 |
| 기존 은하 컴포넌트·시간 함수 lint | 기존 오류 6, 경고 4 | 기준 소스와 바이트·진단이 동일함을 대조. 전체 lint 통과를 주장하지 않음 |

복귀 검사는 같은 초기 상태와 같은 가시 프레임 수를 가진 대조군을 사용한다. 숨김 공백 동안에는 장면과 draw count가 변하지 않는다. 복귀 첫 16ms 프레임 및 이어지는 5개 프레임의 행성·관계선·펄스·카메라가 대조군과 일치한다. 실제 WebGL의 uniform과 PNG 해시도 일치한다. CPU 검사에서는 호스트 시계·visibility·WebGL 환경·Canvas2D 그리기만 경계 대역으로 교체하고 실제 React 컴포넌트, Three 객체, 노드 생성, 재질 시간, 자원 해제를 실행한다. 브라우저 검사는 실제 빌드, 실제 shader, Chromium 151.0.7922.173의 SwiftShader와 폐기되는 합성 D1을 사용한다.

현재 기준에는 별도 공유 `Vector3` 문제가 남아 있다. 관계선 생성 시 `node.worldPos`를 `QuadraticBezierCurve3`의 끝점으로 그대로 넘기므로 관계선 갱신이 기준 좌표를 바꾼다. CPU 진단에서는 정상 전경 프레임에서도 친구 기준 좌표가 약 0.022464 이동하고, 정지 후에도 친구 위치가 프레임마다 달라졌다. 이는 숨김 시간 누적과 별개이다. 따라서 정지 검사의 통과는 **정지 상태와 시뮬레이션 시간이 복귀로 바뀌지 않고 정상 전경의 같은 프레임과 일치한다**는 뜻이다. 모든 친구 궤도가 완전히 정지한다는 뜻은 아니다. 앞서 수정됐다는 별도 커밋은 이번 기준에서 확인되지 않아 해당 문제를 중복 수정하지 않았다.

네이티브 탭 검증에는 한계가 있다. 이 환경의 headless 및 headed Ozone offscreen Chromium에서 다른 탭 활성화와 창 최소화를 시도해도 원래 문서는 계속 `visible`로 보고했다. 네이티브 `hidden` 전환을 검증했다고 주장하지 않는다. 긴 시계 공백과 visibility 이벤트는 합성 입력이며, 실제 OS의 모바일 앱 전환·탭 절전·물리 GPU 검증은 미실행이다. [네이티브 관측](qa/galaxy-background/native-visibility-results.json), [CPU 결과](qa/galaxy-background/clock-results.json), [WebGL 결과](qa/galaxy-background/browser-results.json), [검증 민감도](qa/galaxy-background/negative-control-results.json), [회귀 결과](qa/galaxy-background/galaxy-regression-results.json), [검사 요약](qa/galaxy-background/validation-summary.json)에 근거를 보존했다. [복귀 렌더](qa/galaxy-background/playing-resumed.png)는 합성 인물만 포함한다.

재실행은 checkout 루트에서 한다. jsdom과 Playwright는 저장소 의존성에 추가하지 않았으므로 별도 임시 도구 설치의 절대 경로를 지정한다.

```bash
SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js \
  node scripts/qa/galaxy-background-clock.mjs
SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js \
  node scripts/qa/galaxy-background-negative-controls.mjs
npm run build
SAJU_QA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs \
SAJU_QA_CHROME=/path/to/chromium \
  node --import ./scripts/sites-env.mjs scripts/qa/galaxy-background-browser.mjs
SAJU_QA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs \
SAJU_QA_BROWSER=/path/to/chromium \
SAJU_QA_SECTION='galaxy form keeps same birth' \
  node --import ./scripts/sites-env.mjs scripts/qa/universe-browser.mjs
SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js \
  node --test --test-reporter=tap scripts/qa/guin-map-loading-dom.mjs scripts/qa/daily-rollover-dom.mjs
npx tsc --noEmit --incremental false
npx eslint scripts/qa/galaxy-background-clock.mjs scripts/qa/galaxy-background-browser.mjs scripts/qa/galaxy-background-negative-controls.mjs
```

main 병합·PR·배포·인증·권한 변경은 하지 않는다. 실제 사용자 DB·비밀키·`.env`를 포함하지 않는다.
