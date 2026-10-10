# 정령 패션 v1 비공개 후보

2026-10-10에 직접 제작한 새 구현이다. 최초 비공개 보존 체크포인트는 `c4570c8f0816a7bfa09a51b3d8a456290e2ff875`이고, 최종 검증 소스 HEAD는 `57f5939ea65a46047b817fc91a2d4345f23b04a4`이다. 공유 context/alpha/Room cleanup 수정이 포함된 기준 `5a8fae1c90f1fbac2a9ee6b00bdce7cab7572dbd`와 제품 파일을 비교했다. 소실된 패션 원본이나 사용자 승인 완료 자산을 복원했다는 주장은 하지 않는다. 기본 조합은 네 슬롯 모두 미착용이며 승인된 B형 조형, 눈, 원본 POSITION/NORMAL/UV/index/morph, 몸체의 depth 1.35와 동반 펫을 변경하지 않는다.

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

## 완료된 검증과 남은 범위

- 실제 GLB 기반 CPU 13개: 슬롯/버전/저장 복구, 원본 버퍼 보존, 부착 삼각형과 노말, 저/고품질 관통 표본, 변경된 삼각형 추종, 반복 교체·해제와 dispose once, 부분 효과 가림/복구. 공간 인덱스는 중립/0.45 morph의 실제 앞/뒤 ray 224개를 native raycasting과 비교한다. 십간 × 두 얼굴 장식의 실제 손 인사 포즈 20개에서 부착과 제외 영역도 검증했다. 저품질 덩굴 경로와 현재 네 아이템이 겹치지 않는 경우는 그대로 보이고, 별도의 실제 보이는 덩굴 segment에 작은 구 영역을 적용해 부분 가림/복구를 검증한다.
- 최종 exact local production Worker: 28/28개 검증, 십간 × 두 조합 × 고/저품질 40개 착용 통과. 같은 시간의 장식 해제 후 native 픽셀·effect instanceMatrix/particle 데이터·GPU buffer 수·geometry/texture 수가 원래 값과 같았다. 원본 몸체 및 morph 버퍼 SHA와 x=-0.42/depth=1.35, 실제 native draw의 프로그램·modelMatrix·morph·alpha convention도 확인했다. 고품질 십간10개의 원본 제한된 손 인사 포즈에서 실제 표면 지지점과 제외 영역을 확인했다.
- 최종 Worker의 실제 React UI: 조합/얼굴 교체/전체 해제, 십간 전환과 browser reload, 일시정지 회전/초기화/blink/손 인사, 손상 JSON/미지원 버전 복구, quota 거부 후 현재 착용 유지와 미저장 안내가 통과했다. 고/저품질에서 착용 상태 context 복구 후 같은 시간의 픽셀·선택·제외 영역·효과가 같았고, 복구 뒤 실제 재탭 인사와 화면 전환 unmount도 통과했다. 최초 React 소스 StrictMode 검증5개와 최종 Worker 결과를 별도로 보존했다.
- 최대 네 아이템: 저품질 3,204 triangles, 고품질 9,156 triangles, 21개 아이템 draw calls. 구현 상한 16,000 triangles/28 draw calls. 최종 matrix180개 착용 갱신의 추가 QA 조회를 제외한 동기 wall-time 최대18.1ms, 중첩 조회0/음수0/300ms 이상0이다. 원시 계측 최대690.1ms와300ms 초과3개는 그대로 기록한다. 별도 대조에서 QA가 추가한 getError/isBuffer 조회가 SwiftShader GPU fence를 만들었고, 둘을 제외한 동일 교체는5.6–8.6ms였다. 최종 검사에서는 모든 조회를 다시 켰다. raw300 PASS, processor-time 또는 실제 기기 지연으로 해석하지 않는다.
- 정상 십간 전환 종료: 고품질2,468/2,468 + 저품질2,468/2,468 버퍼의 explicit native delete와 강제 context loss 전 live0. 착용 복구 뒤 종료: 각 현재 유효 generation1의215/215 explicit native delete/live0. lost generation을 포함한 총430 생성/430 delete 호출은 따로 기록하며 전체가 유효 context에서 삭제됐다고 주장하지 않는다. 측정은 첫 PMREM 전에 시작한다. 실제 Room instanceMatrix96 floats/384 bytes의 원본 SHA, live→한 번의 실제 delete→false도 확인했다. 이전 소스 harness의4,787/4,787 수치는 환경 생성 후 설치한 계측 범위였으므로 이 Room 버퍼를 포함한 최신 검증의 대체 증거가 아니다.
- TypeScript, build, 관련 실제 십간 CPU 25개, 기존 펫 loader 8개, visibility 8개 통과. 대상 lint는 오류 0개, 기존 `<img>` 경고 1개.

독립 read-only 리뷰는 최종 source/시간 계측/실행한 Worker와 harness/실제 PNG17개/served JS28개 연결에서 구체적인 Critical/Important 문제를 발견하지 않았다. 최신 공유 기준의 제품 파일327개와 원본 자산172개를 비교해 네 통합 파일 외 기존 제품 코드는 동일했다. 기존558/614파일 전체-tree 결과는 역사적 체크포인트다. 최신 전체-tree 비교는 별도로 보존된 core QA/docs371개를 포함하므로 범위 차이로 실패했고, 이를 전체-tree PASS라고 바꾸지 않았다. 제품 비교는 docs/와 scripts/qa/만 제외하며 package/dependency/config/auth/DB/API/hosting도 모두 확인한다.

최종 Worker SHA는 `cbe4bf8a8d70e5f7b30c75b70c28330f8d77ebcd1797d96fb013d37e40fb26ab`, 실행 harness는 `cec2769294363c3ff69507a047d814a50484569d8ca01859989efaab5f561344`, 원래 PASS 보고서는 `7785bc4900ddaead6b3fdeed77b4a666a435093ad50d6142e4d411309ba2f26a`다. [최종 증거](qa/spirit-fashion-v1/worker-final/README.md)와 [앞선 실패/대조 이력](qa/spirit-fashion-v1/worker-followup-failures/FOLLOWUP_HISTORY.md)을 함께 보존한다. CPU13은 변경 없는 검사 모듈의 기존 완료 실행을 연결하며 Room 수정 후 다시 실행했다고 주장하지 않는다.

시각 검증은 로컬 Chromium SwiftShader다. 실제 기기/GPU 또는 인증된 hosted 접속의 시각 검증으로 과장하지 않는다. 패션은 현재 배포하지 않았고 별도 비공개 후보다. 효과 배포에 자동 포함하지 않는다.

## 재생성/재검증

```bash
node scripts/sync-approved-jade-assets.mjs
node --test scripts/qa/spirit-fashion-cpu.mjs
node scripts/qa/spirit-fashion-browser.mjs
npx tsc --noEmit --incremental false
npm run build
node scripts/qa/spirit-fashion-worker.mjs
node scripts/qa/spirit-fashion-production-preservation.mjs 5a8fae1c90f1fbac2a9ee6b00bdce7cab7572dbd
```

Browser QA의 기본 Playwright 경로가 없는 환경에서는 `SAJU_QA_PLAYWRIGHT_PATH`, Chromium 경로는 `SAJU_QA_CHROME`으로 지정한다. 코드 제작이므로 별도 다운로드된 패션 원본이나 수작업 내보내기가 필요 없다. `createSpiritFashion`이 checksum 보존된 B형 런타임 GLB를 기준으로 동일 geometry와 재질을 재생성한다.
