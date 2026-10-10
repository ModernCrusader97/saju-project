# 승인 시안 기반 새 용 후보 v2

승인 PNG의 실제 픽셀과 v1 실제 렌더를 비교한 후 다리 연결, 눈, 얼굴, 갈기, 귀·뿔·발톱, 재질을 보완한 새 3D 후보입니다. v1과 모든 중간 버전을 별도로 보존했습니다. 기존 용 C나 다른 11종의 모델을 가져오지 않았고 제품 기본 모델을 바꾸지 않았습니다.

- `SaJu_Dragon_Approved_Candidate_v2.blend`: 편집 가능한 Blender 5.2.1 LTS 원본. 승인 PNG와 재생성 코드가 정확한 바이트로 포함되어 있습니다.
- `SaJu_Dragon_Approved_Candidate_v2.glb`: 13본, 재질별 스킨 메시10개, 222,646삼각형, 독립 버퍼, `Idle_Loop` 6초.
- `source/build_dragon.py`: 새 폴더로 모델·리그·GLB·실제 렌더를 재생성합니다.
- `previews/front.png`, `threequarter.png`, `side.png`: 실제 원본 렌더.
- `previews/glb-reimport-threequarter.png`: 납품 GLB를 실제 재로드한 렌더.
- `previews/idle-actual-glb.mp4`: 같은 GLB의 실제 Cycles 렌더,640×640,12fps,6초.
- `qa/render-provenance.json`: 각 실제 렌더의 모델·스크립트·승인 PNG·이미지 SHA, 프레임0, 카메라 위치·회전·행렬·직교 크기·색 설정.
- `qa/private-preview-files.json`: 소유자만 접근하는 새 Drive 미리보기 ID와 확인 결과.
- `previews/junction-before-after.png`, `qa/junction-*.json`: 동일 중립 재질·카메라의 실제 다리 접합 전후 진단.
- `manifest.json`, `SHA256SUMS`: 원본·출력 바이트와 검증 근거.

본체·머리·네 발은 하나의 연결된 표면입니다. `Dragon_Approved_Candidate`에서 최종 표면과 리그를 편집하고, 숨겨진 `Editable_Construction_Source`에서 구성 요소를 볼 수 있습니다. 구성 요소와 최종 표면은 편집 가능하며 재생성 매개변수는 스크립트에 있습니다. `Runtime_GLTF_Meshes`는 재질별 내보내기 사본, `Preview_Studio`는 카메라·조명입니다.

다리의 어두운 홈은 v1 중립 회색 렌더에서도 보이는 실제 오목한 접합이었습니다. 두 버전 모두 경계 엣지·비정상 연결·재계산과 다른 노멀은0개였습니다. v2는 깊게 겹친 경계 대신 smooth signed-distance union으로 다리 뿌리를 완화했습니다. 단순히 노멀만 바꾼 수정이 아닙니다.

눈의 흰 테두리와 전방 오프셋을 줄이고, 입·눈·귀 속·발톱의 표면이 피부와 같은 가중치를 쓰도록 했습니다. 아래턱 아이보리는 같은 피부 색입니다. 갈기는 연속된 바탕과 겹친 둥근 층으로 이어지고 닫힌 끝을 사용합니다. 발톱은 각 발의 얕은 두 개 색 표면으로 만들었습니다. 몸의 roughness를0.65로 높이고 coat를0으로 낮췄습니다.

원본과 GLB의 145시점 루프, 노멀·가중치·좌표·면적0삼각형,11,778엣지/5포즈의 관절 변형,GLB 왕복 형상을 검사했습니다. Three 실제 로더의 끝 포즈 오차는 약0.00000063, 경계 속도차는약0.00572입니다. Blender 왕복 형상 오차는 최대약0.00000271이고 본체는 연결 성분1개입니다. 근거는 `qa/runtime-verification.json`, `native-glb-verification.json`입니다.

Khronos 오류0개, `NODE_SKINNED_MESH_NON_ROOT` 경고10개입니다. 본 애니메이션을 사용하고 부모 노드의 변환을 별도로 애니메이션하지 않습니다. 앱에서 배치할 때 스켈레톤을 포함한 자산 전체를 다루며 개별 스킨 메시의 부모 변환에 의존하지 마세요. 실제 Three 재생과 Blender 왕복에서 납품 데이터를 검증했습니다.

프로젝트의 기존 잠금 파일로 설치·타입 검사·production build가 통과했습니다. 이후 변경은 새 후보 자산 폴더 추가이며 앱 코드는 동일합니다. 테스트를 중복 재실행하지 않았습니다. 새 후보는 약6.7MB/222k삼각형이며 모바일 GPU 성능·LOD·제품 통합은 확인하지 않았습니다.

24fps 키프레임0과144가 같은 포즈이며 기본재생0..143은6초입니다. 영상은 GLB 포즈0,2,..142의72장을12fps로 인코딩하며 중복 끝 프레임을 제외합니다. Blender의 직접 FFMPEG 형식 설정이 이 환경에서 거절되어 기존 설치 Blender의 PNG 출력과 전용 Scratch의 표준 FFmpeg를 사용했습니다. 보안·인증·권한 설정은 바꾸지 않았습니다.

브라우저 자동재생 도구는 Windows 실행 경로 오류로 시작하지 못했습니다. 실제 MP4를 디코드한 주기·반복 경계와 프레임을 직접 검토하고 수치 검증을 수행했습니다. 브라우저 자동재생 검증을 성공으로 기록하지 않습니다. Library 보조 경로는 이 PC에서 정상 처리가 되지 않아 새 Library ID를 발급하지 않았습니다. 검증된 비공개 Drive ID와 정확한 로컬 위치를 제공합니다.

PowerShell 재생성 예시:
```powershell
$blender = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
$asset = (Get-Location).Path
& $blender --background --factory-startup --threads 4 --python-exit-code 1 --python "$asset\source\build_dragon.py" -- --out 'D:\Codex\Results\SaJuDragonV2Rebuild-New' --reference "$asset\reference\SaJu_dragon_new-approved-design-concept_2D-image_not-3D-model_2026-10-10.png" --stills
& $blender --background --threads 4 --python-exit-code 1 --python "$asset\source\verify_native.py" -- --blend "$asset\SaJu_Dragon_Approved_Candidate_v2.blend" --glb "$asset\SaJu_Dragon_Approved_Candidate_v2.glb" --out 'D:\Codex\Results\SaJuDragonV2QA-New'
node "$asset\source\verify_dragon.mjs" --glb "$asset\SaJu_Dragon_Approved_Candidate_v2.glb" --out 'D:\Codex\Results\SaJuDragonV2RuntimeQA-New.json' --three-root 'PATH_TO_PROJECT\node_modules\three'
```

영상은 `render_idle.py`에 원본·GLB·native QA 결과와 새 프레임 폴더를 지정해 렌더한 뒤 `encode_idle.mjs`에 `--frames`, `--out`, `--ffmpeg`, `--glb`를 지정해 인코딩합니다. 설치·재생성은 기존 출력 덮어쓰기를 막는 검사가 있습니다. Blender 수치 계산의 마지막 비트는 실행마다 달라질 수 있으므로 납품 파일은 SHA256SUMS, 재생성 형상·리그·루프는 검증 스크립트로 확인하세요.

승인 참조 Drive ID `1Aop_3VuaFcGOcbuqkmKuLh4eRDiC4N3R`,1,651,398bytes,1254×1254,SHA256 `6184555091c80769d6553ae40641dbb44eb6dcc859dd0b8591b7887cc1502e58`를 보존했습니다. 모든 Drive 보존은 새 파일이며 기존 파일·권한을 변경하지 않았습니다.

브랜치 `art/dragon-approved-mini-pet-20261010-joseph`의 v1 커밋 `66141436fe4eb1461fcb1427475e2781b49e4e8d`를 보존하고 v2는 추가 일반 커밋으로 남깁니다. 기존 main·46개 원격 브랜치·로컬 WIP·다른 실행 작업을 바꾸지 않습니다. 최종 commit/push/원격 SHA 영수증은 전달 패키지에 포함합니다. PR·병합·배포·공유 확대는 하지 않습니다.

