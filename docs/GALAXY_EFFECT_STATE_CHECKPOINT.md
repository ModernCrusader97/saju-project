# effect 상태 갱신 조사 중간 기록

기준은 `8ba3b9763bcaa88a8a3f2e108fa331a49800090f`, 기록 브랜치는 `qa/galaxy-effect-state-20261010`이다. 실행 코드는 변경하지 않았다. 사용자 요청에 따라 행성 진입 및 동일 소유자의 외형 차이 문제를 먼저 처리하기 위해 이 조사는 소스 대조 단계에서 보존했다.

시작 시 작업 트리 17개는 모두 미저장 변경이 없었다. 실제 원격 22개 브랜치 HEAD에 WebGL 생성 실패 catch의 `setGraphicsError` 호출과 `activePerson`의 초기 `null`이 남아 있음을 확인했다. 추적된 `AGENTS.md` 및 `.agents/skills` 지침은 없었다. [소스 대조](qa/galaxy-effect-state/remote-source-audit.json)에 각 SHA와 코드를 보존했다.

현재 `react-hooks/set-state-in-effect` 오류는 `GalaxyCanvas.tsx:206:7`의 WebGL 생성 실패 안내 갱신을 지적한다. 정상 경로의 `setGraphicsError(null)`과 초기 일반 motion preference의 `setMotionPaused(false)`는 현재 초기 상태와 같은 값을 요청한다. 실제 추가 render를 호출 수만으로 판단할 수 없으므로 Profiler 측정은 아직 필요하다.

행성 구성 effect는 `setActivePerson(currentSelected)`로 초기 소유자와 다시 받은 사람 객체의 요약 카드를 갱신한다. 서버·최초 클라이언트·소유자 변경·같은 ID의 새 데이터 재로딩에서 어느 갱신이 필요한지는 아직 측정하지 않았다. 실패 안내 제거, render 중 WebGL 생성, 타이머 우회, 규칙 억제는 적용하지 않았다.

남은 작업은 실제 SSR 및 최초 client commit/추가 commit 측정, 소유자·데이터 재로딩 관찰, 안전한 소규모 수정 가능 여부의 판단과 관련 회귀다. lint 해결이나 새 타입·빌드·회귀 통과를 주장하지 않는다. [진행 상태](qa/galaxy-effect-state/investigation-status.json)에 미실행 항목을 명시했다.
