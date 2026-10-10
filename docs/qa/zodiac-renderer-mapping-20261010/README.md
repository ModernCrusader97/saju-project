# 12지 렌더러 매핑 검증 보완 — 2026-10-10

이번 변경은 **QA 스크립트 한 건과 출처/결과 기록**이다. 확인된 현재 12지 연결 누락·중복은 **0개**이며, 제품 로더·생성기·모델·manifest를 수정하거나 모델을 교체하지 않았다. 최신 외형 피드백의 최종 반영 여부가 불명확하므로 기존 생성기를 유지했다. 별도 GLB가 없다는 이유로 생성기를 미완성 또는 소실된 원본이라고 판단하지 않는다.

기준은 비공개 원격에서 확인한 v32 보존 커밋 `c6b79d2e1f0e4bf3aa77c948b0b7190d69ad6573`, 별도 작업 브랜치는 `qa/zodiac-renderer-mapping-20261010`이다. 기존 리깅 `9e7d2ed470db89cc6c0179cf9d34a2e05df4cdba`와 은하 `3a6400a328734f4fb08578a4213b91a25a0d294a`는 깨끗한 상태로 유지했고 이 브랜치에 합치지 않았다. 시작 전 관련 작업트리와 현재 에이전트·실행 프로세스를 확인해 같은 12지 작업이 실행 중인 증거는 없었다. 로컬 AGENTS.md/.agents/skills는 확인 범위에서 발견되지 않았다.

## 검사 공백과 효용

기존 `zodiac-pet-loader.mjs`의 8개 계약, 이전 192회 원본/현재 geometry·material·idle 동일성 기록, `spirit-depth-pets.mjs`의 12종 이름/메타데이터/bounds 검사는 그대로 유지했다. 이를 다른 브라우저 검사로 중복 구현하지 않았다.

새 `scripts/qa/zodiac-renderer-mapping.mjs`는 기존 이름 기반 구분 검사로 설명할 수 없는 오류를 보완한다.

- TypeScript AST와 원시 JSON에서 선언을 읽으므로 평가/JSON.parse 때 조용히 덮어쓰이는 **중복 지지 키**도 잡는다. 12개 명시적 case·지지·동물 매핑을 대조한다.
- 실제 메시의 POSITION/index와 동물 내부 변환만으로 조형 식별값을 만든다. 이름·UUID·색상·재질·출처 메타데이터·장면 배치 좌표는 제외한다. high/low 각각 **서로 다른 조형 12개**를 확인한다.
- 실제 승인 GLB를 파싱하는 현행 정령 로더에서 **12지 × 2품질 × 서로 다른 2월지 = 48회** 조립하여 일지 동물의 조형 식별값이 그대로 연결되는지 확인한다.
- 의도적 누락 case, 중복 case, 덮어쓰이는 profile/JSON 키의 네 오류를 검사기가 거부한다. 추가로 메타데이터·이름은 `인/tiger`로 유지하면서 개 조형을 반환하는 **출력 번들 한정 오류**도 거부한다. 올바른 라벨만으로 잘못된 조형을 통과시키지 않는다. 제품 소스에는 이 오류를 쓰지 않는다.

최종 새 검사 **6/6**, 의도적 오류 **5/5 검출**, 기존 로더 **전후 8/8**이다. 실제 Three 객체와 B GLB를 쓰되 image/network I/O만 오프라인 경계로 대체한다. 동물 GLB URL 요청은 **0회**다. [전체 결과](report.json), [출처·보존·실행 범위](provenance.json), 압축 로그가 보존되어 있다.

## 실제 연결과 생성기 출처

확인한 현재 코드 경로는 `ElementalSpiritCanvas.tsx:130 loadApprovedSpirit(dayKey,monthKey,quality)` → `approved-jade-spirit.ts:150 loadZodiacPet(dayKey.charAt(1),quality)` → 현행 `createZodiacPet`의 해당 case다. 승인 로더 반환 장면에 그 동물 그룹이 실제로 붙어 있는지도 48회 모두 확인했다. 월지 변경으로 일지 동물 조형이 바뀌지 않는다. Canvas의 로딩 실패 처리는 다른 동물로 바꾸는 대신 그래픽 오류를 표시한다.

원본 생성기 `dffb235fbe47c063b8535a21b4fdf3ea8235d6aa:lib/planet/spirit-zodiac-pet.ts`를 확보된 원본 저장소에서 직접 읽고 SHA256 `d6e8384d03f1a3eec3ec0f916fb9212ac10c14aa32f41c0d8751892ea54b0daa`를 재확인했다. 공통 저장소에 보존된 Git blob `8595a73296087b93c34487dad9b55174cc396238`도 같은 내용이다. 아래 12개 case의 코드 SHA는 현행 생성기와 원본이 각각 동일하다. 별도 GLB 계약과 생성 코드 보존·연결 상태를 혼동하지 않는다.

| 지지 | 현재 동물 | 원본 → 현행 case 행 | 공통 case SHA256 앞 12자리 | 결과 |
|---|---|---|---|---|
| 자 | rat | 61 → 171 | `18cc0c5137d1` | 연결·대조 통과 |
| 축 | ox | 65 → 175 | `1333737b5c52` | 연결·대조 통과 |
| 인 | tiger | 75 → 185 | `36e09eb778d0` | 연결·대조 통과 |
| 묘 | rabbit | 84 → 194 | `ae0193af2ca9` | 연결·대조 통과 |
| 진 | dragon | 88 → 198 | `6cfbbbde9c7a` | 연결·대조 통과 |
| 사 | snake | 101 → 211 | `18c770e3bbf9` | 연결·대조 통과 |
| 오 | horse | 109 → 219 | `01c2b7dfdb4c` | 연결·대조 통과 |
| 미 | sheep | 116 → 226 | `ef2f81fe9eaa` | 연결·대조 통과 |
| 신 | monkey | 124 → 234 | `7e679aa7d030` | 연결·대조 통과 |
| 유 | rooster | 129 → 239 | `6022cf56f628` | 연결·대조 통과 |
| 술 | dog | 138 → 248 | `458a997b18bc` | 연결·대조 통과 |
| 해 | pig | 143 → 253 | `60048a6416bc` | 연결·대조 통과 |

이전 전체 조사 자료는 [보존된 원본 조사](../zodiac-pet-assets/runtime-audit/saju-existing-zodiac-forensic-20261010.md)와 [기존 외형 피드백 대조](../spirit-integration-20261010/zodiac-current-assessment.md)에 있다. 이번에 전체 이력·개인 디스크·Library를 다시 검색했다고 주장하지 않는다.

## 보존·검증과 미확인 항목

기준의 기존 tracked 파일 **1,101개가 전부 바이트 동일**하다. B 원본/UV/depth1.35/morph, 동물 생성기, planet·pet 재질, APIs/auth/DB schema, dependencies/lock와 배포 코드를 바꾸지 않았다. public body는 기존 `sync-approved-jade-assets.mjs`로 생성했으며 승인 원본과 동일한 SHA256 `0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84`다. 새 작업트리의 동기화 전 첫 실행은 생성 body 파일이 없어 멈췄고, 원본 동기화 후 최종 검사가 통과했다. 제품 결함으로 분류하지 않는다.

TypeScript, 새 QA 스크립트 ESLint, framework/Worker build, git diff 검사도 통과했다. 전역 UI lint 전체 통과를 주장하지 않는다. 이 QA 변경에 대해 새 WebGL/브라우저 렌더나 실제 모바일 GPU 검사를 수행하지 않았다. 기존 GPU 자료는 기존 자료로만 취급한다.

**미확인:** 마지막 눈 수정, 소·돼지 팔다리, 공중 똬리·길고 뱀형인 동양용, 최종 idle 및 각 종의 사용자 승인본 선택. 기존 생성기가 존재·연결되어 있다는 사실만으로 이 피드백이 전부 반영됐다고 판단하지 않는다. 별도 새 호랑이 후보를 승인된 원본으로 간주하거나 임의로 대체하지 않았다.

부모의 리깅 영상 Library 읽기는 403 scope_violation으로 막혀 시각 검토가 계속 보류되어 있다. 해당 파일을 반복 요청·우회·다른 전송으로 전달하지 않았다. main 병합, PR, 배포, 권한·인증·결제 변경은 없다. `.env`, 비밀키, 실제 사용자 DB는 포함하지 않는다.

## 재실행

```sh
node scripts/sync-approved-jade-assets.mjs
node scripts/qa/zodiac-renderer-mapping.mjs
node --test scripts/qa/zodiac-pet-loader.mjs
npx tsc --noEmit
npx eslint scripts/qa/zodiac-renderer-mapping.mjs
npm run build
```

새 검사에는 보존된 Git source blob이 필요하다. 원본 bytes나 실제 모델을 새로 생성하는 검사가 아니며, 생성 번들과 고의 오류 번들은 ignored `outputs/` 안에만 작성한다. 증거 파일 해시는 `SHA256SUMS`에 있다.
