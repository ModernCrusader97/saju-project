# 은하 카메라·추적 함수의 선언 전 참조 정리

`GalaxyCanvas.tsx`의 선언 전 참조 오류 2건을 한 묶음으로 정리했다. 카메라·행성 추적의 함수 본문을 그대로 두고 함수 선언을 사용했다. 안정적인 `startTrackingPlanet` 콜백은 기존 hook 위치의 `useCallback(trackPlanet, [])`로 유지했다. 앞의 scene 클릭 처리만 hoisted `trackPlanet` 구현을 호출한다. 규칙 비활성화나 진단 억제는 없다.

기준은 원격 `maint/galaxy-jsx-entities-20261010`의 `5450f107182d9de0ef6d40281b8f018c45aea6f8`이다. 시작 시 기존 작업 트리 16개는 모두 미저장 변경이 없었다. 실제 원격 21개 브랜치 HEAD와 관련 소스 변경 이력 4건 모두 같은 선언 전 참조를 유지하고 있어 재사용할 기존 해결은 확인되지 않았다. 추적된 `AGENTS.md` 및 `.agents/skills` 지침은 없었다. 독립 작업 브랜치는 `maint/galaxy-callback-declarations-20261010`이다. [원격 소스 대조](qa/galaxy-callback-declarations/remote-source-audit.json)에 SHA를 보존했다.

원래 scene `useEffect` 안의 `updateCameraPosition()` 호출과 이후 pointer callback의 `startTrackingPlanet()` 호출이 뒤의 `const` 선언을 참조해 Compiler가 오류를 냈다. 실제 effect는 render가 끝나 ref·상태·콜백이 준비된 뒤 실행되므로 기존 코드가 런타임 초기화 실패를 일으킨다고 주장하지 않는다.

함수 선언은 먼저 참조할 수 있고 선언 시 ref를 읽지 않는다. `trackPlanet`은 기존과 같이 안정적인 ref와 상태 setter만 사용한다. scene effect가 보관하는 구현과 나중의 memoized alias는 같은 추적 로직을 실행한다. `useCallback`의 위치와 빈 의존성 배열, 다른 콜백의 의존 순서, effect 등록·실행 순서를 유지했다. 함수 선언 외의 컴포넌트 문장은 앞선 호출 이름 한 곳을 제외하면 같다.

TypeScript AST 대조에서 hook 38개의 호출 순서·이름·의존성 배열, 두 함수의 본문과 추적 인자, 나머지 컴포넌트 문장이 보존됨을 확인했다. [정적 동등성](qa/galaxy-callback-declarations/static-equivalence.json)에 결과가 있다. 이전 문구 수정과 달리 전체 변환 JavaScript의 바이트 동등성을 주장하지 않는다.

새 QA는 실제 React/Three와 실제 `Raycaster`를 사용한다. 초기 카메라의 독립 수식, 친구·내 행성 pointer 선택, 외부 선택 뒤 전체 조망·내 별·정지·속도 변경·초기화, Strict Mode, wheel·pointer 회전을 검사했다. 초기화는 기존 `currentLookAt`의 부드러운 이동을 유지하므로 즉시 방향과 전체 포즈의 전후 동등성을 확인했다. 전후 같은 harness·같은 기존 host에서 15개 관측 포즈·UI 상태가 정확히 같다. GPU·Canvas2D·layout·pointer capture·시계만 host 경계 대역이며 production에는 검사 hook을 넣지 않았다.

| 이번 실행 검사 | 수정 전 | 수정 후 |
| --- | --- | --- |
| 새 선언·정적·실제 CPU 동작 검사 | 6 통과·1 실패; 실패는 선언 전 참조 2건 | 7 통과·0 실패 |
| 그중 실제 동작 5개 시나리오 | 모두 통과 | 모두 통과, 관측값 15개 동일 |
| 기존 시계·가시성·추적·landing·cleanup CPU 회귀 | 이전 검증 기록 보존 | 17 통과·0 실패, 기준점 변위 0 |
| 기존 지도 로딩·날짜 DOM 회귀 | 이전 검증 기록 보존 | 15 통과·0 실패 |
| 실제 빌드 Worker / WebGL 회귀 | 이전 검증 기록 보존 | 5 통과·0 실패, 오류·외부 요청 없음 |
| 기존 은하 화면 회귀 | 이전 검증 기록 보존 | 1 통과·0 실패, 1440/768/390/320px |
| 타입 / production build | 이전 기준 검증 | exit 0 / exit 0 |

정확한 lint 범위는 다음 4개 파일이다. 새 QA는 전후 진단이 없으며 기존 host는 변경하지 않았다.

```text
components/planet/GalaxyCanvas.tsx
lib/planet/surface-math.ts
lib/planet/galaxy-helper.ts
scripts/qa/galaxy-callback-declarations.mjs
```

수정 전 같은 4파일에 대한 새 QA의 ESLint API 결과는 오류 4·경고 4였다. 처음 보존한 raw baseline 진단은 기존 3파일이며, 새 파일의 진단은 0이다. 수정 후 위 4파일의 정상 ESLint CLI 결과는 **오류 1·경고 4, exit 1**이다. 목표 선언 전 참조 2개와 같은 정리에서 사라진 `preserve-manual-memoization` 진단 1개를 합해 오류 3개가 줄었다. 추가 동작 수정으로 memoization을 제거한 것이 아니다.

남은 오류는 `GalaxyCanvas.tsx:206:7`의 WebGL 생성 실패 처리 `setGraphicsError`에 대한 `react-hooks/set-state-in-effect`다. 경고는 `prevMouse` 미사용(139:9), cleanup의 `toastTimersRef.current`(453:22), scene effect의 `onSelectPerson` 의존성(472:6), 행성 구성 effect의 `selectedPersonId`·`startTrackingPlanet` 의존성(732:6)이다. scene 경고에서는 `startTrackingPlanet`이 빠졌지만 실제 의존성 배열은 기존 `[]` 그대로다. 전체 lint 통과를 주장하지 않는다. [정확한 전후 진단](qa/galaxy-callback-declarations/lint-comparison.json)에 메시지와 위치가 있다.

[새 검사 전](qa/galaxy-callback-declarations/before-callbacks.json), [후](qa/galaxy-callback-declarations/after-callbacks.json), [실행 동등성](qa/galaxy-callback-declarations/runtime-equivalence.json), [회귀 결과](qa/galaxy-callback-declarations/regression-results.json), [검증 요약](qa/galaxy-callback-declarations/validation-summary.json)을 함께 보존했다. 새 의존성은 추가하지 않았다. 일반 `test` 스크립트가 없어 관련 Node·브라우저 검사를 직접 실행했다. 빌드의 기존 chunk 크기·vinext route 분류 안내는 남아 있다.

checkout 루트에서 재실행한다. 도구 경로는 설치된 jsdom·Playwright·Chromium 위치로 지정한다. 수정 전 재현에는 기준 checkout에 새 QA 파일을 복사하고 `SAJU_QA_PHASE=before`를 사용한다. 선언 진단 검사 실패가 예상된다.

```bash
SAJU_QA_PHASE=after SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js \
  node scripts/qa/galaxy-callback-declarations.mjs
npx eslint components/planet/GalaxyCanvas.tsx lib/planet/surface-math.ts lib/planet/galaxy-helper.ts scripts/qa/galaxy-callback-declarations.mjs
npx tsc --noEmit --incremental false
npm run build
SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js node scripts/qa/galaxy-background-clock.mjs
SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js \
  node --test --test-reporter=tap scripts/qa/guin-map-loading-dom.mjs scripts/qa/daily-rollover-dom.mjs
SAJU_QA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs SAJU_QA_CHROME=/path/to/chromium \
  node --import ./scripts/sites-env.mjs scripts/qa/galaxy-background-browser.mjs
SAJU_QA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs SAJU_QA_BROWSER=/path/to/chromium \
SAJU_QA_SECTION='galaxy form keeps same birth' \
  node --import ./scripts/sites-env.mjs scripts/qa/universe-browser.mjs
```

브라우저 검사는 Chromium/SwiftShader와 합성 인물·폐기되는 로컬 D1을 사용한다. 물리 GPU·모바일 OS 절전·hosted 로그인과 앞선 공전의 합성 1시간 검사는 이번 범위에서 실행하지 않았다. 궤도·카메라 계수, 재질·모델·UV, 초기화·가시성·cleanup 정책은 변경하지 않았다. main·기존 브랜치·PR·배포·인증·결제·권한·강제 Git 작업은 변경 범위에 없고 비밀키·`.env`·사용자 DB를 포함하지 않는다.
