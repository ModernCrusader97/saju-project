# SaJu Dragon — volume V22 검토용 3D 후보

사용자가 승인한 2D 원본으로 새로 만든 실제 Blender 모델입니다. 최종 외형 승인은 보류 상태입니다. 제품 기본 모델과 다른 11종은 교체하지 않았습니다.

- model/: 편집 가능한 Blender 5.2.1 원본과 자체 포함 GLB. 13개 뼈, 6초 Idle_Loop, 짧은 네 발과 날개 없는 동양용.
- source/regenerate_v8_volume_v22.py: 원본 이미지와 스크립트 SHA256을 확인하고 새 폴더에서 모델과 새 rig를 재생성합니다. 기존 Blender를 사용하며 설치하지 않습니다.
- previews/: 실제 GLB 재불러오기 렌더, 전체 옆면, 승인 원본과의 픽셀 비교, 실제 640×640·12fps·6초 MP4.
- qa/: 폐쇄 표면·노멀·눈 접촉·관절 변형·루프·GLB round-trip·Khronos·Three.js·재생성 검증. 관련 types/build는 제품 코드가 같은 V20 시점의 통과 증거입니다.
- source-extra/: 전체 옆면 렌더와 재생성 비교 도구.

    & 'C:/Program Files/Blender Foundation/Blender 5.2/5.2/python/bin/python.exe' source/regenerate_v8_volume_v22.py --out 'D:/Codex/Results/새_재생성_폴더'

재생성 GLB는 저장 순서 때문에 파일 SHA가 달라질 수 있습니다. 정점 속성, 색·노멀·가중치, 골격, 애니메이션과 방향을 유지한 삼각형 집합은 실제 비교에서 정확히 같습니다.

GLB 43,276,624 bytes / 1,106,644 triangles입니다. 모바일·브라우저 GPU 성능은 검증하지 않았습니다. 원본보다 주둥이·입 아래 윤곽이 넓고 평평하며, 아래 몸 굴곡의 갈기 겹침은 추가 외형 검토 대상입니다. 실제 스튜디오 수평선이 보이는 렌더를 보존했습니다.

비공개 작업 브랜치: art/dragon-photo-volume-refinement-v8-20261012-joseph. main·기존 브랜치·UI WIP·기본 모델·배포·공유 권한은 변경하지 않습니다.
