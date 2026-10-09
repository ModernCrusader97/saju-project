# 상세 결과 전환 회귀 검사

기준은 홈 완료본 `23a067e2391ea033e5d507cf7b147b8794ce0316`입니다. `/saved?id=…`의 상세 GET 전환에서 추가 결함을 재현하지 못해 앱은 수정하지 않고 `fix/detail-result-state-20261010`에 합성 자료 전용 검사와 이 보고서만 보존합니다.

기존 `app/saved/page.tsx`는 현재 ID로만 결과를 선택하고, 선택 변경 시 오류를 비우며, 요청 취소 후 늦은 성공·오류를 무시합니다. 로컬·원격 원본 blob은 `36d665685be4fe5bd60c0560c4b0e28bc8c9d708`입니다. 이전 조사에서 보호를 제거한 임시 문자열은 예상한 실패를 만들었지만 제품 파일에 저장하지 않았고 게시하는 검사에도 포함하지 않았습니다.

## 보존한 검사

- `detail-result-state-dom.mjs`: 실제 SavedPage·FortuneCard·응답 reader를 JSDOM에 렌더링하는 9개 검사. 이전 결과가 있는 상태의 새 요청·실패·재시도, A→B→A의 같은 ID를 가진 늦은 응답, 현재 대기·오류를 덮는 늦은 실패, 늦은 `response.json()` 성공·실패, 실패한 기록 재방문, 잘못된 JSON, 상세 unmount와 Strict Mode를 검증합니다.
- `detail-result-state-browser.mjs`: 실제 production Worker/client와 Next router에서 UI 선택·목록 복귀·브라우저 Back·실패·재시도를 실행하는 Chromium 5개 검사. 상세와 목록 API 응답은 합성 자료로 지연·실패시키며 외부 요청을 차단합니다.
- `detail-result-fixtures.mjs`: 두 검사에서 공유하는 합성 풀이. 저장된 원본 자료나 사용자 DB를 읽지 않습니다.

이전 DOM 12개 중 캐시 재방문, 취소된 성공, ID 불일치의 중복 3개를 제외했습니다. 목록·검색·기본 캐시·Back/Forward·일반 취소·ID 불일치는 기존 `saved-archive-dom.mjs`의 6개 검사를 그대로 사용합니다. Chromium 검사는 실제 라우터 경계를 추가로 검증합니다. 기존 테스트나 앱 파일을 고치지 않았습니다.

## clean 체크아웃에서 실행

기존에 권한이 있는 비공개 Git 접근을 사용합니다. Node 22.13 이상과 앱의 lockfile 의존성, JSDOM 및 Playwright가 필요합니다. QA 의존성은 ignored `.sites-runtime`에만 설치하며 앱 package/lockfile을 바꾸지 않습니다.

```sh
git clone --single-branch --branch fix/detail-result-state-20261010 \
  https://github.com/ModernCrusader97/saju-project.git saju-detail-regression
cd saju-detail-regression
npm run install:ci
npm install --prefix .sites-runtime/test-tools --no-save --ignore-scripts \
  --no-audit --no-fund jsdom@26.1.0 playwright@1.62.1
node .sites-runtime/test-tools/node_modules/playwright/cli.js install chromium
node scripts/qa/detail-result-state-dom.mjs
npm run build
node scripts/qa/detail-result-state-browser.mjs
node scripts/qa/saved-archive-dom.mjs
npx eslint scripts/qa/detail-result-fixtures.mjs \
  scripts/qa/detail-result-state-dom.mjs scripts/qa/detail-result-state-browser.mjs
```

이미 설치된 도구는 `SAJU_QA_JSDOM_PATH=/absolute/path/jsdom/lib/api.js`, `SAJU_QA_PLAYWRIGHT_PATH=/absolute/path/playwright/index.mjs`로 선택할 수 있습니다. Chromium 경로를 직접 쓰려면 `SAJU_QA_CHROME=/usr/bin/chromium`을 브라우저 명령에 지정합니다. 스크립트는 자기 위치에서 저장소 경로를 구하므로 이전 작업 디렉터리나 임시 조사 파일에 의존하지 않습니다.

결과 JSON은 ignored `outputs/detail-result-state/{dom,browser}-report.json`에 생성됩니다. 실패 시 명령은 exit 1을 반환합니다. 스크린샷·큰 로그·빌드 파일·운영 자료는 커밋하지 않습니다.

## 확인 결과와 한계

정리한 DOM 9개와 Chromium 5개가 모두 통과했고, 새 테스트 파일 3개의 lint는 오류 0·경고 0입니다. 기존 6개 회귀와 production build도 통과했습니다. 검증 환경은 Node 24.19.0, JSDOM 26.1.0, Playwright 1.62.1, Chromium 151.0.7922.173입니다. 빌드의 기존 큰 번들 및 route classification 안내는 남아 있습니다.

DOM은 API/router 경계를 제어하며 Header·chat UI를 제외합니다. 브라우저는 실제 라우터를 쓰지만 API 결과는 합성 응답입니다. 취소된 browser fetch가 전달 자체를 막는 경우는 DOM의 늦은 본문 완료 검사로 보완합니다. 404·503·네트워크 오류는 의도한 테스트 실패이며, 예상 밖 JS 예외와 외부 요청은 없습니다. 호스팅 로그인·운영 DB·실기기 터치·배포는 검증하지 않았습니다.

홈 보고의 lint 오류 0·경고 3은 `app/page.tsx`와 `scripts/qa/mobile-home.mjs` 두 변경 파일만의 결과였습니다. 저장소 전체 lint 결과가 아니며 이번 검사 보존에서도 전체 lint를 실행하지 않습니다.
