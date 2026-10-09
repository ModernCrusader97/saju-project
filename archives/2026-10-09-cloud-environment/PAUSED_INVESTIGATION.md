상세 결과 조사는 사용자의 “지금까지의 사주 모델·재질·작업 자료를 GitHub에 보존” 우선 요청에 따라 코드 읽기 단계에서 멈췄습니다.

기준은 `43e2d8dc6efe1654641e639397f37d0ea44f525a`이며 `maint/guin-map-loading-20261009`는 clean이었습니다. 미저장 소스 변경이나 새 재현 테스트는 없습니다. 읽은 후보는 홈의 `SajuInputModal`에서 A 주제 POST를 시작한 뒤 닫고 B 주제를 여는 흐름입니다. 이전 요청의 완료가 홈 결과/모달을 갱신할 수 있는 코드 경로가 보이지만 아직 DOM으로 재현하지 않았으므로 확정 결함·완료 수정으로 기록하지 않습니다.

일시적으로 추가 파일 읽기 네 건이 `exec-server transport disconnected`로 실패했고, 이후 읽기 전용 git status probe와 현재 보존 검사 명령들이 정상 실행됐습니다. 완료된 `43e2d8d`까지의 설치·회귀·push 작업은 중단된 작업이 아닙니다.

조사 시 수집한 `saju-reading-visit-evidence-20261009/baseline.json`과 `run-command.py` 원본은 `cloud-verification-artifacts.zip`에 있습니다. 다음에 상세 조사를 재개한다면 실제 홈·입력 모달·결과 카드에 합성 응답을 제공해 늦은 성공/실패와 닫기·재열기부터 재현해야 합니다. 현재 보존 브랜치에는 그 후보를 적용하지 않았습니다.
