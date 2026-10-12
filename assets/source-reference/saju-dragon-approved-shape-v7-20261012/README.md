> **V7은 기술 검증을 통과한 보존 후보이며 승인 시안의 충실한 재현으로 판단하지 않습니다. 최종 3D 외형의 사용자 승인은 없습니다.**
> 원본 픽셀/실제 렌더 비교에서 얼굴·눈·주둥이·머리몸 비율·목과 몸 곡선·갈기 차이를 확인했습니다. [시안 충실도 리뷰](appearance-review/appearance-fidelity-review.json)와 나란히 비교한 PNG를 먼저 확인하세요. 별도 리빌드는 아직 시작하지 않았습니다.

# SaJu 용 V7 새 후보

Joseph에서 승인된 2D 디자인을 기준으로 제작한 날개 없는 동양용입니다. 앱 기본 모델과 기존 다른 모델은 교체하지 않았습니다.

- 볼과 짧은 주둥이, 통통한 S 몸과 연결된 꼬리, 가지 뿔, 넓은 잎 갈기, 네 발과 입체 발톱: 실제 메시 측정과 세 방향/idle 검토 5/5 통과.
- runtime/SaJu_Dragon_Approved_Shape_v7.glb: 13개 본, Idle_Loop 6초, 내장 4096px 텍스처.
- native/SaJu_Dragon_Approved_Shape_v7.blend: 편집 가능한 메시·구성 원형·리그·액션·카메라·승인 이미지·제작 소스 패킹.
- comparison-v6-v7.html: 동일 카메라의 실제 V6/V7 GLB 렌더와 실제 6초 영상.
- previews/SaJu_Dragon_V7_Actual_GLB_Idle_6s.mp4: 실제 Blender GLB 렌더 72프레임, 640×640, 12fps.
- reference/approved-2D-concept-original.png: 디자인 기준이며 3D 렌더가 아닙니다.

## 재생성

설치된 Blender 5.2.1 LTS와 Python을 사용합니다. 기존 출력은 덮어쓰지 않습니다. 아래 예시의 새 절대 출력 폴더를 지정하세요.

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/5.2/python/bin/python.exe' './source/regenerate_v7.py' --blender 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --output 'D:/Codex/Results/SaJuDragonV7-NewRun'
```

제작 각 단계는 실제 실행했고, 원본에 패킹된 네 소스는 납품 코드와 바이트가 동일합니다. 진입 스크립트는 구문/입력/실행 계획을 검증했습니다. 새 재생성 출력에는 새 QA를 적용하세요. 파일명·경로 직렬화 때문에 매 실행의 .blend 바이트가 동일하다고 주장하지 않습니다.

## 검증 및 범위

GLB 재수입·Three GLTFLoader·145개 프레임 AnimationMixer·노멀/가중치·원본 바이트·루프·관절·관련 프로젝트 빌드와 타입 검사 통과. 관절 변 길이 비율 0.863–1.215, native 끝 포즈 오차 0, GLB/native 최대 정점 오차 약 0.0000051. 상세 증거는 qa 폴더에 있습니다.

31개 닫힌 겹침 갈기 층은 의도된 잎 구조이고, 본체 스킨은 하나로 연결되어 있습니다. 312,956 삼각형/11.37MB 후보의 GPU·모바일 성능은 아직 측정하지 않았습니다. Khronos 오류/경고는 0이고, 사용하지 않는 주황 갈기 UV 정보 1건을 그대로 기록했습니다.

이는 승인된 제작 지시에 따른 새 후보이며 최종 3D 외형의 사용자 승인을 주장하지 않습니다. PR·main 병합·배포·공유 확대는 하지 않습니다.
