# 정령 패션 v1 보존 체크포인트

기준: `96150b21de463574859c6574c481a5f1ec4e8400`. 패션은 배포하지 않았다. 이 체크포인트는 완료된 코드·CPU·React 소스 UI 검증을 보존한다. 새 context-loss 수정과 fresh 40개 착용/exact production Worker GPU QA는 대기 중이다.

- `cpu-report.json`: 실제 승인 GLB로 13개 통과. 실제 손 인사 가중치 0.44509–0.449999의 십간 × 두 얼굴 장식 20개를 확인했다. 몸체 관통 표본 3,480개에서 안쪽 정점은 없었다. 원본 앞/뒤 ray 224개와 native raycasting 결과가 일치했다. 가지/이슬/덩굴 및 불꽃 발화 지점 가림은 안정된 원래 인스턴스/particle 데이터로 복구됐다.
- `source-ui-report.json`: production Canvas·패널·hook의 실제 React 소스 harness 5개 통과. 모바일 조합·얼굴 교체·정령 전환·저장 reload·일시정지 회전/초기화·blink/손 인사·해제/unmount·손상 JSON/버전 복구·실제 quota 거부를 확인했다. 최종 배포 Worker QA 결과는 아니다.
- `preservation.json`: 기준의 기존 파일 558개/원본 자산 172개를 비교했다. 기존 변경은 지정된 네 통합 파일뿐이며 원본 GLB·UV·몸체 depth·eyes/pets/planet/auth/DB 코드는 보존됐다.
- `checkpoint.json`: 완료/대기 구분, 빌드 Worker SHA, 관련 회귀 수, 독립 리뷰 결론을 기록한다. CPU/UI 실행 기준은 motion 구현 `ca7efc68`; 최종 보존 기준 `96150b2`의 차이는 동일 branch 노말 hook 추출 및 sand 노말 보정이며 패션 계약은 동일하다.
- `test-history.md`: 수정한 검증 실패와 측정 관측을 숨기지 않고 남긴다.

이미지는 로컬 Chromium SwiftShader의 실제 React 화면이다. `mobile-ui-expression-frame.png`에는 원래 눈·glint의 blink가, `mobile-ui-wave-frame.png`에는 원본의 제한된 손 인사 포즈가 보인다. 실제 기기/GPU, hosted 로그인, 전체 직물/불꽃 동적 충돌을 검증했다는 의미는 아니다.

재검증: `node --test scripts/qa/spirit-fashion-cpu.mjs`, `node scripts/qa/spirit-fashion-browser.mjs`, `node scripts/qa/spirit-fashion-preservation.mjs <기준SHA>`.
