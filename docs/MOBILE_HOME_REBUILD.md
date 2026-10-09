# 모바일 홈 재제작

이 변경은 작업 기록과 현재 GitHub에 보존된 소스로 만든 새 모바일 홈입니다. 이전 후보 `32eb33a`와 `c5d13cf`를 확보하지 못했으므로 동일 복원이라고 주장하지 않습니다.

## 기준과 범위

- 저장소: 비공개 `ModernCrusader97/saju-project`.
- 독립 브랜치: `rebuild/mobile-home-20261010`.
- 기준: `43e2d8dc6efe1654641e639397f37d0ea44f525a`. 이 계보의 입력·저장 기록·대화·은하 로딩 보완을 포함합니다.
- 별도 십간 작업은 `rebuild/ten-stem-materials-20261009`의 `de85ce2ed7f9c655f532d9a8a16be8855e6dd661`에 유지합니다. 그 브랜치에서 작업하거나 십간 변경을 이 브랜치로 합치지 않았습니다.
- `43e2d8d`와 `de85ce2`의 기존 홈 blob은 모두 `83873d22cf40820a4e37ed35a5240a3644ee9a10`, 전역 CSS blob은 모두 `cd00d3060bfefd524bcf55b7074758436ed824e0`입니다. 따라서 같은 홈을 출발점으로 삼으면서 홈 작업을 분리할 수 있습니다.
- 원래 체크아웃과 `maint/guin-map-loading-20261009`를 수정하지 않았습니다. main 병합, PR 생성, 배포, 인증·권한 변경은 하지 않습니다.

제품 변경은 `app/page.tsx`와 새 `app/home.module.css`에 한정합니다. 전역 CSS, 공통 헤더·하단 탐색, 사주 계산/API, 정령·행성·pet 모델 및 재질 소스는 수정하지 않습니다.

## 화면과 기존 동작

홈 상단에 기존 제목과 짧은 설명, 입력 폼으로 이동하는 **나의 우주 만들기**를 배치했습니다. CTA는 `#birth-form`을 가리키는 실제 앵커입니다. 폼의 `tabIndex={-1}`로 키보드 이동 후 폼에 초점을 두고 다음 Tab으로 이름 입력에 진입합니다.

**정령 · 행성 보기**는 `/planet`, **은하 보기**는 `/guin`으로 이동합니다. 둘 다 내부 `Next Link`에 `prefetch={false}`를 지정했습니다. 정령과 은하의 기존 이미지는 각각 **예시**로 표시합니다. 모바일에서는 이미지와 제목이 나란히 있는 두 카드를 쌓고, 데스크톱에서는 같은 높이의 카드 두 개를 나란히 배치합니다. 원본 전체를 `object-fit: contain`으로 보여주며 320px의 문장은 단어 단위로 줄바꿈합니다.

기존 입력 기본값, 이름 공백 제거와 빈 이름 대체, 시간 모름 처리, 잘못된 날짜 오류, `/planet` 쿼리, 일곱 풀이 주제와 모달, 결과 저장·닫기 및 `/saved` 이동을 유지했습니다. 입력 글자 크기는 16px입니다. 홈에는 WebGL을 추가하지 않았습니다.

### 이미지 원본

| 표시 | GitHub에 보존된 원본 | 런타임 경로 | SHA-256 |
| --- | --- | --- | --- |
| 정령 예시 | `assets/source-reference/saju-b-evolving-light-v002/preview_keyframes/001.png` | `/spirits/jade-v002/still.png` | `f17790815107c4c5d751df92050c3e00c6c597f95843dfcd1b2c6c39c7735c54` |
| 은하 콘셉트 예시 | `public/images/cosmos-cover.png` | `/images/cosmos-cover.png` | `8749ac60a1333b432c55c9a9fc826a78eabdb4187e292bba0bfbcf5d7d9ac1ba` |

정령 정지 이미지는 기존 `scripts/sync-approved-jade-assets.mjs`가 생성합니다. CPU에서 원본과 런타임 이미지의 바이트 일치를 확인했습니다. 새 이미지 생성이나 Library 파일 다운로드·우회를 하지 않았습니다. 이미지가 개인별 실제 계산 결과라는 뜻은 아닙니다.

### 실제 빌드에서 확인한 Link 이동 문제

첫 구현의 내부 Link를 실제 브라우저에서 실행하면 `TypeError: e is not a function`으로 이동이 실패했습니다. 설치된 Vinext `1.0.0-beta.5`의 Link는 `navigation.js`를 지연 로딩해 `navigateClientSide`를 호출하지만, 이 프로젝트의 생성된 클라이언트 모듈에는 해당 이름의 export가 없었습니다. 새 브라우저에서 Link 이동만 실행해도 같은 실패가 재현됐습니다.

두 새 카드의 `onNavigate`에서 기본 이동을 취소하고 공개 `useRouter().push()`로 이동합니다. Next Link와 `prefetch={false}`는 유지하며, 전역 라우터·의존성을 변경하지 않습니다. 최종 검사는 URL뿐 아니라 `/planet`의 정령 제목과 `/guin`의 이름 입력이 실제로 나타나는 것까지 확인합니다. 수정 전 실패 기록은 [link-before-fix.json](qa/mobile-home-rebuild/link-before-fix.json)에 보존했습니다.

## 검증 결과

실제 production Worker/client/HTML/CSS를 Miniflare에서 실행하고 Chromium `151.0.7922.173`으로 검사했습니다. 계정 헤더와 D1은 합성 테스트 자료이며 실제 사용자 DB를 읽거나 저장하지 않습니다.

| 검사 | 결과와 범위 |
| --- | --- |
| 기존 홈 | 320/360/390/430/1100px, 기존 동작 6개 검사 통과 |
| 새 요구사항의 구현 전 검사 | Next Link 부재로 실패하는 것을 확인 |
| 재제작 홈 | 같은 5개 폭, 브라우저 8개 검사 및 Link 소스 검사 통과 |
| 반응형·시각 | 가로 넘침 0, 원본 이미지 로드, 양쪽 카드 높이와 문장·버튼·하단 영역 및 초점 화면 직접 확인 |
| 키보드 | 모든 폭에서 CTA Tab/Enter → 폼 초점·스크롤 → 이름 입력 Tab, 두 카드 초점·Enter 이동, 기존 메뉴 초점 순환·Escape 복귀 |
| 입력·저장 | 기본값, 시간 모름, 존재하지 않는 날짜, 정확한 제출 쿼리, 일곱 모달, 실제 로컬 D1 저장·목록 조회·결과 닫기·기록 이동 |
| 홈 로딩 | hover와 focus 후에도 `/planet`·`/guin` 미리 요청 0, GLB·three 번들 요청 0, canvas·WebGL 생성 0, 브라우저 오류·외부 요청 0 |
| 타입 | `npx tsc --noEmit --incremental false` 통과 |
| production build | 구현 전·후 `npm run build` 통과 |
| 변경 파일 lint | 오류 0, 경고 3: 보존한 `window.location.assign`과 정적 이미지 두 개의 Next 권장사항 |
| 통합 | `scripts/integration-preview.mjs` 23개 검사 통과; API·저장·대화·은하·주요 페이지·사용자 격리, AI 시험은 mock만 사용 |
| 관련 DOM 회귀 | 저장 기록 6, 은하 로딩 7, 저장 목록 응답 4 — 총 17개 통과 |
| patch | `git diff --check` 통과 |

빌드에는 기존의 큰 번들 안내와 route classification 안내가 남아 있습니다. 저장소 전체 lint가 무경고라는 의미는 아닙니다. 상세 결과와 한계는 [verification-summary.json](qa/mobile-home-rebuild/verification-summary.json), [구현 전 브라우저 기록](qa/mobile-home-rebuild/before/report.json), [최종 브라우저 기록](qa/mobile-home-rebuild/after/report.json), [통합 기록](qa/mobile-home-rebuild/integration-report.json)에 있습니다.

스크린샷은 `docs/qa/mobile-home-rebuild/before/`와 `after/`에 각 폭의 전체 화면과 viewport를 보존했습니다. `after/form-focus-{width}.png`는 CTA로 실제 이동한 뒤 이름 입력에 초점을 둔 화면입니다.

- [320px 구현 전](qa/mobile-home-rebuild/before/home-320-viewport.png) · [320px 재제작](qa/mobile-home-rebuild/after/home-320-viewport.png) · [320px 폼 초점](qa/mobile-home-rebuild/after/form-focus-320.png)
- [390px 재제작](qa/mobile-home-rebuild/after/home-390-viewport.png) · [1100px 전체 화면](qa/mobile-home-rebuild/after/home-1100.png)

## 재실행

의존성이 설치된 뒤 기존 빌드 스크립트가 승인된 런타임 이미지를 생성합니다. 브라우저 검사에는 설치된 Playwright와 Chromium이 필요하고, DOM 검사는 설치된 JSDOM 경로를 사용합니다. 현재 실행 환경의 해당 패키지를 이용했으며 제품 의존성은 추가하지 않았습니다.

```sh
npm run build
npx tsc --noEmit --incremental false
npx eslint app/page.tsx scripts/qa/mobile-home.mjs
SAJU_QA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs \
  SAJU_QA_CHROME=/usr/bin/chromium node scripts/qa/mobile-home.mjs
node scripts/integration-preview.mjs
SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js node scripts/qa/saved-archive-dom.mjs
SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js node --test scripts/qa/guin-map-loading-dom.mjs
SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js node --test scripts/qa/saved-list-response-dom.mjs
git diff --check
```

구현 전 브라우저 기록은 기준 소스로 빌드한 상태에서 `SAJU_QA_HOME_PHASE=before`로 생성했습니다. 최종 결과는 기본 `after` 모드의 전체 검사이며 특정 검사만 선택한 진단 결과를 최종 결과로 사용하지 않았습니다.

## 검증 한계

물리적 모바일 기기·터치, 호스팅 로그인, 운영 DB, 배포 화면은 실행하지 않았습니다. 홈에서 두 목적지의 실제 콘텐츠가 열리는 것을 확인했으나 정령·은하의 전체 WebGL 시각 품질을 이번 홈 회귀의 검증 대상으로 삼지 않았습니다. 정상 생년월일 제출의 목적지 document 응답만 테스트 HTML로 대체해 기존 쿼리를 검사했고, 내부 Link 이동과 모달 저장은 실제로 실행했습니다. DOM 회귀는 JSDOM의 생명주기 검사이며 브라우저 시각 검사를 대체하지 않습니다.

커밋에는 소스·문서·합성 QA 결과와 이미지 증거만 넣습니다. `.env`, 비밀키, 실제 사용자 DB, 빌드 출력, 로컬 의존성은 포함하지 않습니다.
