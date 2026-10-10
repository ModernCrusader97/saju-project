# 정령 패션 v1 비공개 후보

2026-10-10에 직접 제작한 새 구현이다. 보존 체크포인트의 기준은 `96150b21de463574859c6574c481a5f1ec4e8400`이다. 소실된 패션 원본이나 사용자 승인 완료 자산을 복원했다는 주장은 하지 않는다. 기본 조합은 네 슬롯 모두 미착용이며 승인된 B형 조형, 눈, 원본 POSITION/NORMAL/UV/index, 몸체의 depth 1.35와 동반 펫을 변경하지 않는다.

## 구현 범위

| 슬롯 | 직접 생성한 아이템 |
| --- | --- |
| 머리 | 새싹 핀, 초승달 핀 |
| 얼굴 | 동그란 선글라스, 곡면 마스크 중 하나 |
| 목 | 작은 리본 |
| 등 | 잎사귀 등 장식 |

6개 공통 아이템에 십간별 10개 색상/금속성/거칠기 조합을 제공한다. 60개의 별도 원본 모델을 만들었다는 의미가 아니다. 선글라스의 짙은 렌즈와 마스크는 사용자 요청에 따라 표정을 의도적으로 가릴 수 있다. 머리 전체를 덮는 모자, 더 많은 정령별 독자 디자인, 직물 물리와 전체 동적 충돌 처리는 아직 구현하지 않았다.

`lib/planet/spirit-fashion-catalog.ts`가 아이템, 슬롯, 십간 재질을 정의하고 `lib/planet/spirit-fashion.ts`가 Three geometry를 직접 생성한다. 구매, 외부 에셋 다운로드, 외부 텍스처 복제, Library 403 우회는 없다. 몸체 재질과 아이템 재질은 별개다.

## 부착과 부분 효과 가림

머리·얼굴·목·등 지지점은 실제 승인 GLB에 ray를 쏘아 삼각형 번호와 barycentric 좌표를 얻는다. 각 프레임 `mesh.getVertexPosition`으로 현재 지지 삼각형을 다시 해석해 위치와 실제 표면 노말을 따른다. 고정 몸체 depth를 부착 위치에 반영하고 장식 자체의 깊이 비율은 보존한다. 선글라스 테와 마스크 곡면도 실제 몸체 표면 교차점에서 생성한다.

`FashionSurfaceProjector`는 실제 삼각형의 XY 인덱스다. 표면을 구체나 박스로 대신하지 않는다. 축 방향이 아닌 ray와 스키닝에는 기존 Three raycaster로 되돌아가며, morph 가중치나 원본 attribute 버전이 달라지면 새 착용을 만들 때 인덱스를 갱신한다. 원본 GLB 버퍼는 수정하지 않는다.

아이템이 차지하는 작은 영역을 몸체·표정·표면 효과와 같은 `ApprovedSpiritMotion` 부모의 `surfaceAttachmentExclusions`로 발행한다. 매 프레임 모션 포즈를 적용한 뒤 부착점과 제외 영역을 갱신하고, 그 다음 표면 효과를 갱신한다. 공통 helper는 실제 현재 transform을 적용한다. 해당 부위의 가지·덩굴·이슬 부착 인스턴스만 가리며 몸체 재질, 전체 효과, 안정된 seed 번호를 바꾸지 않는다. 해제와 재착용은 같은 시간의 원래 인스턴스 행렬을 복구한다. 새 공통 불꽃 라우터도 장식과 겹친 발화 지점의 가시성만 가리며, 원래 particle seed·비행 행렬·age 데이터는 해제 시 복구한다. 불꽃의 비행이나 직물과의 물리 충돌을 시뮬레이션했다는 주장은 하지 않는다.

실제 원본 `Gentle_wave_pose`의 0.45 이하 손 인사와 작은 idle 위치·회전·호흡을 공유하는 부모에 통합했다. 십간마다 실제 loader로 최대 포즈 근처의 0.445 초과 가중치를 만들어 두 얼굴 장식의 지지 삼각형·현재 표면 노말·제외 영역·몸체 관통 표본을 확인했다. 초기화는 옷을 유지하면서 중립 모션으로 돌아간다. 원본 morph target 버퍼도 보존한다.

## UI와 저장

정령 화면 아래 패널에서 슬롯별 착용, 교체, 해제와 전체 해제를 한다. 한 슬롯에 두 아이템을 동시에 둘 수 없으며 다른 슬롯은 독립적으로 조합한다. 정령 시점을 초기화해도 선택한 옷은 유지한다. 패션 변경은 캡처/여권 이미지의 식별값에도 반영돼 이전 착용 이미지가 재사용되지 않는다.

기존 서버 패션 저장 경로는 없었다. 새 브라우저 키 `saju.spirit-fashion.v1`에 `{version:1,outfits:{갑,...,계}}`만 저장한다. 십간별 조합을 분리하고 누락 슬롯, 잘못된 슬롯의 ID, 손상 JSON, 알 수 없는 버전은 안전하게 미착용으로 복구한다. 기존 패션 스키마가 없어 이전 서버 데이터의 migration은 없다. 저장 권한/용량 오류 시 현재 화면은 계속 동작하고 이번 화면에서만 착용된다고 알린다. 계정 간 또는 서버 동기화가 아니다. DB, 인증, 결제, 접근 권한을 바꾸지 않는다.

## 완료된 검증과 대기 범위

- 실제 GLB 기반 CPU 13개: 슬롯/버전/저장 복구, 원본 버퍼 보존, 부착 삼각형과 노말, 저/고품질 관통 표본, 변경된 삼각형 추종, 반복 교체·해제와 dispose once, 부분 효과 가림/복구. 공간 인덱스는 중립/0.45 morph의 실제 앞/뒤 ray 224개를 native raycasting과 비교한다. 십간 × 두 얼굴 장식의 실제 손 인사 포즈 20개에서 부착과 제외 영역도 검증했다. 저품질 덩굴 경로와 현재 네 아이템이 겹치지 않는 경우는 그대로 보이고, 별도의 실제 보이는 덩굴 segment에 작은 구 영역을 적용해 부분 가림/복구를 검증한다.
- 새 motion 통합 전 소스 harness에서는 40개 WebGL 조합의 같은 시간 화면/효과 복구와 GPU 해제를 통과했다. 최종 기준의 새 40개 조합과 exact Worker 검증은 현재 대기 중이며, 이 이전 결과를 최종 빌드 검증으로 간주하지 않는다.
- 실제 production Canvas 소스 + 패널 + hook의 React harness: StrictMode, 모바일 크기, 조합과 얼굴 슬롯 교체, 정령 전환, 새로고침 저장 복구, 일시정지 중 회전, 시점 초기화, 원본 blink/손 인사 프레임, 재생, 전체 해제, unmount를 확인했다. 손상 JSON/알 수 없는 버전의 실제 reload 복구와 저장 quota 거부 후 계속 착용되는 UI도 통과했다. 이 소스 harness 결과와 아직 대기 중인 exact Worker 검증을 구분한다.
- 최대 네 아이템: 저품질 3,204 triangles, 고품질 9,156 triangles, 21개 아이템 draw calls. 구현 상한 16,000 triangles/28 draw calls. QA 호스트의 동기 착용 생성 예산은 300ms이며 새 motion 통합 전 측정은 4개 생성 13.4–64.3ms, 마스크 교체 2.9–31.6ms였다. 최종 기준의 성능 측정은 후속 GPU 검증에서 기록한다.
- 이전 소스 WebGL 검증의 GPU buffer는 4,787개 생성/4,787개 해제/잔류 0이었고, 최종 빌드의 GPU 결과는 아직 미실행이다. 렌더러의 transmission target은 실제 jade/dew 경로를 미리 그린 뒤 일정한 해제 기준을 비교하고 마지막 renderer.dispose도 확인한다.
- TypeScript, build, 관련 실제 십간 CPU 25개, 기존 펫 loader 8개, visibility 8개 통과. 대상 lint는 오류 0개, 기존 `<img>` 경고 1개.

별도 read-only 리뷰는 `96150b2` 기준으로 구체적인 Critical/Important 문제를 발견하지 않았으며, 실제 삼각형 노말, 실패한 교체의 원자적 복구, 반복 dispose와 이전 제외 영역 복구를 확인했다. 원본 자산 172개와 기존 파일 558개를 비교해 네 통합 파일 외 기존 코드는 동일했다. 새로 발견된 기존 context-restore 결함의 검증된 수정과 fresh 40개 조합/최종 Worker QA는 후속 체크포인트로 남긴다. 현재 빌드 Worker SHA는 `d0a540a7b6a5f785c6790aa63796597e38f88234f65b65a3730e05f2e3c6e863`이며, 이 빌드를 대상으로 한 GPU 검증은 미실행이다.

시각 검증은 로컬 Chromium SwiftShader다. 실제 기기/GPU 또는 인증된 hosted 접속의 시각 검증으로 과장하지 않는다. 패션은 현재 배포하지 않았고 별도 비공개 후보다. 효과 배포에 자동 포함하지 않는다.

## 재생성/재검증

```bash
node scripts/sync-approved-jade-assets.mjs
node --test scripts/qa/spirit-fashion-cpu.mjs
node scripts/qa/spirit-fashion-browser.mjs
npx tsc --noEmit --incremental false
npm run build
```

Browser QA의 기본 Playwright 경로가 없는 환경에서는 `SAJU_QA_PLAYWRIGHT_PATH`, Chromium 경로는 `SAJU_QA_CHROME`으로 지정한다. 코드 제작이므로 별도 다운로드된 패션 원본이나 수작업 내보내기가 필요 없다. `createSpiritFashion`이 checksum 보존된 B형 런타임 GLB를 기준으로 동일 geometry와 재질을 재생성한다.
