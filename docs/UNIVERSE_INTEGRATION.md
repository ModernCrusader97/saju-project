# 정령·행성·갤럭시 통합

승인된 B의 둥근 몸체와 연결된 팔을 정령 화면에 사용합니다. 일간 을의 비취 재질은 v002 RGB 세 필드로 부분마다 빛이 피고 사라집니다. GLB 자체의 애니메이션을 재생하는 구현이 아닙니다. 원본의 제한된 포즈 연구는 중립 상태로 유지하며, 인사할 때 눈만 짧게 깜박입니다.

| 화면 | 기존 데이터와 표현 |
| --- | --- |
| 정령 | 일간 재질, 일지 동물 특징, 월간 재질·월지 형태의 지상 펫 |
| 행성 | 일주 70%·월주 30% 표면, 시주 위성, 연주 소행성대, 기존 다섯 마스크 |
| 갤럭시 | 기존 귀인 지도·인연 추가·선택·추적·거리/속도 조절·도감·공유 |

다른 일간은 기존 재질 조리법을 사용합니다. 성향 이름과 세 가지 특성, 동물 정보는 원래 값을 별도 모듈로 옮겼습니다. 원소 점수나 관계 계산을 추가하지 않았습니다. 대기와 계절 층도 추가하지 않았습니다. 기존 계산의 절기·대운 한계와 시연용 관계 점수 표시는 유지합니다.

한 번 적용한 결과를 세 화면에서 이어받습니다. 새 생년월일 입력은 기존 결과와 분리하고, 유효한 입력을 적용해야 결과를 바꿉니다. 세션 저장과 브라우저 기록으로 반복 입력과 뒤로 가기를 지원합니다. 생년월일은 스튜디오 주소에 남기지 않습니다. 갤럭시 생성은 기존 저장 API가 성공한 뒤 완료되며, 다른 생년월일로 결과를 바꾸면 이전 갤럭시 바로가기를 지웁니다. 공유 카드는 현재 화면을 캡처하며 생년월일과 출생 시각을 그리지 않습니다.

## 재질 계약

v002만 불러옵니다. 필드 PNG는 2048×1024 RGBA8이고 R/G/B가 서로 다른 고정 위치의 필드입니다. 선형 색 공간, `flipY=false`, NEAREST, CLAMP_TO_EDGE, 미사용 밉맵과 알파 사전 곱셈 설정을 사용합니다. 동일 패키지의 셰이더에서 `flipV=false`로 읽습니다. `sajuV001BodyGLTFLocalToGenerated`라는 함수 이름은 동일한 변형 전 몸체의 좌표 변환을 뜻하며, v001의 단일 필드 아틀라스를 사용하지 않습니다.

CPU에서 시간을 6초로 감싸고, GPU에서는 A→B→C→A의 가중치만 바꿉니다. 위치·UV·노이즈 좌표를 시간으로 이동하거나 회전하지 않습니다. 원래 색 텍스처를 사용하고, GLB의 이미 감쇠된 재질과 발광 맵은 본체에서 대체합니다. Three.js의 반사·투과·클리어코트 계산이 끝난 선형 BRDF 전체에 격리 마스크를 한 번 적용한 뒤, 녹색 `[0.001, 0.65, 0.08]`과 강도 2의 발광을 더합니다. 노출과 블룸으로 빛을 증폭하지 않습니다. Blender의 모든 산란 효과나 완전한 리그를 재현한다고 주장하지 않습니다.

한 화면의 캔버스만 마운트하며, 이전 화면의 프레임과 WebGL 자원을 해제합니다. 숨겨진 문서와 연결 손실 상태에서는 그리기를 멈춥니다. 연결 복구 시 GPU 반사광을 다시 생성합니다. 모션 감소 설정은 처음에 움직임을 멈추며, 세로 터치는 페이지 스크롤, 가로 터치는 관찰 회전으로 처리합니다. 모바일 갤럭시는 별 9,000개와 DPR 상한 1.25를 사용합니다. 3D를 사용할 수 없을 때는 이를 명시하고 결과와 관계 카드를 계속 읽을 수 있습니다.

## 독립적인 화면 구조

밝은 세이지·아이보리 바탕과 짙은 글자, 비취 강조색을 사용하고 밤하늘은 갤럭시에 집중했습니다. 모바일 아래와 데스크톱 위에는 정령·행성·은하 세 탭이 있습니다. 다음 사이트의 정보 구조를 참고한 해석이며, 이미지나 구현을 복제하지 않았습니다.

- [Finch](https://finchcare.com/): 캐릭터와 짧은 문장.
- [NASA Eyes](https://eyes.nasa.gov/apps/solar-system/): 물체 중심의 탐색.
- [16Personalities](https://www.16personalities.com/personality-types): 유형 이름·캐릭터·짧은 특성·세부 설명의 순서.
- [Dimensional](https://www.dimensional.me/): 읽기 쉬운 관계 비교.
- [Space Elevator](https://neal.fun/space-elevator/): 한 번의 조작에 하나의 발견.

## 재현과 검증

앱의 패키지 관리자와 잠금 파일을 유지했습니다. 필수 실행은 `npm run install:ci`, `npm run build`, `node scripts/integration-preview.mjs`입니다. 추가 검사:

```text
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --test assets/source-reference/saju-b-evolving-light-v002/runtime/tests/saju-jade-evolution.test.mjs
node scripts/qa/verify-approved-assets.mjs
node scripts/qa/universe-browser.mjs
```

브라우저 검사는 앱 의존성을 바꾸지 않습니다. 별도로 제공한 `playwright-core`의 경로를 `SAJU_QA_PLAYWRIGHT_PATH`, 설치된 Chrome/Edge 실행 파일을 `SAJU_QA_BROWSER`로 지정할 수 있습니다. 기본값은 무시되는 `.sites-runtime/browser-qa/node_modules/playwright-core/index.mjs`와 Windows Chrome입니다. Miniflare의 가상 사용자와 폐기되는 테스트 D1만 사용하고 외부 요청을 차단합니다. 결과와 스크린샷은 무시되는 `outputs/universe-qa/`에 저장합니다.

보존 검사는 체크섬 목록 46개 항목, PNG/원본 RGBA8의 모든 바이트와 불투명 알파, 복원 GLB의 SHA-256을 확인합니다. Windows의 `git.autocrlf`가 바꾼 29개 텍스트 파일은 검증 중에만 LF로 비교하며 원본을 편집하지 않습니다. 원본 GLB의 SHA-256은 `57d7ee5b3c4e0b99eaadefb8095283bed44986beaa5a91c096dd7a0c514bf9c2`입니다.

## 확인된 결과

`origin/main`의 기준 커밋은 `2e2d82b05f87b39ff8057ae914e8dfa01100a974`입니다. 구현 커밋 `0caa08e`의 최종 빌드로 다음 검사를 실행했습니다. 이후 검증 문서와 브라우저 검사에 실제 별 렌더링의 8,100개 팔·900개 중심 분할을 반영했습니다.

| 검사 | 결과와 범위 |
| --- | --- |
| TypeScript·앱 빌드 | 통과. 앱 의존성과 잠금 파일은 유지했습니다. |
| 변경한 핵심 TS/TSX 파일 ESLint | 통과. 저장소 전체 lint를 실행했다는 의미는 아닙니다. |
| v002 원본 CPU 단위 검사 | 10개 통과. |
| 보존 원본 검사 | 46개 체크섬, 8,388,608바이트 RGBA8, 모든 알파 255, 복원 GLB 해시 통과. |
| 브라우저 | 9개 검사 그룹 통과. 오류 0개, 실제 외부 요청 0개. |
| 기존 통합 검사 | 23개 통과. 저장·채팅·잘못된 날짜·비로그인/다른 사용자 차단·모든 주요 페이지·가상 Gemini 응답·일 6회 제한 확인. |
| GPU 수치 | 108개 표본의 최대 오차 0.001951; 허용 오차 0.004314 이내. |
| 발광 이미지 | 몸체 영역에서 밝아진 픽셀 309개·어두워진 픽셀 373개. 일시 정지 후 이미지 유지 확인. |
| 모바일 품질 설정 | 별 8,100+900개, 배경 별 450개, 측정 DPR 1.2493, antialias 꺼짐. |

브라우저 검사는 320·390·768·1440px에서 세 탭, 가로 넘침, 44px 조작 영역과 16px 본문을 확인했습니다. 반복 입력·잘못된 날짜·뒤로 가기, 동일 결과의 은하 생성, 관계 선택, 출생 시각 미상 처리, 이전 캔버스 해제, 연결 손실·복구, 모션 감소, 세로 스크롤·가로 회전, 세 화면의 WebGL 대체 표시와 공유 PNG의 생년월일·시각 제외도 포함합니다.

검사 원본은 [browser-report.json](qa/universe/browser-report.json)입니다. LCP·CLS 값은 동일 문서를 리사이즈하며 관찰한 실험실 값이며, 너비별 독립 로드 측정이나 운영 성능 증거로 해석하지 않습니다. INP는 측정하지 않았습니다.

통합 검사는 외부 공급자 대신 로컬 mock으로 고정된 AI 사례 6개를 처리했습니다. 일반 흐름의 외부 요청은 0개입니다. 상세 범위는 [integration-report.json](qa/universe/integration-report.json)에 남겼습니다.

다음 화면은 폐기되는 로컬 D1과 `Fixture One`·`Fixture Friend`라는 가상 자료로 생성했습니다.

- [390px 정령](qa/universe/spirit-390.png)
- [390px 행성](qa/universe/planet-390.png)
- [390px 갤럭시](qa/universe/galaxy-390.png)
- [320px WebGL 없는 갤럭시](qa/universe/galaxy-webgl-fallback-320.png)

실기기 모바일 GPU·터치는 검증하지 않았습니다. Chrome의 SwiftShader와 CDP 입력은 실기기 테스트를 대신하지 않습니다. 호스팅된 로그인, 실제 Gemini 호출, 운영 Web Vitals와 운영 배포도 실행하지 않았습니다. LCP 2.5초·INP 200ms·CLS 0.1은 측정 목표이며 달성 주장으로 사용하지 않습니다. 빌드의 500KB 이상 3D 재질 번들 경고도 남아 있습니다.

`.openai/hosting.json`, 원본 아트, 잠금 파일과 기존 API/DB 코드의 변경 여부는 Git으로 확인합니다. 기존 Site의 공개 대상과 접근 권한은 변경하지 않습니다. 이 브랜치는 리뷰할 Draft PR로 전달하며 배포는 별도 단계입니다.
