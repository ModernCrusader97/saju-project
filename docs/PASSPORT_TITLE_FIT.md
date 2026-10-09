# 여권 이미지의 긴 제목 수정

최신 작업 원격 `d84d77659faa7942c903f14885f3a7eaa47c2801`에도 긴 이름을 72px로 그대로 그리는 코드가 남아 있었다. 한글 50단위 제목은 약 3,745px, 영문 W 50단위 제목은 약 4,033px로 측정됐으며, 실제 PNG에서 이미지 양끝이 잘리는 것을 확인했다. 이를 별도 `fix/passport-title-fit-20261010` 브랜치에서 수정했다.

수정은 다운로드 이미지의 제목 표시에만 적용된다. 저장된 이름과 전달받은 `person.name`, 다운로드 파일명, 이름 정규화, HTML 미리보기는 바꾸지 않았다. 이미지의 다른 문구와 스냅샷도 그대로 유지한다.

## 제목을 맞추는 방법

현재 카드는 1080×1920px이고, 내부 프레임은 x=80부터 x=1000까지 920px 너비다. 이전 후보의 872px은 이 프레임 양쪽에 24px씩 여백을 둔 값이므로 현재 레이아웃에도 맞는다. 제목 중심 x=540과 기준선 y=360은 유지했다. 따라서 제목 영역은 x=104부터 x=976까지다.

원래 제목이 들어가면 기존 `bold 72px serif`와 문구를 그대로 사용한다. 넘치면 1px씩 줄여 가장 큰 맞는 글꼴 크기를 찾고, 36px에서도 넘칠 때만 제목 끝에 `…`를 붙인다. 말줄임은 이름과 `님의 우주 정령`을 합친 전체 제목에 적용된다. 화면에서 한 글자로 보이는 묶음인 grapheme을 기준으로 잘라 이모지, ZWJ 가족 이모지, 결합문자가 중간에서 나뉘지 않게 했다. 50 UTF-16 단위 저장 계약은 변경하지 않았다.

Canvas가 측정한 글자 진행 너비와 실제 글리프의 좌우 범위를 함께 확인한다. 글자가 너비 측정값 밖으로 조금 튀어나오는 경우도 제목 영역을 벗어나지 않도록 했다. 별 배치와 이미지의 나머지 그리기 코드는 수정하지 않았다.

## 실제 이미지로 확인한 결과

한글·영문·이모지·ZWJ·결합문자·빈 이름과 고정 스냅샷을 포함한 합성 사례 13개를 실제 모달과 Chromium Canvas에서 내려받았다. 수정 전에는 긴 제목 6종에서 넘침과 글꼴 처리 검사 12개가 실패했다. 수정 후에는 27개 검사가 모두 통과했다.

짧은 제목 7종은 72px 문구를 유지했고, 전체 1080×1920 RGBA 픽셀과 PNG 파일 바이트가 기준 원본과 정확히 같았다. 이 비교에서는 QA에서만 별 배치를 고정했다. 제품의 무작위 별 배치는 유지한다. 긴 제목을 포함한 13종 모두 제목 영역 밖 픽셀이 원본과 같았고, 원래 이름 값도 그대로였다.

10자 한글 이름은 문구를 자르지 않고 57px, 약 867.54px 너비로 들어갔다. 더 긴 한글·영문·이모지·ZWJ·결합문자 제목은 36px과 말줄임으로 872px 이내에 들어갔다. 실제 글리프 픽셀도 x=104..975 안에 있었다. 내려받은 한글 전후 이미지와 영문·ZWJ·결합문자·짧은 스냅샷 이미지를 직접 열어 확인했다.

실제 production 화면에서 현재 3D 장면을 담은 여권 PNG 다운로드와 기존 닫기 동작도 통과했다. 이 점검은 기존 `universe-browser.mjs`의 `default share image` 항목만 실행했다. 기존 통합 23개, 이름 회귀 17개, 타입 검사와 production build도 통과했다. 전체 3D 회귀를 다시 실행한 결과는 아니다.

변경 코드와 QA 스크립트의 lint는 오류 0개다. 모달의 기존 `Compass` 미사용과 `<img>` 안내 2개는 기준 원본에도 있었으며 그대로 남아 있다. 저장소 전체 lint 결과는 아니다. 첫 타입 검사에는 QA가 만든 임시 `harness.tsx`가 포함되어 오류가 났다. 임시 브라우저 파일을 JSX로 생성하도록 고친 뒤 다시 통과했고, 앱 타입 설정은 변경하지 않았다.

## 다시 실행하기

Node 22.13 이상과 lockfile 앱 의존성이 필요하다. Playwright는 ignored `.sites-runtime`에 설치한다. 앱 package와 lockfile은 바꾸지 않는다.

```sh
npm run install:ci
npm install --prefix .sites-runtime/test-tools --no-save --ignore-scripts \
  --no-audit --no-fund playwright@1.62.1
node .sites-runtime/test-tools/node_modules/playwright/cli.js install chromium
node scripts/qa/passport-title-canvas.mjs
npm run build
node scripts/integration-preview.mjs
node --test scripts/qa/name-normalization.mjs
npx tsc --noEmit --incremental false
npx eslint lib/planet/passport-title.ts components/planet/CosmicPassportModal.tsx \
  scripts/qa/passport-title-canvas.mjs
```

이미 설치된 도구는 `SAJU_QA_PLAYWRIGHT_PATH=/absolute/path/playwright/index.mjs`와 `SAJU_QA_CHROME=/absolute/path/chromium`으로 선택할 수 있다. production 공유 이미지 점검은 같은 Playwright 경로와 `SAJU_QA_BROWSER`를 지정하고, `SAJU_QA_SECTION='default share image' node scripts/qa/universe-browser.mjs`로 실행한다. 현재 환경에서는 테스트용 Chromium 실행기에 `--no-sandbox`를 전달했다.

Canvas 검사는 기준 commit의 실제 모달을 Git에서 읽어 현재 모달과 같은 브라우저에서 비교한다. 따라서 기준 commit 객체가 없는 얕은 체크아웃에서는 해당 원본을 먼저 확보해야 한다. 결과 JSON과 PNG는 ignored `outputs/passport-title-fit/`에 저장되며 실패하면 exit 1이다. 큰 이미지·로그·빌드 출력은 커밋하지 않는다.

검증 환경은 Node 24.19.0, Playwright 1.62.1, Chromium 151.0.7922.173이다. 글꼴에 따라 선택되는 크기와 말줄임 위치는 달라질 수 있으므로 실제 Canvas 측정값으로 결정한다. 아주 긴 ZWJ·결합문자도 합성 props로 검사했으며 저장 입력 제한을 확대하지 않았다. 격리된 Vite 모달의 13종 비교와 production 공유 경로 점검을 구분했다. 운영 DB·운영 로그인·실기기 터치는 검증하지 않았고, 실제 사용자 자료나 외부 AI를 사용하지 않았다. 기존 build의 큰 chunk와 route classification 안내는 남아 있다.
