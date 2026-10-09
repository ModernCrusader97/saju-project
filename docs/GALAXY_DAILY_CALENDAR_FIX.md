# 은하 일일 표시의 날짜 계산 수정

실제 원격 `fix/passport-title-fit-20261010`의 `073a71ec2120537332c489cec8b3ae07903ce5a6`을 확인하고 별도 `fix/galaxy-day-calendar-20261010` 브랜치를 만들었다. 이 기준의 `lib/saju/daily-orbital.ts`에는 `(year * 365 + zeroBasedMonth * 30 + day) % 10` 근사식이 남아 있었다. 원본 파일의 Git blob은 `cc63e4fab82ac27f14d306f0a25cbcb13fac05e4`이다.

이 식은 월말과 윤년을 정확히 세지 못하며 기존 앱의 일주 기준과도 다르다. 아래 결과는 합성 시계를 사용해 원본 helper와 기존 공용 `getDailyPillar`를 직접 실행한 결과다.

| 로컬 날짜 | 기존 은하 표시 | 기존 공용 일주 / 수정 후 표시 |
| --- | --- | --- |
| 2000-01-01 | 을·WOOD | 무·EARTH |
| 2000-02-29 | 계·WATER | 정·FIRE |
| 2026-01-31 | 을·WOOD | 을·WOOD |
| 2026-02-01 | 을·WOOD | 병·FIRE |
| 2025-12-31 | 경·METAL | 갑·WOOD |
| 2026-01-01 | 을·WOOD | 을·WOOD |

수정은 근사식을 `getDailyPillar(today.getFullYear(), today.getMonth() + 1, today.getDate())` 호출로 교체하는 것이다. `app/daily/page.tsx`와 `useLocalDate`가 이미 사용하는 브라우저의 로컬 달력 날짜를 그대로 따른다. 동일한 달력 날짜에는 시간대에 관계없이 같은 일주가 나오지만, 같은 순간이라도 시간대별 로컬 날짜가 다르면 결과가 달라질 수 있다. UTC 또는 한국 시간으로 강제 변환하지 않는다.

`manse.ts`의 기존 Julian-day 계산과 2000-01-01 = 무오 기준을 재사용한다. 생시의 30분 보정, 시주 경계, 음력 입력 변환, 절기 및 사주 해석 정책은 수정하지 않았다. 검사는 앱 내부 계산과의 일치 여부를 확인하며, 외부 역법 자료를 통한 독립적인 사주 정확성 검증을 주장하지 않는다.

실제 동작 변화는 은하 관계 인사이트의 `elementStatus`에 들어가는 오늘의 일간·오행 표시다. 관계 분류, 제목, 문구, 행동 팁, 친구 순서 및 본인 제외 동작은 원본 helper와 비교했다. 원본 커밋의 `galaxy-helper.ts`도 직접 불러와 현재 노드 결과와 비교했으며 일치했다. 이 비교에 사용한 공용 계산기와 노드 의존 파일은 기준 커밋과 동일하다. 입력 자료는 합성 객체뿐이며 실제 사용자 기록을 읽지 않았다.

새 `scripts/qa/daily-orbital-calendar.mjs`는 별도 Node 프로세스의 실제 `TZ` 변환을 사용한다. 무인자 `Date`와 `Date.now()`만 합성 시계로 고정하며 날짜 getter나 DST 변환은 대체하지 않는다. UTC, 서울, 뉴욕, 베를린, Lord Howe, Kiritimati, Honolulu, Kathmandu의 8개 시간대에서 공통 61개 날짜와 실행 환경의 2026년 DST 경계를 검사했다. 1900·2000·2100년의 윤년 예외, 2024년 윤일, 2024·2026년의 모든 월 첫날·말일, 연말·연초를 포함한다.

총 499개 시간대별 날짜 사례를 각각 00:30·12:30·23:30에 실행했다(1,497개 관찰). 뉴욕·베를린의 23/25시간 날짜와 Lord Howe의 23.5/24.5시간 날짜에서도 다음 달력 날짜의 일간은 한 단계 진행했다. 원본 후보를 검사한 530개 검사는 384개 실패하고 종료 코드 1을 반환했다. 수정 후 같은 530개 검사는 모두 통과하고 종료 코드 0을 반환했다. 시간대별 관계 결과 110건, 총 880건도 일치했다. 알려진 생시 00:00·23:30 및 생시 미상 분석의 일주와 공용 일주가 일치하는지도 확인했다.

기존 일일 화면 DOM 회귀는 UTC·서울·뉴욕·Lord Howe에서 각 8개, 총 32개 통과했다. 지도 로딩 DOM 회귀 7개와 로컬 통합 검사 23개도 통과했다. 지도 DOM 검사는 3D와 일일 helper를 대체하므로 로딩·탐색 회귀에 대한 근거다. 타입 검사와 변경된 코드의 ESLint는 오류 없이 통과했고 빌드도 성공했다. 빌드에는 기존의 큰 청크 및 일부 경로 분류 안내가 남아 있다.

Node 22.13 이상과 기존 저장소 의존성을 설치한 일반 clone에서 다음과 같이 재실행할 수 있다. 원본 비교에는 위 기준 커밋의 Git 객체가 필요하므로 shallow clone이면 해당 커밋을 먼저 가져와야 한다. `before` 실행의 종료 코드 1은 원본 불일치의 기대 결과다.

```bash
npm run install:ci
SAJU_QA_PHASE=before node scripts/qa/daily-orbital-calendar.mjs
node scripts/qa/daily-orbital-calendar.mjs
npx tsc --noEmit --incremental false
npx eslint lib/saju/daily-orbital.ts scripts/qa/daily-orbital-calendar.mjs
npm run build
node scripts/integration-preview.mjs
```

DOM 검사는 QA 전용 임시 디렉터리에 설치한 `jsdom@26.1.0`을 `SAJU_QA_JSDOM_PATH`로 지정했다. 앱의 의존성은 변경하지 않았다. 일일 화면 명령은 `TZ=Etc/UTC`를 위 네 시간대로 바꿔 실행한다.

```bash
TZ=Etc/UTC SAJU_QA_JSDOM_PATH=/absolute/qa-tools/node_modules/jsdom/lib/api.js node --test --test-reporter=tap scripts/qa/daily-rollover-dom.mjs
SAJU_QA_JSDOM_PATH=/absolute/qa-tools/node_modules/jsdom/lib/api.js node --test --test-reporter=tap scripts/qa/guin-map-loading-dom.mjs
```

원본·수정 후 JSON 보고서와 원시 로그는 Git에서 제외되는 `outputs/galaxy-day-calendar/`에 보존했다. 통합 검사는 폐기 가능한 로컬 DB와 합성 신원, AI mock만 사용했다. 실제 계정 로그인, 운영 DB, 브라우저 WebGL 및 실기기 시각 검증은 실행하지 않았다. 은하 화면의 자동 날짜 갱신 타이머를 새로 추가하지 않았으며 해당 동작의 확장도 주장하지 않는다.

업로드 범위는 helper, 이 검사 스크립트, 이 문서의 세 파일이다. main 병합, PR, 배포, 인증 및 권한 변경은 수행하지 않는다. 모델·재질·화면 외형은 이 수정 범위에 포함하지 않는다.
