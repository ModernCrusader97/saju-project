# 지도 폼의 조합 중 Enter 검사

기준은 실제 원격에서 확인한 `8b3f1cb0c1c77c06a2fd0084753222f6d518126b`다. 기존 작업 트리 12개의 clean 상태를 확인하고 독립 `fix/galaxy-form-ime-20261010` 브랜치를 만들었다. 이번 수정은 소유자와 주변인 폼 각각의 `onKeyDown`에 `Enter && nativeEvent.isComposing`일 때 `preventDefault()`를 호출하는 처리뿐이다.

실제 OS IME 검증 도구는 없다. 화면 서버와 `DISPLAY`·`WAYLAND_DISPLAY`, Xvfb, IBus, Fcitx가 없는 환경의 헤드리스 Chromium을 사용했다. `Input.imeSetComposition`으로 `ㅎ` → `한글` 조합을 만들고 Playwright의 Chromium 키 입력으로 Enter를 보냈다. 이 결과는 **합성 composition 이벤트 검사**이며 물리 한글 키보드나 OS IME의 재현으로 주장하지 않는다.

원본 두 폼에서 `compositionstart/update`와 `input.isComposing=true` 이후 `keydown.key=Enter`, `keyCode=13`, `isComposing=true`를 관찰했다. 그런데도 native `submit`과 실제 API POST가 각각 1회 발생했다. 소유자는 새 지도로 이동하고 주변인 폼은 저장 후 닫혀 입력이 사라졌다. 문제 재현 후에만 생산 코드를 수정했다.

검사는 원본과 수정본의 실제 빌드한 Worker·자산을 사용한다. D1은 마이그레이션 스키마로 만든 비영속 로컬 DB이며 신원·이름·날짜는 합성이다. 주변인 검사에 필요한 지도도 실제 소유자 폼의 일반 Enter로 만든다. API 응답은 실제 Worker 응답을 그대로 전달하며, 테스트가 `requestSubmit()`·`submit()`이나 DOM 키보드 `dispatchEvent()`로 제출을 만들지 않는다. 외부 통신은 차단하고 시도도 실패로 처리한다.

| 검사 | 원본 | 수정 후 |
| --- | --- | --- |
| 소유자·주변인 조합 중 Enter | 저장 요청 각각 1회, 입력 사라짐 | 요청 0회·입력과 초점 유지 |
| 조합 확정 후 일반 Enter | 실제 저장 각각 1회, 정확한 이름 유지 | 실제 저장 각각 1회·정확한 이름 유지 |
| 조합 취소 후 빈 이름 Enter | native required 검증, 저장 요청 0회 | 같은 검증·저장 요청 0회 |
| 조합 검사 전체 7개 | 조합 중 2개 실패, 나머지 통과 | 모두 통과 |
| 기존 키보드 52개 | 기준 작업에서 확인됨 | 모두 통과 |
| 기존 실제 폼 회귀 65개 | 기준 작업에서 확인됨 | 모두 통과 |
| 이름·세션·지도 로딩 회귀 47개 | 이번 작업에서 실행 | 모두 통과 |
| 타입 검사·생산 빌드 | 원본 빌드 성공 | 종료 코드 0 |
| 변경 페이지·새 검사 파일 ESLint | 오류 2개·경고 4개 | 기준과 동일, 새 검사 파일 메시지 0개 |

조합 확정은 CDP `Input.insertText`, 취소는 빈 문자열의 `Input.imeSetComposition`으로 수행한다. `compositionend`가 실제로 관찰되고 이후 Enter의 `isComposing=false`인지 검사한다. 취소 후에는 빈 이름의 `invalid` 이벤트와 `validity.valueMissing`를 확인한다. 이벤트 관찰자는 취소 상태를 모든 핸들러 실행 뒤 읽으며 이벤트 자체를 바꾸지 않는다. 기본 제출의 취소 여부뿐 아니라 실제 POST 횟수·화면 이동·입력 유지·확정 후 저장 이름을 대조한다.

이 환경에서 CDP 조합 시작·갱신 및 Chromium Enter는 `isTrusted=true`, 확정·취소의 `compositionend`는 `isTrusted=false`로 관찰됐다. `isTrusted` 값도 OS IME 검증의 증거로 해석하지 않는다. OS가 조합 확정에 쓰는 Enter의 전달 방식·후보 창·운영체제별 이벤트 차이, Safari·Firefox·실제 모바일 IME는 검증하지 않았다.

표준의 `isComposing` 의미와 조합 이벤트 순서는 [UI Events](https://w3c.github.io/uievents/#events-composition-key-events)를 참고했다. 검사에 사용한 합성 조합 명령은 [Chrome DevTools Protocol Input](https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-imeSetComposition), React의 원본 이벤트 접근은 [React 이벤트 문서](https://react.dev/reference/react-dom/components/common#react-event-object)에 정의돼 있다. 이 문서의 재현·저장 결과는 위 자료의 일반 설명이 아닌 실행 기록이다.

전후 이벤트와 요청 횟수는 [결과 JSON](qa/map-ime/results.json)에 보존한다. 원시 보고서·진단 probe·로그는 Git에서 제외되는 `outputs/map-ime/`에 있다. 실행 환경은 Node `24.19.0`, Playwright `1.62.1`, Chromium `151.0.7922.173`, JSDOM `26.1.0`이다.

일반 clone에서는 설치된 Chromium 경로에 맞춰 아래를 실행한다. 별도의 전체 `test` 스크립트가 없어 요청된 두 브라우저 회귀와 관련 Node 검사를 직접 실행한다. 추가 테스트 도구는 임시 디렉터리에 설치한다.

```bash
npm run install:ci
npm install --prefix /tmp/saju-ime-tools --no-save --package-lock=false playwright@1.62.1 jsdom@26.1.0
export SAJU_QA_PLAYWRIGHT_PATH=/tmp/saju-ime-tools/node_modules/playwright/index.mjs
export SAJU_QA_JSDOM_PATH=/tmp/saju-ime-tools/node_modules/jsdom/lib/api.js
export SAJU_QA_CHROME=/usr/bin/chromium
npx tsc --noEmit --incremental false
npx eslint app/guin/page.tsx 'app/guin/[id]/page.tsx' scripts/qa/map-ime-browser.mjs
npm run build
SAJU_QA_PHASE=after node scripts/qa/map-ime-browser.mjs
node scripts/qa/map-keyboard-browser.mjs
SAJU_QA_PROFILE=standard node scripts/qa/map-name-forms-browser.mjs
node --test --test-reporter=tap scripts/qa/map-name-session.mjs scripts/qa/name-normalization.mjs scripts/qa/guin-map-loading-dom.mjs
```

원본은 기준 Git 객체의 임시 사본에 현재 검사 파일만 복사해서 재실행한다. 조합 검사 종료 코드 1과 조합 중 제출 2건 실패가 기대 결과다. `SAJU_QA_PHASE`는 보고서 이름만 바꾼다.

```bash
saju_ime_baseline=$(mktemp -d)
git archive 8b3f1cb0c1c77c06a2fd0084753222f6d518126b | tar -x -C "$saju_ime_baseline"
cp scripts/qa/map-ime-browser.mjs "$saju_ime_baseline/scripts/qa/"
ln -s "$PWD/node_modules" "$saju_ime_baseline/node_modules"
(
  cd "$saju_ime_baseline"
  npm run build
  SAJU_QA_PHASE=before node scripts/qa/map-ime-browser.mjs
)
```

기존 lint 오류는 상세 페이지의 `/guin/` 일반 `<a>` 링크 2개이며, 경고는 사용하지 않는 기존 import 3개와 `window.location.assign()` 1개다. 전체 lint 통과로 해석하지 않는다. 전역 키 처리·시간 지연·추정한 keyCode 보정·이름 정책·API·DB·레이아웃·모델·재질은 변경하지 않았다.
