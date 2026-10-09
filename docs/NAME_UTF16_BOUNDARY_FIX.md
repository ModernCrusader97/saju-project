# 이름 50 UTF-16 단위 경계 수정

기준은 최신 작업 원격과 일치한 `6f7f970878c39b1bae8148a47292c715a9946dc7`이다. 이 코드에서도 `49개 BMP 문자 + 😀`를 입력하면 `trim().slice(0, 50)`이 high surrogate만 남기는 문제가 재현됐다. 별도 `fix/name-utf16-boundary-20261010` 브랜치에서 공유 `parseSajuInput`의 이름 처리만 수정했다.

trim 후 최대 50 UTF-16 단위를 유지한다. 절단 지점의 마지막 high surrogate와 원본의 다음 low surrogate가 유효한 쌍일 때만 마지막 한 단위를 되돌린다. `48개 BMP 문자 + 😀`는 50단위 그대로, `49개 BMP 문자 + 😀`는 49단위가 된다. 빈 이름 오류, 일반 이름, 이미 잘못된 UTF-16 입력에 대한 기존 동작은 유지한다. 코드 포인트·grapheme 기준으로 바꾸지 않았고 500단위 질문 처리는 수정하지 않았다.

API의 풀이·지도 소유자·지도 친구 처리와 클라이언트 사주 계산이 기존 공유 파서를 재사용한다. 별도의 UI 정규화나 중복 이름 구현은 추가하지 않았다.

## 재현과 검증

- 수정 전: 이름/로컬 계산 17개 중 경계 5개 실패. 실제 Worker/D1/Chromium 14개 중 풀이 API·지도 소유자·친구·브라우저 경계 4개 실패. 일반 이름과 정확히 맞는 이모지 경계는 통과했다.
- 수정 후: 이름/로컬 계산 17개, Worker/D1/Chromium 14개 모두 통과. 유효 UTF-16 보존, 50단위 상한, trim, 빈값·비문자열 오류, API/클라이언트 계산 일치, 상세·요약 저장 이름, 실제 홈 풀이 폼, 다른 사용자 격리를 확인했다.
- 기존 통합 23개와 보관함 API/SQL 4개 통과. 타입·production build 통과. 변경 코드·검사 3개 파일 lint 오류 0·경고 0.
- 환경: Node 24.19.0, Playwright 1.62.1, Chromium 151.0.7922.173. 빌드의 기존 큰 chunk/route classification 안내는 남아 있다. 저장소 전체 lint 결과는 아니다.

## 실행

Node 22.13 이상과 lockfile 앱 의존성이 필요하다. QA 도구는 ignored `.sites-runtime`에 설치하고 앱 package/lockfile은 변경하지 않는다.

```sh
npm run install:ci
node --test scripts/qa/name-normalization.mjs
npm run build
npm install --prefix .sites-runtime/test-tools --no-save --ignore-scripts \
  --no-audit --no-fund playwright@1.62.1
node .sites-runtime/test-tools/node_modules/playwright/cli.js install chromium
node scripts/qa/name-normalization-flow.mjs
node scripts/integration-preview.mjs
node scripts/qa/saved-archive.mjs
npx tsc --noEmit --incremental false
npx eslint lib/saju/input.ts scripts/qa/name-normalization.mjs \
  scripts/qa/name-normalization-flow.mjs
```

이미 설치된 Playwright는 `SAJU_QA_PLAYWRIGHT_PATH=/absolute/path/playwright/index.mjs`, Chromium은 `SAJU_QA_CHROME=/absolute/path/chromium`으로 선택할 수 있다. 흐름 검사의 결과 JSON은 ignored `outputs/name-utf16-boundary/flow-after-report.json`에 생성되며 실패 시 exit 1이다. 단위 검사는 실제 공유 파서와 분석기를 실행하고, 흐름 검사는 실제 빌드 Worker/API와 브라우저 폼을 사용한다. API 응답을 대체하지 않는다.

합성 이름·생일·로컬 신원과 폐기 가능한 D1만 사용했다. 새 검사는 외부 호출을 차단한다. 기존 통합의 AI 시험은 고정 모의 응답만 사용한다. 운영 DB·운영 로그인·실기기 터치·3D 재질은 검증하지 않았고 배포하지 않았다. 비밀키·`.env`·실제 사용자 DB·큰 로그·빌드 출력은 커밋하지 않는다.
