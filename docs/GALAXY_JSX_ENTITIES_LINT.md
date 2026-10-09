# 은하 안내 문구의 JSX lint 최소 수정

`GalaxyCanvas.tsx`의 안내 문구에 들어 있는 원시 ASCII 작은따옴표 두 개를 `&#39;`로 바꿨다. `react/no-unescaped-entities` 오류 한 종류의 2건만 해결했다. 화면에는 기존과 같은 `'체험용 인연 행성 추가'`가 표시된다. 규칙 비활성화나 동작 변경은 없다.

기준은 검증된 원격 `fix/galaxy-orbit-anchor-20261010`의 `92b453514ee59c2b1231a4dfcdfea5b4a6ea0a33`이다. 시작 시 기존 작업 트리 15개의 브랜치·HEAD·미저장 변경을 확인했고 모두 깨끗했다. 원격 20개 브랜치 HEAD와 그 안의 `GalaxyCanvas` 변경 이력 3건에서 같은 원시 작은따옴표를 확인했다. 기존 해결을 중복 적용하지 않았다. 저장소의 추적된 `AGENTS.md` 및 `.agents/skills` 지침은 없었다. 작업 브랜치는 `maint/galaxy-jsx-entities-20261010`이다.

오류 6개·경고 4개는 모두 `components/planet/GalaxyCanvas.tsx`에 있다. 함께 검사한 `lib/planet/surface-math.ts`와 `lib/planet/galaxy-helper.ts`에는 진단이 없다. 다음 위치는 수정 전후 줄 번호가 같다.

| 종류 | 규칙 | 위치 | 원인과 이번 처리 |
| --- | --- | --- | --- |
| 오류 2개, 해결 | `react/no-unescaped-entities` | 1016:25, 1016:38 | JSX 안내 문구의 원시 작은따옴표. 같은 ASCII 문자로 디코딩되는 숫자 entity로 교체했다. |
| 오류 2개, 유지 | `react-hooks/immutability` | 195:5, 298:13 | Compiler가 뒤에서 선언되는 `updateCameraPosition` / `startTrackingPlanet`의 앞선 참조를 지적한다. 선언 순서와 closure 사용의 별도 검증이 필요하다. |
| 오류 1개, 유지 | `react-hooks/set-state-in-effect` | 206:7 | WebGL 생성 실패의 effect catch에서 `setGraphicsError`를 동기 호출한다. fallback 표시 시점을 이번 변경에서 다루지 않았다. |
| 오류 1개, 유지 | `react-hooks/preserve-manual-memoization` | 488:43 | Compiler가 `startTrackingPlanet`의 기존 `useCallback` 보존을 확인하지 못한다. memoization·참조 구조는 별도 검토 대상으로 남겼다. |
| 경고 1개, 유지 | `@typescript-eslint/no-unused-vars` | 139:9 | `useRef` 결과를 `prevMouse`에 할당한 뒤 사용하지 않는다. 이번 선택 오류 종류에 포함하지 않았다. |
| 경고 1개, 유지 | `react-hooks/exhaustive-deps` | 453:22 | effect cleanup이 변경 가능한 `toastTimersRef.current`를 직접 읽는다. |
| 경고 1개, 유지 | `react-hooks/exhaustive-deps` | 472:6 | scene effect 의존성에 `onSelectPerson`, `startTrackingPlanet`이 빠져 있다. |
| 경고 1개, 유지 | `react-hooks/exhaustive-deps` | 730:6 | 행성 구성 effect 의존성에 `selectedPersonId`, `startTrackingPlanet`이 빠져 있다. |

나머지 항목을 해결하려면 effect 재실행·scene 구독·fallback 갱신·콜백 참조의 영향을 따로 검증해야 한다. 이번 한 종류의 문구 수정에 섞지 않았다. 정확한 기존 메시지와 판단은 [분류 기록](qa/galaxy-jsx-entities/lint-classification.json)에 있다.

실행 코드 변경은 안내 문구 한 줄뿐이다. 기존 공전 기준점 복제, 각속도, camera, callback, hook, 모델·재질·UV는 그대로다. TypeScript 5.9.3에서 컴포넌트 전체를 ES2022 / ESNext / ReactJSX로 변환한 JavaScript가 수정 전후 **바이트 단위로 동일**하다. [동작 보존 근거](qa/galaxy-jsx-entities/behavior-equivalence.json)에 소스 및 변환 결과 SHA-256을 보존했다.

| 이번 실행 검증 | 결과 |
| --- | --- |
| 같은 3파일 범위의 정상 ESLint | 오류 6 → 4, 경고 4 → 4; 전후 exit 1 |
| 선택 규칙의 오류 | 2 → 0 |
| 나머지 진단 | 규칙·심각도·문구·줄·열 모두 동일 |
| 기존 실제 React/Three 시계 회귀 | 17 통과·0 실패, 기준점 변위 0 |
| 기존 지도 로딩·날짜 DOM 회귀 | 15 통과·0 실패 |
| 실제 빌드 Worker / WebGL 회귀 | 5 통과·0 실패, 브라우저 오류·외부 요청 없음 |
| 기존 은하 화면 회귀 | 1 통과·0 실패, 1440/768/390/320px |
| 타입 / production build | exit 0 / exit 0 |

전체 lint 통과를 주장하지 않는다. 빌드에는 기존 chunk 크기와 vinext route 분류 안내가 있다. 일반 `test` 스크립트가 없어 관련 기존 Node·브라우저 검사를 직접 실행했다. 새로운 검사 스크립트나 의존성은 추가하지 않았다. [lint 전후](qa/galaxy-jsx-entities/lint-comparison.json), [회귀 결과](qa/galaxy-jsx-entities/regression-results.json), [검증 요약](qa/galaxy-jsx-entities/validation-summary.json), [원격 소스 대조](qa/galaxy-jsx-entities/remote-source-audit.json)를 함께 보존했다.

checkout 루트에서 다음 명령으로 다시 확인할 수 있다. ESLint의 남은 오류 4개는 예상된 기존 진단이다. 도구 경로는 설치된 jsdom·Playwright·Chromium 위치로 지정한다.

```bash
npx eslint components/planet/GalaxyCanvas.tsx lib/planet/surface-math.ts lib/planet/galaxy-helper.ts
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

브라우저 검사는 Chromium/SwiftShader와 합성 인물·폐기되는 로컬 D1을 사용한다. 물리 GPU·모바일 OS 절전·hosted 로그인 검사는 하지 않았다. 앞선 공전의 합성 1시간 검사를 이번 문구 수정에서 반복하지 않았다. main·기존 브랜치·PR·배포·인증·결제·권한·강제 Git 작업은 변경 범위에 없으며, 비밀키·`.env`·실제 사용자 DB를 포함하지 않는다.
