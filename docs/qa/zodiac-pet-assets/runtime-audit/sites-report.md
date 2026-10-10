# 기존 12지 동물 연결 조사 — 2026-10-10

읽기 전용 조사입니다. 원본 소스, 모델, DB, 인증, 배포를 변경하지 않았습니다.

Native Sites `get_site_version`은 v29 원본 소스를 `aa41b1a3601c5254c28bc5a4c853cd5efa50c5cc`, v30 원본 소스를 `a5535893645f35d4000ec773bff61caef19463cf`로 확인했습니다. [Native 출처](native-version-provenance.json). 현재 live 배포의 공개 범위를 다시 조회한 것은 아닙니다.

두 버전의 `lib/planet/spirit-zodiac-pet.ts` SHA256은 모두 `d6e8384d03f1a3eec3ec0f916fb9212ac10c14aa32f41c0d8751892ea54b0daa`입니다. 동물 생성기는 GLB 주소를 참조하지 않고 Sphere/Cylinder/Tube geometry로 12개 임시 동물을 만듭니다. `assetStatus`는 `procedural-placeholder`입니다. [v29 생성기](/workspace/saju-sites-live-v29-20261010/lib/planet/spirit-zodiac-pet.ts:8).

기존 v29/v30 dist 및 저장된 로컬 v30 tar의 pet client chunk SHA256은 모두 `7c82774e4216e426f0cbd123e5414699afb8addbf19186ca858d632aa5d665d5`입니다. 이 chunk에도 `procedural-placeholder`가 있으며 `/models/zodiac-pets/` 문자열은 없습니다. 로컬 tar의 전체 SHA256 `265ca97bb0767cd99af83fb2510a4d94df1f060633bd7d947076593913645133`는 Native v30 `archive_storage.content_hash`와 다르므로 Native archive와 byte-identical이라고 주장하지 않습니다.

현재 작업 브랜치 검사 시점은 `d3fe9a7aeea083c726458295b4b842268043dd4c`입니다. `loadZodiacPet`은 검증된 authored GLB를 불러올 수 있지만, manifest 12행이 모두 `missing-source`이며 `file/version/sha256`은 null입니다. 현재 approved body 경로에서는 12개 모두 기존 임시 동물로 되돌아가며 동물 URL을 요청하지 않습니다. [현재 로더](/workspace/saju-spirit-attached-effects-20261010/lib/planet/spirit-zodiac-pet.ts:71), [현재 manifest](/workspace/saju-spirit-attached-effects-20261010/public/models/zodiac-pets/manifest.json:11), [조사 시점 manifest 사본](current-feature-manifest-snapshot.json).

| 일지 | 동물 | v29/v30 절차형 형태 | v29/v30 동물 URL | 현재 작업 브랜치 | 원본 참조 |
|---|---|---|---|---|---|
| 자 | 쥐 (rat) | [둥근 귀·긴 꼬리](/workspace/saju-sites-live-v29-20261010/lib/planet/spirit-zodiac-pet.ts:61) | 없음 | missing-source → 동일 임시 동물 | 미확인 |
| 축 | 소 (ox) | [뿔·주둥이·발굽](/workspace/saju-sites-live-v29-20261010/lib/planet/spirit-zodiac-pet.ts:65) | 없음 | missing-source → 동일 임시 동물 | 미확인 |
| 인 | 호랑이 (tiger) | [둥근 귀·몸 줄무늬·꼬리](/workspace/saju-sites-live-v29-20261010/lib/planet/spirit-zodiac-pet.ts:75) | 없음 | missing-source → 동일 임시 동물 | 미확인 |
| 묘 | 토끼 (rabbit) | [긴 귀·둥근 꼬리](/workspace/saju-sites-live-v29-20261010/lib/planet/spirit-zodiac-pet.ts:84) | 없음 | missing-source → 동일 임시 동물 | 미확인 |
| 진 | 용 (dragon) | [긴 몸·갈라진 뿔·팔다리](/workspace/saju-sites-live-v29-20261010/lib/planet/spirit-zodiac-pet.ts:88) | 없음 | missing-source → 동일 임시 동물 | 과거 Dragon C, 2745a970… |
| 사 | 뱀 (snake) | [똬리·몸무늬](/workspace/saju-sites-live-v29-20261010/lib/planet/spirit-zodiac-pet.ts:101) | 없음 | missing-source → 동일 임시 동물 | 미확인 |
| 오 | 말 (horse) | [긴 목·갈기·꼬리](/workspace/saju-sites-live-v29-20261010/lib/planet/spirit-zodiac-pet.ts:109) | 없음 | missing-source → 동일 임시 동물 | 미확인 |
| 미 | 양 (sheep) | [양털 고리·굽은 뿔](/workspace/saju-sites-live-v29-20261010/lib/planet/spirit-zodiac-pet.ts:116) | 없음 | missing-source → 동일 임시 동물 | 미확인 |
| 신 | 원숭이 (monkey) | [얼굴 패치·말린 꼬리](/workspace/saju-sites-live-v29-20261010/lib/planet/spirit-zodiac-pet.ts:124) | 없음 | missing-source → 동일 임시 동물 | 미확인 |
| 유 | 닭 (rooster) | [볏·부리·날개·꼬리깃](/workspace/saju-sites-live-v29-20261010/lib/planet/spirit-zodiac-pet.ts:129) | 없음 | missing-source → 동일 임시 동물 | 미확인 |
| 술 | 개 (dog) | [처진 귀·가슴·꼬리](/workspace/saju-sites-live-v29-20261010/lib/planet/spirit-zodiac-pet.ts:138) | 없음 | missing-source → 동일 임시 동물 | 미확인 |
| 해 | 돼지 (pig) | [넓은 코·콧구멍·말린 꼬리](/workspace/saju-sites-live-v29-20261010/lib/planet/spirit-zodiac-pet.ts:143) | 없음 | missing-source → 동일 임시 동물 | 과거 pig limb candidate, d1c6f862… |

이 동물 선택은 출생연지의 띠가 아니라 **일지**입니다. v29/v30에서 [사주 snapshot](/workspace/saju-sites-live-v29-20261010/lib/universe-state.ts:51) → [planet 페이지](/workspace/saju-sites-live-v29-20261010/app/planet/page.tsx:64) → [ElementalSpiritCanvas](/workspace/saju-sites-live-v29-20261010/components/planet/ElementalSpiritCanvas.tsx:118) → [approved body의 dayKey[1]](/workspace/saju-sites-live-v29-20261010/lib/planet/approved-jade-spirit.ts:108) 순서로 전달되며 현재 작업 경로도 [동일 일지](/workspace/saju-spirit-attached-effects-20261010/lib/planet/approved-jade-spirit.ts:144)를 사용합니다. 잘못된 branch 값은 자/쥐로 기본 선택됩니다. `createElementalSpirit` legacy 경로는 현재도 synchronous procedural factory를 직접 사용하지만 조사한 app/components 호출에서는 사용되지 않습니다.

과거 QA도 12개를 distinct matte animal placeholders로 검사했고, 전용 동물 모델을 공급받지 않았다는 당시 제한을 명시했습니다. [QA assertion](/workspace/saju-sites-live-v29-20261010/scripts/qa/spirit-depth-pets.mjs:65), [당시 report 제한](/workspace/saju-sites-live-v29-20261010/docs/qa/spirit-depth-pets/depth-pets-report.json:6553). 이는 그 버전의 연결 상태를 입증하며 다른 작업이나 저장소에 있는 원본 모델의 존재 여부를 부정하지 않습니다.

[보존 보고서 사본](archive-preservation-report.txt:20)은 2026-10-09의 historical preservation set이고 complete backup이 아니라고 명시합니다. 용 C SHA256 `2745a970701c86a3bc74eb0008b597607022a5c7ee576d79b287970ac977d366`와 돼지 팔다리 후보 SHA256 `d1c6f8625b5fb97cdbde102455cdbf181f335942b7cb0f87aeb07a7fc0fba290`는 그 보고서의 누락 참조이며 실제 파일명, source version ID, 승인 정보가 없습니다. 두 모델의 실제 제작 순서를 independently 입증할 timestamp도 없습니다. 사용자가 지칭한 이전 용 C와 현재 최신 돼지 모델을 같은 최신 버전으로 취급할 수 없습니다.

현재 manifest의 Dragon `missingVersion: Latest selected Dragon C`와 `latestApprovedStatus: missing`은 현재 최신 승인본까지 확인했다는 인상을 줍니다. 역사 참조 이름과 날짜를 남기고 최신 승인 상태는 `unverified`로 분리하는 것이 근거에 맞습니다. Pig d1c6…도 보고서의 과거 limb candidate이며 사용자가 말한 현재 최신 Pig와 동일 파일인지 미확인입니다. 다른 10개는 이번 범위에서 원본 파일/hash/version의 구체적 증거를 찾지 못했으며 절차형 동물 코드만 확인했습니다. 906 파일/54 GLB 집계의 no-hit을 전체 원본 모델 부재로 확대하면 안 됩니다.

안전한 연결 방법은 기존 `loadZodiacPet`의 routing을 그대로 쓰고, 실제 기존 모델을 식별한 뒤 그 파일/검증 hash/version/사용자가 선택한 버전을 manifest에 연결하는 것입니다. `sourceStatus: available`와 실제 `file/version/sha256`이 모두 있어야 fetch가 시작됩니다. 기존 loader는 파일 SHA256을 확인하고 authored mesh/material/rest pose를 보존하며 외부 presentation group만 균일하게 크기/접지를 맞춥니다. [검증/정규화](/workspace/saju-spirit-attached-effects-20261010/lib/planet/spirit-zodiac-pet.ts:77). 누락 행의 URL을 추측하거나 새 tiger 재구성을 이미 만든 승인 모델이라고 연결하면 안 됩니다. 원본 추가 파일이나 출처가 확보되기 전까지 실제 12 원본 연결은 미확인 상태입니다.

[기계 판독 연결표](runtime-linkage.json)에 source/build hashes, 12행 상태, 전체 제한을 저장했습니다.
