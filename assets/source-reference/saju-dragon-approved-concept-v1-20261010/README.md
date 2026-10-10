# 승인 디자인 기반 새 용 3D 후보

청록 몸, 아이보리 배·작은 둥근 뿔, 주황 갈기, 둥근 볼과 짧은 주둥이, 송곳니 없는 닫힌 미소, 네 개의 짧은 발을 가진 날개 없는 동양용입니다. 승인 2D 참조의 실제 픽셀을 확인해 새로 제작했습니다. 기존 용 C 또는 다른 11종의 모델을 가져오지 않았습니다.

새 후보 자산만 추가합니다. 앱의 기본 모델, 기존 모델 선택, 제품 코드, 인증·결제·배포 설정을 수정하지 않습니다.

## 파일

- `SaJu_Dragon_Approved_Candidate_v1.blend`: 편집 가능한 원본. 연결된 본체, 부위별 원본, 13개 본 리그, 재생성 코드, 정확한 승인 PNG가 포함되어 있습니다.
- `SaJu_Dragon_Approved_Candidate_v1.glb`: 외부 버퍼·텍스처 없는 독립 자산. 재질별 10개 스킨 메시, 129,212삼각형, `Idle_Loop` 애니메이션.
- `source/build_dragon.py`: Blender 5.2.1 LTS에서 새 폴더로 재생성하는 스크립트.
- `previews/front.png`, `threequarter.png`, `side.png`: 실제 Blender 원본 렌더.
- `previews/glb-reimport-threequarter.png`: 납품 GLB를 Blender로 재로드한 실제 렌더.
- `previews/idle-actual-glb.mp4`: 같은 GLB를 재로드해 Cycles로 렌더한 6초/640×640/12fps 영상. 생성 이미지가 아닙니다.
- `qa/`: Three GLTFLoader/AnimationMixer, Blender GLB 왕복, 승인 참조 바이트, Khronos, 영상 및 타입/빌드 검증 자료.
- `manifest.json`, `SHA256SUMS`: 입력·출력의 바이트와 SHA256 목록.

Blender 컬렉션 `Dragon_Approved_Candidate`에서 편집하고, 숨겨진 `Editable_Construction_Source`에서 본체 결합 전 형태를 볼 수 있습니다. `Runtime_GLTF_Meshes`는 내보내기용 재질별 복사본입니다. `Preview_Studio`에는 카메라와 조명이 있습니다. 본체·얼굴·네 발은 voxel 결합과 표면 완화를 적용한 하나의 연결된 표면입니다. 배 색은 같은 표면의 vertex color이며 겹치는 별도 껍질이 없습니다.

## 루프와 검증

24fps에서 프레임 0과144의 포즈가 같고, 기본 재생은 0..143으로 6초입니다. `Float_Root`가 부유하고 머리·몸·꼬리는 작은 진폭으로 움직입니다. 미리보기는 0,2,..142의 실제 GLB 포즈 72장을 12fps로 인코딩했으며 중복 끝 프레임을 제외했습니다.

Three 실제 GLB 로더와 AnimationMixer에서 145시점,8,580정점의 움직임을 검사했습니다. 끝 포즈 오차 약0.00000063, 경계 속도차 약0.00584, 잘못된 노멀·가중치·비유한 좌표·면적0삼각형은0개입니다. Blender 원본 본체의 연결 성분은1개이며 8,510엣지/5포즈 검사의 길이 비율은 약0.823..1.112입니다. GLB 왕복 형상 비교 결과는 `qa/native-glb-verification.json`에 기록했습니다.

Khronos 검증 오류0개, 경고10개, 정보2개입니다. 경고는 Blender 내보내기의 부모 아래 스킨 메시에 대한 `NODE_SKINNED_MESH_NON_ROOT`, 정보는 사용하지 않는 UV입니다. 실제 애니메이션은 본에 있으며 부모 노드 변환을 애니메이션하지 않습니다. 앱 배치 시 루트 본과 스켈레톤을 포함한 자산 전체를 다루고, 개별 스킨 메시의 부모 변환에 의존하지 마세요. Three 재생과 Blender 왕복에서 실제 형상 및 동작을 검증했습니다.

프로젝트의 기존 잠금 파일로 `npm run install:ci`, `tsc --noEmit --incremental false`, `npm run build`를 통과했습니다. 앱 코드가 바뀌지 않은 후보 자산 추가입니다. CPU 검증과 렌더이며 모바일 GPU 성능·LOD·제품 통합 검증은 수행하지 않았습니다. 약4.2MB/129k삼각형 자산이라 제품 도입 전 기기 성능을 별도로 측정해야 합니다.

실제 MP4를 디코드한 전체 주기와 반복 경계 장면을 검토했습니다. 눈·짧은 네 발·갈기와 몸통에 분리·뒤집힘·급격한 관절 변형 또는 반복 경계 점프가 관찰되지 않았습니다. 이 PC의 브라우저 자동재생 도구는 Windows 실행 경로 오류로 시작하지 못했습니다. 이를 실제 영상의 디코딩과 프레임 검토로 보완했으며 브라우저 자동재생 검증을 성공으로 기록하지 않습니다.

## 재생성 및 재검증

PowerShell 예시입니다. `$asset`은 이 폴더의 절대 경로, `$newOut`은 아직 존재하지 않는 D: 출력 폴더로 설정하세요. 기존 산출물 덮어쓰기를 막는 검사가 있습니다.

```powershell
$blender = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
$asset = (Get-Location).Path
$newOut = 'D:\Codex\Results\SaJuDragonRebuild-New'
& $blender --background --factory-startup --threads 4 --python-exit-code 1 --python "$asset\source\build_dragon.py" -- --out $newOut --reference "$asset\reference\SaJu_dragon_new-approved-design-concept_2D-image_not-3D-model_2026-10-10.png" --stills
& $blender --background --threads 4 --python-exit-code 1 --python "$asset\source\verify_native.py" -- --blend "$asset\SaJu_Dragon_Approved_Candidate_v1.blend" --glb "$asset\SaJu_Dragon_Approved_Candidate_v1.glb" --out 'D:\Codex\Results\SaJuDragonQA-New'
node "$asset\source\verify_dragon.mjs" --glb "$asset\SaJu_Dragon_Approved_Candidate_v1.glb" --out 'D:\Codex\Results\SaJuDragonRuntimeQA-New.json' --three-root 'PATH_TO_PROJECT\node_modules\three'
```

`source/render_idle.py`는 최종 GLB를 재로드해 프레임을 렌더합니다. `source/encode_idle.mjs`에 지정한 FFmpeg 실행 파일로 MP4를 만듭니다. Blender에서 직접 FFMPEG 형식 설정이 거절되는 환경을 고려해 PNG 시퀀스와 표준 FFmpeg 인코딩 경로를 사용합니다. `source/verify_khronos.mjs`는 별도로 준비한 `gltf-validator` 라이브러리 경로를 받습니다. 새 도구 설치는 전용 Scratch 폴더에만 수행했고 저장소 의존성은 변경하지 않았습니다.

Blender voxel·수치 계산의 마지막 비트와 내보내기 순서는 실행마다 달라질 수 있습니다. 납품 파일의 해시는 `SHA256SUMS`로 검사하고 재생성 형상·리그·루프는 위 검증기로 확인하세요. 승인 PNG는 크기·SHA를 스크립트에서 엄격히 검사합니다.

## 보존 범위

참조: Google Drive `1Aop_3VuaFcGOcbuqkmKuLh4eRDiC4N3R`, 1,651,398bytes,1254×1254, SHA256 `6184555091c80769d6553ae40641dbb44eb6dcc859dd0b8591b7887cc1502e58`. 원본을 삭제하거나 덮어쓰지 않았습니다. Library materialization의 초기 로컬 오류 뒤, 정상 Drive 다운로드로 정확한 바이트를 확보했습니다.

작업 브랜치 `art/dragon-approved-mini-pet-20261010-joseph`는 비공개 `ModernCrusader97/saju-project`의 main `2e2d82b05f87b39ff8057ae914e8dfa01100a974`에서 분리했습니다. 다른 브랜치·기존 로컬 WIP·다른 Unity/Blender 작업은 수정하거나 중지하지 않았습니다. 커밋·원격 SHA 영수증은 최종 전달 패키지에 포함합니다. PR·병합·배포·공유 확대는 하지 않습니다.

중간 버전과 실패 진단은 별도 D: 결과 폴더와 비공개 중간 보존 패키지에 남겼습니다. `qa/history`는 최종 성공 이전의 진단 기록이며 최신 모델을 나타내지 않습니다. 최종 Blender 원본은 승인 PNG 보존을 보완한 버전, 납품 GLB와 영상은 수치 검증 및 실제 렌더를 완료한 동일 GLB 바이트입니다. 최종 왕복 검증이 둘의 형상과 동작 일치를 확인합니다.

