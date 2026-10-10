# 은하 WebGL 오류 상태 구독 정리

원격 `maint/galaxy-callback-declarations-20261010`의 `8ba3b9763bcaa88a8a3f2e108fa331a49800090f`에서 별도 `maint/galaxy-graphics-error-store-20261010` 브랜치를 만들었다. 마지막 `GalaxyCanvas` lint 오류인 WebGL 생성 실패의 `react-hooks/set-state-in-effect` 한 건을 정리했다. 기존 fallback이 동작하지 않았다고 주장하지 않는다. 수정 전에도 아래 실제 React 동작 검사는 통과했다.

렌더러의 초기화·shader·context 오류를 **인스턴스별 외부 저장소**에 기록하고, React는 `useSyncExternalStore`의 snapshot·subscribe·unsubscribe로 화면 상태를 읽는다. store는 순수한 `useState` lazy initializer로 한 컴포넌트 수명 동안 유지한다. immutable snapshot은 `string | null`이고 동일한 값에는 알림을 보내지 않는다. 서버/초기 hydration snapshot은 기존 초기 상태와 같은 `null`이다. 이 선택은 [React의 외부 시스템 구독 API](https://react.dev/reference/react/useSyncExternalStore)에 따른다. 렌더 비용 개선을 주장하지 않는다.

기존 오류 문구·생산 시점·복구·capture의 오류 차단을 유지했다. scene effect의 의존성만 `[]`에서 안정적인 `[graphicsErrors]`로 바뀐다. 다른 상태·effect·콜백·카메라·천체 구성·애니메이션·cleanup은 그대로다. 임의 지연, 규칙 해제, suppression은 추가하지 않았다. 새 store는 20줄이며 제품 변경은 이 파일과 `GalaxyCanvas.tsx` 두 파일뿐이다.

## 최종 검사

| 검사 | 수정 전 | 수정 후 |
| --- | --- | --- |
| 새 CPU/구독/소스 보존 검사 | 11 통과·2 예상 실패 | 13 통과·0 실패 |
| 실제 React/Three 관측값 | 25개 | 같은 25개, 모두 동일 |
| 실제 빌드 Worker / Chromium WebGL | 8 통과·0 실패 | 8 통과·0 실패 |
| 브라우저 관측값 | 9개 | 같은 9개, 모두 동일 |
| 기존 animation/visibility/tracking/landing/cleanup CPU | 기존 검증 기록 | 17 통과·0 실패, anchor 변위 0 |
| 기존 지도 로딩·날짜 DOM | 기존 검증 기록 | 15 통과·0 실패 |
| 타입 / production build | 타입 미실행 / 기준 build exit 0 | exit 0 / exit 0 |
| 대상 lint | 오류 1·경고 4 | 오류 0·경고 4, exit 0 |

수정 전 새 검사에서 실패한 두 항목은 목표 lint 오류와 새 외부 store의 미구현이다. 기능 실패로 분류하지 않는다. 수정 후 실제 React 검사에는 WebGL 생성·반사광 준비·shader 실패, context loss와 복구 성공/실패/재시도, fallback 인물 선택과 슬롯 열기, 속도·추적·일시정지·가시성, Strict Mode, 해제 후 이전 callback의 새 인스턴스 격리, Strict Mode 첫 초기화 실패 후 두 번째 성공을 포함한다. store 자체의 알림·중복 값·unsubscribe·구독 전 변경·SSR snapshot도 실제 React와 함께 검사했다.

[CPU 전후 결과](before-results.json), [수정 후](after-results.json), [25개 동등성](runtime-equivalence.json), [브라우저 전](before-browser-results.json), [후](after-browser-results.json), [9개 동등성](browser-equivalence.json), [clock 회귀](clock-results.json), [lint 진단](lint-comparison.json), [검증 요약](validation-summary.json)을 보존했다. 건강한 화면·복구 화면·fallback 슬롯의 PNG도 실제 실행 산출물이다. 건강한 foreground/background 비교의 픽셀과 GPU uniform 해시도 전후 동일하다.

정확한 lint 범위는 `components/planet/GalaxyCanvas.tsx`, 새 `lib/planet/graphics-error-store.ts`, 새 QA 두 파일이다. 새 파일은 오류·경고 0이다. 남은 기존 경고는 `prevMouse` 미사용, cleanup의 `toastTimersRef.current`, scene의 `onSelectPerson` 의존성, 천체 구성의 `selectedPersonId`/`startTrackingPlanet` 의존성 네 건이다. 메시지는 전후 같고 lint 설정도 그대로다. 전역 lint 전체 통과를 주장하지 않는다.

## 제품 실패와 QA 보정의 구분

첫 브라우저 실행은 **4 통과·4 실패**였다. [원래 결과](initial-browser-results.json)를 삭제하지 않았다.

1. 390/1440px의 두 검사는 실제 API가 내 이름에 붙이는 `(나)`를 예상값에서 빠뜨렸다. 현재 제품 문자열 그대로 예상값을 고쳤다.
2. QA가 context를 잃은 뒤 `getExtension`을 다시 조회해 `null`을 받았다. loss 전에 얻은 `WEBGL_lose_context` 객체를 보관해 restore를 호출했다. [WebGL 규격](https://registry.khronos.org/webgl/specs/latest/1.0/#5.14.13)은 loss 중 기본 반환값과 해당 확장의 유지 동작을 정의한다. 제품 복구 코드는 바꾸지 않았다.
3. WebGL 사용 불가를 주입할 때 실제 Three의 console 문자열은 접두사가 두 번 나온다. 정확한 전체 문자열 두 건만 허용하고 다른 console 오류·page 오류·외부 요청은 검사한다. 정상 실행의 오류를 숨기지 않는다.

보정한 전후 브라우저 suite는 각각 8/8이었다. 별도 실행의 전체 해시 대조에서 [합성 입력 차이](initial-browser-cross-run-comparison.json)가 드러났다. 실제 API가 친구 UUID·예시 점수·관계 문구를 임의로 생성하고, 기존 Canvas가 인물 ID를 seed로 사용한다. 따라서 API 실행 뒤 **폐기되는 합성 D1 한 건의 fixture만** 고정했다. 기존 API/auth/schema 및 실제 사용자 DB는 바꾸지 않았다. fixture를 실제 GET 응답으로 다시 확인한다.

입력을 맞춘 뒤 픽셀·GPU 상태가 일치했지만 [1440px resize 측정 한 건](resize-race-browser-comparison.json)은 100ms 고정 대기 동안 handler가 아직 처리하지 않아 이전 canvas 크기를 읽었다. QA가 실제 container와 canvas의 크기가 같아질 때까지 timer polling으로 기다리도록 바꿨다. 테스트용 rAF를 추가하지 않고 기존 한 animation chain을 유지한다. 최종 전후 9개 관측값은 정확히 같다. 이들 보정은 새 QA에만 있고 기존 host/runner 및 제품은 변경하지 않았다.

## 보존과 범위

[파일 대조](preservation.json): 기준 tracked 파일 482개 중 481개가 바이트 동일하고 기존 변경 파일은 `GalaxyCanvas.tsx` 하나다. 새 검사에서 오류 구독 import·binding·생산 호출·안정적인 의존성을 되돌려 정규화한 Canvas 전체가 기준과 정확히 같은지도 검사한다. approved body SHA256은 `0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84` 그대로다. 모델·재질·manifest·원본·UV/depth·pet/planet·API·DB schema·의존성·lock·기존 lint 설정을 바꾸지 않았다.

일반 `test` npm 스크립트는 없어서 위 관련 Node/브라우저 검사를 직접 실행했다. 빌드의 기존 proxy 안내, chunk 크기, vinext route 분류 안내는 남아 있다. Chromium/SwiftShader와 실제 빌드 Worker, `d1Persist:false` 합성 DB를 사용했다. CPU의 GPU/환경광·Canvas2D·layout·clock은 host 경계 대역이다. 브라우저도 clock/rAF/가시성은 결정적 테스트 입력이며 native `WEBGL_lose_context`의 trusted event를 확인했다. 물리 모바일 GPU·실제 OS 절전·hosted 인증 세션은 검사하지 않았다.

작업 재개 때 활성 중복 runner는 없었다. 12지 미리보기 후 보존된 네 변경 파일만 이어서 처리했다. 리깅 시각 검토와 배포는 보류 상태이며 main 병합·PR·배포·인증·권한 변경, 거부된 Library 재요청은 없다. 비밀키·`.env`·실제 사용자 DB를 추가하지 않았다.

## 재실행

저장소 루트에서 설치된 도구 경로를 지정한다. 수정 전 checkout에서 새 CPU QA를 절대 경로로 실행하면 `SAJU_QA_PHASE=before`의 두 실패가 예상된다. 그 결과를 수정 후 `outputs/galaxy-graphics-errors/before-results.json`에 복사한 뒤 실행하면 25개 동등성도 검사한다.

```sh
SAJU_QA_PHASE=after SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js \
  node scripts/qa/galaxy-graphics-error-store.mjs
npx eslint components/planet/GalaxyCanvas.tsx lib/planet/graphics-error-store.ts \
  scripts/qa/galaxy-graphics-error-store.mjs scripts/qa/galaxy-graphics-error-browser.mjs
npx tsc --noEmit --incremental false
npm run build
SAJU_QA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs SAJU_QA_CHROME=/path/to/chromium \
  node --import ./scripts/sites-env.mjs scripts/qa/galaxy-graphics-error-browser.mjs
SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js node scripts/qa/galaxy-background-clock.mjs
SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js \
  node --test scripts/qa/guin-map-loading-dom.mjs scripts/qa/daily-rollover-dom.mjs
```

브라우저 QA는 각각의 `outputs/galaxy-graphics-errors/browser/browser-results.json`을 만든다. 두 checkout의 `observations`, `fixtureData`, `checks`를 비교한 결과가 `browser-equivalence.json`이다. 결과·로그·이미지 해시는 `SHA256SUMS`에 있다. 생성 fixture와 runtime DB 파일은 Git에 포함하지 않는다.
