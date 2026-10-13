# SaJu Dragon — V22 idle / V25 얼굴 검토 체크포인트

승인된 2D 원본을 기준으로 새로 만든 실제 Blender 작업입니다. 최종 외형 검토는 보류 상태이며, 최신 얼굴과 이전 애니메이션 모델을 별도 폴더에 보존합니다.

- latest-static-face-v25/: 최신 정적 Blender 원본, 실제 렌더, 같은 이마/턱 높이로 맞춘 원본 비교, literal 생성 스크립트와 진단 도구. V25 얼굴의 새 rig·GLB·idle·전체 재생성 검증은 아직 실행하지 않았습니다.
- animated-checkpoint-v22/: 이전 편집 가능한 Blender 원본, GLB, 6초 Idle_Loop, 실제 GLB 재불러오기 렌더·영상 및 실제 재생성 검증 자료. V25 얼굴이 들어간 모델이 아닙니다.
- known-regressions/: V22 갈기 뿌리와 피부 사이의 뜬 간격을 뒤늦게 발견한 실패 원문과 V23의 접촉 통과 기록. V22의 기존 idle 검증 통과가 이 결함을 해결했다는 뜻은 아닙니다. V25는 수정된 뿌리의 정적 접촉 검사를 통과했습니다.
- private-backup-maps/: 모든 중간·실패·원본을 보존한 23개 비공개 Drive 복구 ZIP의 manifest와 영수증. 로컬 CRC/SHA256·원본 불변, 원격 크기·소유자만 접근을 확인했습니다. 원격 ZIP 본문을 재다운로드하여 해시 확인하지는 않았습니다.
- review-state.json / checkpoint-file-manifest.json: 버전별 상태, 보류 항목, 복사한 literal bytes와 SHA256.

V25에서는 안구 내부를 얼굴 표면에 따라 휘게 하던 방식에서 볼록한 타원구 캡으로 바꿨습니다. 실제 피부 교차선까지 눈의 가장자리를 잘라 접촉을 유지했고, 흰 부분은 주로 바깥쪽에 남겼습니다. 갈색 눈 표면의 방사 방향 오목 표본은 양쪽 모두 0개입니다. 노멀·폐쇄 표면·눈 접촉·눈 자체 가림·갈기 뿌리의 정적 검사는 통과했습니다. 이는 원본과의 외형 일치 승인을 의미하지 않습니다.

진단 렌더 두 장은 같은 geometry에서 광택/무광 재질만 바꿉니다. 원본의 정확한 카메라와 조명은 알려져 있지 않아 조명 근사 조건이라고 표시했습니다. 얼굴 비교는 이마 꼭대기와 턱 아래의 높이를 맞추고 가로 폭 차이는 유지했습니다. 승인 원본보다 넓은 주둥이·턱 윤곽 등은 외형 검토 대상입니다.

설치된 Blender 5.2.1로 V25 정적 모델을 새 폴더에 생성하는 명령:

    & 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --threads 4 --python latest-static-face-v25/source/build_dragon_v8_volume_v25.py -- --out 'D:/Codex/Results/새_V25_정적_폴더' --reference animated-checkpoint-v22/reference/approved-2D-concept-original.png --stills

V22의 실제 통과된 재생성 wrapper:

    & 'C:/Program Files/Blender Foundation/Blender 5.2/5.2/python/bin/python.exe' animated-checkpoint-v22/source/regenerate_v8_volume_v22.py --out 'D:/Codex/Results/새_V22_재생성_폴더'

V22 GLB는 43,276,624 bytes / 1,106,644 triangles이며 모바일·브라우저 GPU 성능은 검증하지 않았습니다. 실제 렌더의 스튜디오 수평선을 보존했습니다. 관련 types/build 증거는 제품 코드가 같은 V20 시점의 통과 결과이고, 사이트 batch-five의 추가 검증 결과가 아닙니다.

별도 비공개 아트 브랜치의 검토 자료 추가입니다. 제품 기본 모델, 다른 11종, main, 기존 브랜치와 UI WIP는 보존합니다.
