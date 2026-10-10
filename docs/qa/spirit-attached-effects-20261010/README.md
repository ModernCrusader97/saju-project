# 실제 B GLB 통합 검증

2026-10-10에 원본 body GLB·PNG·실제 production loader/material/effects를 사용하는 Chromium SwiftShader WebGL 검사를 수행했습니다. [통합 보고서](browser-report.json)의 십간 × low/high **20/20** 조건은 같은 시간의 정확한 픽셀·instance 재현, 움직임, 되감기, 로컬 가림 제거 후 복원, 정지 상태 회전, reset과 0.45 이하 원본 팔 morph를 검증합니다. 셰이더/브라우저 오류와 외부 요청은 0개입니다. 34개 PNG는 모든 십간 인사와 추가 효과 6종의 정면·측면·서로 다른 시간의 사선입니다.

| 예시 | 정면 | 측면 | 인사 |
| --- | --- | --- | --- |
| 甲 | [정면](갑-front.png) | [측면](갑-side.png) | [팔과 가지](갑-wave.png) |
| 乙 | [정면](을-front.png) | [측면](을-side.png) | [팔과 덩굴](을-wave.png) |
| 丙 | [정면](병-front.png) | [측면](병-side.png) | [팔과 불꽃](병-wave.png) |
| 丁 | [정면](정-front.png) | [측면](정-side.png) | [팔과 잔불](정-wave.png) |
| 戊 | [정면](무-front.png) | [측면](무-side.png) | [팔과 모래](무-wave.png) |
| 癸 | [정면](계-front.png) | [측면](계-side.png) | [팔과 이슬](계-wave.png) |

[실제 GPU 버퍼 검사](buffer-lifecycle.json)는 20조건에서 생성된 소유 buffer **2,250개를 각 1회 삭제**, alive 0개·미해제 bytes 0을 확인합니다. body rest attributes 4개 × 33,207정점도 업로드와 삭제를 실제 GL handle로 확인합니다. geometry counter는 QA 바닥이 있는 이미지 harness에서 1, 바닥이 없는 폐기 harness에서 0입니다. 이미지 harness의 최종 texture counter는 5이며 0이라고 주장하지 않습니다. 모래의 별도 검사에서 Three r186 전역 DFG LUT의 잔존 handle을 확인했고 context를 해제합니다.

[원본 보존](preservation.json): v30 `a553589`의 기존 asset/public 171개가 동일하고 auth·DB·API·hosting 소스가 그대로입니다. [원본 포즈 검사](motion-cpu.json)는 source attributes/morph SHA 보존, 발 바닥, bounded wave, 반복 탭, pause/seek/reset/dispose를 확인합니다. [경로 검사](triangle-walk.json)는 62,124면의 실제 seam-welded 인접관계와 분리된 표면의 경계 정지를 확인합니다. [식생 검사](vegetation.json)는 추가적인 actual B centerline·normal·leaf-to-stem·mask 검증입니다.

[검증 요약](verification.json)에 root에서 재실행한 명령과 범위를 기록합니다. 십간 CPU 25개, 새 motion/dew/sand/triangle/vegetation Node runner 38개(vegetation 파일 내부 4조건), 별도 관련 회귀와 TypeScript·빌드가 통과했습니다. 대상 lint는 error 0개이며 기존 unused `Z_AXIS` warning 1개가 남습니다. 최초 관련 회귀는 jsdom 경로를 지정하지 않아 2개 파일이 시작되지 않았고, 기존 설치 경로를 지정한 최종 실행에서는 모두 통과했습니다.

현재 파일은 검증된 구현의 첫 보존 단위입니다. 실제 빌드 Worker의 React UI와 배포 상태는 후속 증거로 추가합니다. 이 캡처는 hosted 로그인 화면이나 물리 GPU 성능 인증이 아닙니다. 덩굴은 짧은 경로이며 이슬 합쳐짐/분리 낙하와 壬 물보라는 미구현입니다.
