# 기존 12지 생성 소스·연결 조사 — 2026-10-10

기존 12지 전체를 만드는 `createZodiacPet` 소스는 소실되지 않았고, 현재 검토 브랜치의 로더에서도 그대로 호출됩니다. 별도 동물 GLB의 미확보 상태와 기존 생성 코드의 보존 상태는 구분해야 합니다. 새 호랑이 후보 `2c25d0a9c9a339d9d3c37682a04bbe01c8c76b47`는 이번 조사에서 기존 원본 증거로 사용하지 않았습니다. 제작·변경·스테이징·커밋·push·배포는 수행하지 않았습니다.

## 확인한 범위

- 비공개 `ModernCrusader97/saju-project`의 원격 29개 head를 2026-10-10 02:29:50 UTC에 읽었습니다. 모두 `/workspace/saju-project/.git` 또는 `/workspace/saju-sites-live-v29-20261010/.git`의 기존 객체로 접근 가능했습니다. Git fetch나 인증 변경은 필요하지 않았습니다.
- 두 Git 공통 저장소의 로컬 refs·원격 head가 가리키는 88개 고유 커밋과, refs에 없는 로컬 commit 객체 2개를 확인했습니다. 총 90개 커밋이며, 추가 두 커밋도 동일한 12지 생성기와 기존 모델 자산을 보유합니다.
- 이력의 33개 Python 생성기 경로·버전과 관련 소스 562개 고유 blob, 4,426,721바이트의 클라우드 보존 inventory를 조사했습니다. 새 호랑이 생성기를 제외한 Python 소스에서 별도 12지 동물 생성기는 발견하지 못했습니다. 이 결과는 해당 경로·이력에 한정됩니다.
- 작업공간의 모델·생성기 관련 파일 1,986개를 SHA-256으로 묶으면 62개 내용입니다. GLB 877개 경로는 17개 고유 내용이며 새 호랑이 1개를 제외하면 16개입니다. 중복 작업 트리·생성 출력 복사본은 독립 작품 개수로 세지 않았습니다.
- Git 이력의 직접 GLB 경로·버전은 20개이며 새 호랑이를 제외한 19개는 B·오행·porcelain 자료입니다. 두 보존 브랜치 ZIP은 중첩·중복을 포함해 35개 컨테이너(27개 고유 ZIP SHA), GLB 61개 멤버(53개 고유 GLB SHA)를 읽어 JSON 메시·노드·애니메이션 이름을 확인했습니다. 앞선 906파일/54GLB 조사는 별도의 한정된 보존 조사이며 전체 원본 부재의 증명이 아닙니다.
- `.agents`, `AGENTS.md`, `SKILL.md`는 조사한 `/workspace` 및 해당 Git 경로에 없었습니다. `.env`·비밀 파일·DB 파일은 읽지 않았고 Library 403 재시도나 외부 환경 접근은 하지 않았습니다.

## 소스와 연결을 구분하는 기준

**S — 기존 전체 동물 생성기.** `dffb235fbe47c063b8535a21b4fdf3ea8235d6aa`의 `lib/planet/spirit-zodiac-pet.ts:10`에서 12종의 몸통·발·머리·귀·코·꼬리를 생성합니다. 자연색 `MeshStandardMaterial`, 눈, 작은 고개 움직임, 높이 .66·폭 .62·깊이 .85의 정규화도 포함합니다. 파일 11,515바이트, SHA-256 `d6e8384d03f1a3eec3ec0f916fb9212ac10c14aa32f41c0d8751892ea54b0daa`, Git blob `8595a73296087b93c34487dad9b55174cc396238`입니다. `43e2d8d`, `de85ce2`, `e0c99c1`, `a553589`에서도 파일 전체가 동일합니다. 원래 코드의 8–9행은 이를 임시 조형으로 기술하므로, 소스가 존재한다는 사실을 별도 GLB 승인 또는 사용자 선택 원본과 동일하다는 주장으로 확장하지 않습니다.

**A — 더 이른 12지 머리 장식·월지 동반자.** `2e2d82b05f87b39ff8057ae914e8dfa01100a974`의 `lib/planet/spirit-zodiac.ts:32`는 12종 머리 장식을 생성하고, `spirit-month-pet.ts:10`은 공통 작은 몸통·머리에 그 장식을 붙입니다. SHA-256은 각각 `85794f6f3e24eb497580069e667ad4b4be557eb8e846870e8c7cc2a2d7515303`, `cad13d8f90558d7bf202fc61af7fef3d3e36329c55706eb1646beaeb1d7188a4`입니다. `docs/SOURCE_MANIFEST.json:539` 및 `:533`는 이를 source commit `843a4a088a9e20760421b4c81f890d026a53ae6b`의 `site-source-v23`로 기록합니다. `956fe6e…`의 `source/saju-source-candidates-and-qa--part-04.zip!saju_planet_preview/lib/planet/`에도 같은 원본 코드가 있습니다. 독립적인 전신 GLB 12개와 같은 의미로 취급하지 않습니다.

**R — 현재 검토 브랜치 연결.** `f7e99f144223d1497238767c26d10ec9f6e2002b`의 `approved-jade-spirit.ts:136` → `loadZodiacPet(dayKey.charAt(1), quality)` → `spirit-zodiac-pet.ts:74` → 기존 `createZodiacPet`(`:119`)입니다. 12개 manifest entry 모두 별도 authored GLB가 `missing-source`이고 `file/version/sha256`이 null이므로 S를 호출합니다. `elemental-spirit.ts:65`도 S를 직접 호출합니다. 현재 anatomy·재질·정규화·idle 구간 SHA-256은 `19058b23183635624a0fd0aa1441454b19e849192f109d2ad51316b45001f6d0`으로 S와 같습니다. loader 추가는 provenance 및 소유 자원 cleanup을 추가했으며 전신 생성기를 다른 조형으로 교체하지 않았습니다.

현재 main `2e2d82b`의 `elemental-spirit.ts:102`는 일지 머리 장식, `:109`는 월지 동반자 A를 연결합니다. 이후 `43e2d8d`의 `approved-jade-spirit.ts:108` 및 `elemental-spirit.ts:65`는 일지 전신 동물 S를 연결합니다. `de85ce2`에서는 전자가 `:131`, `a553589`에서는 `:108`입니다. main만 조사하면 이후 일지 전신 생성기가 보존된 사실을 놓칠 수 있습니다. 실제 v29/v30 배포·UI 경로는 다른 담당자의 조사 범위입니다.

기존 시각 기록 `docs/qa/spirit-depth-pets/twelve-pets.png`도 직접 열어 확인했습니다. 12종이 함께 표시된 원래 이미지이며 제목은 “일지의 12지 동반자 · 임시 조형”, 설명은 “동물별 형태·무광 재질 시안입니다. 전용 동물 모델의 완성본이 아닙니다.”입니다. dffb 원본과 f7의 이미지 바이트는 동일합니다: 124,773바이트, SHA-256 `526f9654f18f23f29318f77190b4e0dfdb8e62baf415b900b2216f3dc08d2af2`, Git blob `d30565b478eca154cfe47e1a6a617936db3de1a1`. 기존 S의 시각 기록으로 보존하며 새 렌더나 별도 수작업 동물 승인 증거로 설명하지 않습니다.

## 12지별 증거

각 행의 S 버전·소스 SHA는 위 공통 값입니다. 현재 R은 검토 브랜치 f7이며 실제 운영 배포를 의미하지 않습니다. URL 없음은 별도 동물 GLB URL을 설정하지 않았다는 뜻이고 생성 코드가 없다는 뜻이 아닙니다.

| 지지·동물 | 기존 S 위치 → 현재 R 생성 위치 | 보존된 조형 | 현재 연결 | 별도 GLB URL·버전·SHA | 불확실성·장애 |
|---|---|---|---|---|---|
| 자·쥐 | `spirit-zodiac-pet.ts:61` → `:170` | 둥근 귀·주둥이·긴 꼬리·몸통·발 | R → S, CPU 일치 | URL/버전/SHA null; S 소스 보존 | 별도 선택·승인 GLB의 버전 근거 미확인 |
| 축·소 | `:65` → `:174` | 넓은 코·뿔·발굽·꼬리 | R → S, CPU 일치 | URL/버전/SHA null; S 소스 보존 | 별도 선택·승인 GLB의 버전 근거 미확인 |
| 인·호랑이 | `:75` → `:184` | 둥근 귀·볼/몸 줄무늬·꼬리·몸통·발 | R → S, CPU 일치 | URL/버전/SHA null; S 소스 보존 | 새 v001 호랑이는 기존 원본 증거에서 제외·미배포 |
| 묘·토끼 | `:84` → `:193` | 긴 귀·작은 코·둥근 꼬리·몸통·발 | R → S, CPU 일치 | URL/버전/SHA null; S 소스 보존 | 별도 선택·승인 GLB의 버전 근거 미확인 |
| 진·용 | `:88` → `:197` | 구불구불 몸통·뿔·팔/발·긴 코·꼬리 | R → S, CPU 일치 | URL/버전/SHA null; 이전 Dragon C 기대 SHA `2745a970…` | 조사 GLB에는 해시 일치 없음; S와 Dragon C 동일성·현재 최신/승인 여부 미확인 |
| 사·뱀 | `:101` → `:210` | 코일 몸통·작은 머리·등 무늬 | R → S, CPU 일치 | URL/버전/SHA null; S 소스 보존 | 별도 선택·승인 GLB의 버전 근거 미확인 |
| 오·말 | `:109` → `:218` | 목·긴 코·갈기·발굽·꼬리 | R → S, CPU 일치 | URL/버전/SHA null; S 소스 보존 | 별도 선택·승인 GLB의 버전 근거 미확인 |
| 미·양 | `:116` → `:225` | 양털 덩이·말린 뿔·몸통·발 | R → S, CPU 일치 | URL/버전/SHA null; S 소스 보존 | 별도 선택·승인 GLB의 버전 근거 미확인 |
| 신·원숭이 | `:124` → `:233` | 밝은 얼굴·둥근 귀·말린 꼬리·몸통·발 | R → S, CPU 일치 | URL/버전/SHA null; S 소스 보존 | 별도 선택·승인 GLB의 버전 근거 미확인 |
| 유·닭 | `:129` → `:238` | 부리·볏·육수·날개·다리·꼬리깃 | R → S, CPU 일치 | URL/버전/SHA null; S 소스 보존 | 별도 선택·승인 GLB의 버전 근거 미확인 |
| 술·개 | `:138` → `:247` | 처진 귀·주둥이·가슴·올린 꼬리·몸통·발 | R → S, CPU 일치 | URL/버전/SHA null; S 소스 보존 | 별도 선택·승인 GLB의 버전 근거 미확인 |
| 해·돼지 | `:143` → `:252` | 귀·넓은 코·콧구멍·말린 꼬리·발굽 | R → S, CPU 일치 | URL/버전/SHA null; 기록된 팔다리 후보 기대 SHA `d1c6f862…` | 조사 GLB에는 해시 일치 없음; S가 최신 팔다리 후보라는 근거 없음 |

## 용 C·돼지 해시의 출처와 의미

최초로 확인한 기록은 `956fe6e2a7f3de3a0aabe3c59d9d5db3795c7123:archives/2026-10-09-local-authoring/PRESERVATION_REPORT.md:22–23`입니다.

- 이전에 기록된 Dragon C: `2745a970701c86a3bc74eb0008b597607022a5c7ee576d79b287970ac977d366`.
- 기록된 돼지 팔다리 후보: `d1c6f8625b5fb97cdbde102455cdbf181f335942b7cb0f87aeb07a7fc0fba290`.

보고서는 두 항목을 당시 “Latest”라고 불렀으나 모델 파일명·다운로드 URL·원본 생성기·후보 간 날짜·선택/승인 기록은 제공하지 않습니다. 현재 사용자 설명에 따라 Dragon C를 **이전에 기록된 Dragon C**로 기술하고, 최신 또는 승인된 버전이라는 단정은 피해야 합니다. Pig는 별도 팔다리 후보 기록이며 현재 S 돼지를 해당 후보와 동일하다고 주장할 수 없습니다. 나머지 10종에 이 두 해시의 상태를 일반화할 수 없습니다.

`public/models/zodiac-pets/manifest.json:65–67`, `:142–144`와 `docs/qa/zodiac-pet-assets/README.md:34–35`의 “Latest selected Dragon C”·“latestApprovedStatus: missing”은 보존 보고의 문구를 파생시킨 메타데이터입니다. 원본 모델 승인 증거로 독립 검증되지 않았습니다. 현재 manifest의 `missing-source`는 별도 authored GLB 범위에 한정되며 S의 소스 존재를 부정하지 않습니다. 원본 기록은 보존하고, 이후 설명에는 생성 코드 보존·연결 상태와 별도 GLB 상태를 명시하는 것이 정확합니다.

## 검증과 미실행

`node --test scripts/qa/zodiac-pet-loader.mjs`: 8/8 통과. 실제 f7 생성기와 로더를 CPU에서 실행해 dffb 원본 생성기와 12지 × high/low를 비교했습니다. 시간 `0 → 1.25 → 4 → 0`에서 메시 POSITION/NORMAL/UV/index 해시, 재질 색·roughness·metalness·emissive, 계층·변환·shadow, idle·reset가 192회 모두 일치했고 별도 동물 URL 요청은 0회였습니다. 발바닥·정규화 크기도 기존 계약을 만족했습니다.

기존 생성기의 연결 누락이나 조형 교체는 이 검사에서 확인되지 않았습니다. 화면이 기대한 수작업 동물과 다르다면, 그 수작업 원본의 파일·버전·선택 기록과 S가 같은 대상인지 추가 근거가 필요합니다. 이번 읽기 전용 조사로 새 모델을 만들거나 현재 생성기를 GLB로 내보내지 않았습니다.

타입/빌드·새 브라우저 렌더·실물 GPU·원본 동물 승인 검사는 이번 조사에서 실행하지 않았습니다. 코드 변경이 없고 v29/v30 런타임 조사는 별도 담당자 범위입니다. Library 및 다른 환경의 원본 존재 여부를 조사하지 않았으므로 전 세계/전체 역사 원본 부재를 주장하지 않습니다.

지원 자료: `saju-existing-zodiac-remote-heads.json`, `saju-existing-zodiac-git-inventory.json`, `saju-existing-zodiac-extra-history-scan.json`, `saju-existing-zodiac-generator-parity.json`, `saju-existing-zodiac-cpu-parity.json`, `saju-existing-zodiac-parity.cjs`, `saju-existing-zodiac-glb-identities.json`, `saju-existing-zodiac-workspace-inventory.json`, `saju-existing-zodiac-archive-source-scan.json`, `saju-existing-zodiac-large-inventory-scan.json`, `saju-existing-zodiac-visual-provenance.json` (모두 `/tmp`). 전체 출력 경로와 SHA-256은 `saju-existing-zodiac-handoff-hashes.json`에 있습니다.
