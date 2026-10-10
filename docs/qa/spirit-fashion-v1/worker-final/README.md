# 최종 정령 패션 v1 Worker 검증

제품 소스 HEAD 57f5939ea65a46047b817fc91a2d4345f23b04a4; 공유 기준 5a8fae1c90f1fbac2a9ee6b00bdce7cab7572dbd. 패션은 별도 비공개 후보이며 배포하지 않았다.

Exact local production Worker 검증은 28/28개, 십간 × 두 조합 × 고/저품질 40개 착용을 통과했다. 17개 실제 PNG와 28개 served JS, 원본 GLB를 해시로 연결했다. 고품질 십간10개의 원본 제한된 손 인사 지지점과 고/저품질 UI blink·회전·초기화·저장 reload·손상 JSON·미지원 버전·quota 거부·착용 상태 context 복구·재탭 인사·실제 React unmount를 확인했다.

- report.json / harness.mjs: 원래 출력과 실행한 harness를 그대로 보존한다.
- checks.json: 명령/빌드/자원/시간/한계를 요약한다.
- production-preservation.json: 기준 제품 파일327개/원본 자산172개; 허용된 기존 변경은 네 패션 통합 파일뿐이다. docs/와 scripts/qa/371개는 제외 범위로 명시한다.
- preservation-scope-mismatch.json / pre-room-fulltree-preservation.json: 최신 전체-tree 비교의 증거 범위 차이와 이전614파일 PASS를 구분한다.
- cpu-provenance.json: CPU13 원래 보고서와 현재까지 변경 없는 검사 모듈을 연결한다. Room 변경 후 CPU13을 다시 실행했다고 주장하지 않는다.
- independent-review.json: 읽기 전용 독립 리뷰; 구체적인 Critical/Important 발견 없음.

정상 십간 전환 종료는 고품질2,468/2,468 + 저품질2,468/2,468 버퍼를 실제 native delete로 해제하고 강제 context loss 전 live0을 확인했다. 착용 상태 복구 후 종료는 각 현재 유효 generation1에서215/215 explicit native delete/live0이다. 이전 lost generation을 포함한 총430 생성/430 delete 호출은 따로 기록하며, 그 모든 호출이 유효 context의 native delete였다는 주장은 하지 않는다. 실제 Room instanceMatrix는96 floats/384 bytes/SHA54251af5…이며 업로드 후 live→한 번의 실제 delete→false를 확인했다.

최종 matrix180개 착용 갱신의 QA 조회를 제외한 동기 wall-time 최대18.1ms, 중첩 조회0/음수0/300ms 이상0이다. 원시 계측 시간은 최대690.1ms이며3개가300ms 이상이었다. 별도 대조로 추가 getError/isBuffer 조회가 SwiftShader GPU fence를 만드는 것을 확인했다. 최종 검사에는 모든 조회와 엄격한 native/소유권 검사를 다시 켰고, raw·probe·exclusive 시간을 함께 보존한다. raw300 PASS나 processor-time/실제 기기 성능으로 해석하지 않는다.

원래 실패와 별도 diagnostic-only 대조는 ../worker-followup-failures/에 있다. 로컬 Chromium SwiftShader와 격리된 synthetic D1/헤더를 사용했다. 실제 사용자 DB, hosted 인증, 실제 기기/GPU, 전체 직물/불꽃 충돌 검증은 하지 않았다.
