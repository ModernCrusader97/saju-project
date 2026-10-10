# 모래 알갱이의 비균일 부모 아래 조명 법선 보정

독립 코드 검토에서 첫 구현 `ca7efc68`의 모래 알갱이에 조명 법선 오류를 발견했습니다. 실제 모래는 world 좌표로 만든 transform에 부모의 역행렬을 곱합니다. 표시 깊이 1.35 아래에서 이 instance 행렬에는 shear가 생기지만 Three r186 기본 instance normal 코드는 회전과 축척만 처리합니다. 위치·중력·균열·관통 숨김은 유지됐고 조명 방향이 잘못됐습니다.

실제 원본 B GLB와 생성한 instance 행렬을 사용하는 [회귀 스크립트](../../../scripts/qa/affine-instance-normals.mjs)는 수정 전에 low에서 **18.377322°**로 실패했습니다([before](affine-normal-before.json)). 기존 가지의 cofactor 법선 코드를 `affine-instance-normals.ts` 공통 helper로 그대로 옮겨 모래에도 적용했습니다. 가지의 shader 문자열과 cache key, body/particle geometry·matrix·색상·draw budget은 그대로입니다.

[수정 후](affine-normal-after.json) low/high의 실제 활성 알갱이 법선 **94,320개**에서 최대 오차는 **0.00000171°**입니다. 지적된 high `time=1.75 / instance=8 / normal vertex=18`은 보정 후 0°, 원래 stock 계산은 18.377549°입니다. 추가 mirrored/sheared 행렬도 검증했습니다. 독립 재검토는 이 Important 항목의 해결과 추가 Critical/Important 없음으로 결론냈습니다.

대상 lint 0개 오류, TypeScript와 새 빌드가 통과했습니다. [실제 모래 WebGL](affine-sand-webgl.json)의 shader compile·정면/측면/회전/morph·균열 필드 522좌표와 캡처가 통과했습니다. 이는 실제 생성 기하와 재질을 사용합니다. CPU shader-math와 실제 WebGL compile/render는 구분해서 보존하며 물리 GPU 인증이라고 주장하지 않습니다.

새 빌드와 동시에 실행한 전체 모래 검사에서는 morph collision 갱신 중앙값 3.507682ms가 3ms 목표를 넘어서 해당 성능 조건 1개가 실패했습니다. 당시 측정은 [경합 기록](sand-build-contention.json)에 보존합니다. 빌드가 끝난 뒤 같은 CPU 검사 9개를 단독으로 재실행해 모두 통과했고 [최종 CPU 측정](affine-sand-cpu.json)에 수치를 보존했습니다. 예산을 완화하지 않았습니다. 측정값은 공유 호스트의 CPU 시간이며 기기 FPS 보장은 아닙니다.

최종 actual React Worker UI와 배포 증거는 별도로 추가합니다. 소스 재질·모델 원본과 기존 private 보존 단위는 변경 없이 남습니다.
