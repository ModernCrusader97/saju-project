# Surrogate 경계에서 이름 정규화의 멱등성 보장

실제 최신 작업 원격 `fix/galaxy-day-calendar-20261010`의 `831d328889759f722b1e5b2214ace906b0483c0c`을 확인한 뒤, 별도 `fix/name-normalization-idempotence-20261010` 브랜치에서 작업했다. 이 기준의 이름 파서는 이전 이름 경계 수정 `d84d77659faa7942c903f14885f3a7eaa47c2801`과 동일했다. 날짜 수정 브랜치와 날짜 helper는 변경하지 않았다.

보고된 `'가'.repeat(48) + ' ' + '😀'`는 51 UTF-16 단위다. 기존 파서는 먼저 `trim().slice(0, 50)`을 적용하고, 잘린 high surrogate를 한 단위 되돌린다. 이때 내부에 있던 공백이 문자열 끝에 드러난다. 첫 결과는 끝 공백을 포함한 49단위이고, 두 번째 파싱의 `trim()`이 그 공백을 제거해 48단위가 된다.

`/api/saju`는 route에서 `parseSajuInput`을 호출한 뒤 `analyzeSaju` 안에서 다시 파싱한다. 지도 본인과 친구 route도 분석을 호출하지만 저장 이름에는 첫 파싱의 `input.name`을 사용한다. 실제 빌드한 Worker와 폐기 가능한 로컬 D1에서 다음 차이를 확인했다.

| 합성 입력 | 수정 전 첫 파싱 | 수정 전 재파싱 / 사주 저장 | 수정 전 지도 본인·친구 저장 | 수정 후 모든 경로 |
| --- | --- | --- | --- | --- |
| 가 48개 + 공백 + 😀 | 49단위 | 48단위 | 49단위 | 48단위 |
| 가 47개 + NBSP + 전각 공백 + 😀 | 49단위 | 47단위 | 49단위 | 47단위 |

수정은 유효한 surrogate pair를 50단위 경계에서 절단한 경우의 조건문 안에서 `name.slice(0, -1).trimEnd()`를 적용하는 것이다. 한 단위를 되돌리면서 드러난 끝 공백까지 첫 파싱에서 정리하므로, 이 경로의 결과를 다시 파싱해도 이름이 같다. 조건문 밖의 이름 처리는 그대로다.

기존 일반 이름의 `trim`, 최대 50 UTF-16 단위, 내부 공백, 빈 이름 오류 및 이미 잘못된 UTF-16 입력의 처리 동작을 회귀 검사했다. 코드 포인트나 grapheme 기준으로 바꾸지 않았다. 일반 BMP 절단으로 끝 공백이 남는 기존 동작도 보존했다. 예를 들어 `'가'.repeat(49) + ' 끝'`의 첫 파싱은 여전히 끝 공백을 포함한 50단위다. 이번 멱등성 보장은 surrogate pair를 되돌리는 경로에 한정한다. 생년월일·생시·음력·절기·질문 처리와 API 저장 코드는 변경하지 않았다.

단위 검사 28개는 수정 전 8개 실패, 수정 후 모두 통과했다. 새 경계 사례에는 단일·복수 공백, 탭, CRLF, Unicode 공백, BOM, 뒤에 추가 글자가 있는 입력을 포함했다. 기존 `trim()` 대상 공백 25종을 각각 1~5단위로 조합한 125개 입력도 첫 파싱·재파싱·분석 이름이 일치했다. 내부 공백과 zero-width space는 기존 의미대로 유지됐다.

실제 Worker·D1·Chromium 흐름 검사 32개는 수정 전 6개 실패, 수정 후 모두 통과했다. 7개 이름 사례의 사주 API·로컬 계산·상세 재조회·목록 요약을 대조하고, 지도 본인·친구 이름을 각각 저장 후 재조회했다. 같은 입력의 사주 저장 이름과 지도 저장 이름도 직접 비교했다. 실제 모바일 크기의 브라우저에서는 사주 입력 폼 제출, 응답 이름, 화면에 렌더링된 사주팔자 제목을 확인했다. 빈 이름 거절, 익명·다른 소유자 격리, 외부 호출 및 브라우저 예외도 검사했다.

관련 회귀는 통합 검사 23개, 저장 목록 API 4개, 저장 목록 DOM 6개와 기존 날짜 검사 530개가 통과했다. 타입 검사, 변경된 코드의 ESLint 및 빌드도 종료 코드 0을 확인했다. 저장 목록 DOM 검사는 네트워크·라우터 경계를 대체한 생명주기 검사다. 저장 목록 API 검사의 선택적 브라우저 모드는 실행하지 않았다. 빌드의 기존 큰 청크 및 일부 경로 분류 안내는 남아 있다.

실행 환경은 Node `24.19.0`, Playwright `1.62.1`, Chromium `151.0.7922.173`이었다. 최초 브라우저 호출에서 CommonJS `index.js`를 지정해 `launch`를 찾지 못한 harness 오류가 발생했다. ESM `index.mjs`로 바로잡아 원본과 수정본을 모두 재실행했으며, 위 수치는 정상 harness의 결과다.

일반 clone의 저장소 루트에서 아래 명령으로 재실행할 수 있다. Chromium 경로는 설치된 브라우저에 맞게 지정한다. Playwright와 jsdom은 별도 QA 디렉터리에 설치하므로 앱 의존성을 바꾸지 않는다.

```bash
npm run install:ci
npm install --prefix /tmp/saju-name-qa --no-save --package-lock=false playwright@1.62.1 jsdom@26.1.0
export SAJU_QA_PLAYWRIGHT_PATH=/tmp/saju-name-qa/node_modules/playwright/index.mjs
export SAJU_QA_CHROME=/usr/bin/chromium
export SAJU_QA_JSDOM_PATH=/tmp/saju-name-qa/node_modules/jsdom/lib/api.js

node --test --test-reporter=tap scripts/qa/name-normalization.mjs
npx tsc --noEmit --incremental false
npx eslint lib/saju/input.ts scripts/qa/name-normalization.mjs scripts/qa/name-normalization-flow.mjs
npm run build
node scripts/qa/name-normalization-flow.mjs
node scripts/integration-preview.mjs
node scripts/qa/saved-archive.mjs
node --test --test-reporter=tap scripts/qa/saved-archive-dom.mjs
node scripts/qa/daily-orbital-calendar.mjs
```

원본의 실패를 재현하려면 위 QA 도구 환경 변수를 유지하고, 수정 브랜치의 검사 파일만 기준 커밋의 별도 작업 트리에 복사한다. 앱 소스는 원본 그대로 빌드한다. 두 이름 검사 명령의 종료 코드 1은 각각 8개·6개 불일치의 기대 결과다. 기준 커밋의 Git 객체가 필요하므로 shallow clone이면 먼저 해당 커밋을 가져와야 한다. `SAJU_QA_PHASE`는 보고서 파일 이름만 선택하며 앱 소스를 교체하지 않는다.

```bash
saju_name_replay_checkout=$(mktemp -d)
git worktree add --detach "$saju_name_replay_checkout" 831d328889759f722b1e5b2214ace906b0483c0c
cp scripts/qa/name-normalization.mjs scripts/qa/name-normalization-flow.mjs "$saju_name_replay_checkout/scripts/qa/"
ln -s "$PWD/node_modules" "$saju_name_replay_checkout/node_modules"
(
  cd "$saju_name_replay_checkout"
  node --test --test-reporter=tap scripts/qa/name-normalization.mjs
  npm run build
  SAJU_QA_PHASE=before node scripts/qa/name-normalization-flow.mjs
)
```

단위·빌드·타입·lint 로그와 실제 이름 길이를 포함한 흐름 JSON은 Git에서 제외되는 `outputs/name-idempotence/`에 보존했다. 관련 검사 보고서는 `outputs/saved-archive/`와 `outputs/galaxy-day-calendar/`에도 있다. 운영 DB와 실제 사용자 기록, 외부 AI 서비스는 사용하지 않았다. 운영 계정 로그인, 지도 생성·친구 등록 폼의 브라우저 동작, 실기기 및 3D 시각 검증은 이번에 실행하지 않았다. 지도 이름 검증의 근거는 실제 API 저장·재조회 결과다.

업로드 파일은 공유 파서, 이름 단위 검사, 이름 흐름 검사, 이 문서의 네 파일이다. 별도 비공개 브랜치에 정상 push하며 main 병합, PR, 배포 및 인증·권한 변경은 수행하지 않는다.
