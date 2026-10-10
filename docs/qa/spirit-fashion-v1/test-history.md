# 검증 이력과 남은 범위

최종 성공만으로 앞선 실패를 덮지 않는다. 아래 기록은 도구 출력에서 남긴 관측이며, 출력된 원래 JSON을 그대로 보존한 것과는 구분한다.

1. `ca7efc68` motion/새 효과 통합 직후 첫 CPU 실행: 10개 중 7개 통과, 3개 실패. 갑자/을축/계유 테스트에서 `TypeError: Cannot read properties of undefined (reading 'hiddenAttachmentInstances')`가 났다. 제거한 구형 전역 mask adapter의 진단값을 테스트가 계속 읽은 원인이었다. 새 효과의 실제 행렬 차이/zero-scale/안정된 위치 복구와 작은 실제 덩굴 겹침 probe로 바꾸었고, 실제 original wave/불꽃 particle 데이터 검증을 추가한 후 13개가 통과했다.
2. 초기 소스 브라우저 harness에서 React CommonJS 의존성의 prebundle 설정이 부족해 UI mount가 실패했다. 실제 React/React DOM/JSX 의존성을 Vite에 명시적으로 prebundle하도록 수정했다. 이후 실제 Canvas/패널/hook의 모바일 검증과 손상 저장/용량 오류 검증이 통과했다.
3. 초기 GPU 자원 비교에서는 Three renderer가 jade/dew transmission target을 늦게 생성하는 시점을 모델별 누수로 간주할 수 있었다. 실제 transmissive 경로를 먼저 렌더한 뒤 같은 renderer의 기준을 비교하고, renderer.dispose까지 확인하도록 수정했다. 이전 소스 run의 4,787개 buffer는 전부 해제됐다. 이 결과는 아직 실행하지 않은 최신 Worker GPU 검증의 대체 증거가 아니다.
4. 원래 native raycast만으로 아이템을 만드는 측정은 약 0.5–1.3초였다. 실제 삼각형 XY 인덱스로 바꾸고 neutral/0.45 morph의 앞/뒤 ray 224개를 native와 비교해 정확도를 확인했다. 새 motion 전 소스 run은 네 아이템 13.4–64.3ms, 마스크 교체 2.9–31.6ms였다. 최신 기준의 성능 결과는 후속 검증으로 남는다.

위1–4항은 최초 체크포인트의 역사적 기록이다. 그 당시 독립 리뷰는 `96150b2`에서 구체적인 Critical/Important 문제를 발견하지 않았다. 초기 몸체/재질 원본, 저장 스키마, triangle binding, atomic 실패 복구, 반복 dispose/이전 제외 영역 복구를 보존했다.

후속 공유 context/alpha/Room 수정 뒤 [최종 Worker](worker-final/README.md)는28/28개·40개 착용을 통과했다. 이전 Room 누락, 원시300ms 실패, 실제 native-query 대조와 controlled-rAF 대기 timeout의 원래 보고서/harness는 [후속 실패 이력](worker-followup-failures/FOLLOWUP_HISTORY.md)에 남긴다. 최초4,787/4,787 계측은 PMREM 생성 후 시작했으므로 Room instanceMatrix 누락을 검출하지 못했고, 최종 검증은 첫 PMREM 전에 시작해 정상 강제 context loss 전 explicit native delete/live0을 확인한다. 최종도 원시300ms나 실제 기기 성능을 통과했다고 주장하지 않는다.
