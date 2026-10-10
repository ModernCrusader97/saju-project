# 승인 B 정령의 새 표면 효과와 작은 인사 동작

이 구현은 적법하게 보존된 B GLB와 십간 재질 코드를 이용한 새 제작입니다. 미확보 후보 `a97c418`의 동일 복원이라고 주장하지 않습니다. 확인된 GitHub 기준 `43e2d8dc6efe1654641e639397f37d0ea44f525a`에서 진행된 재질 연결·v30 보존 작업 `ee6e9740054394b0bee30563f35e957b49adf4bb`과 불꽃 그림자/동시간 비교 수정 `4095d52`를 포함합니다. 다른 유지보수 브랜치와 GitHub main은 변경하지 않습니다.

원본 `assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb`에서 기존 sync 스크립트로 runtime GLB를 생성합니다. SHA-256은 `0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84`이며 POSITION·NORMAL·UV·index·morph 원본은 그대로입니다. 표시 깊이 1.35와 위치, 원래 얼굴과 이어진 팔, 동반자·planet 외형은 보존합니다. Library 403 파일이나 새 외부 에셋은 사용하지 않았습니다.

| 일간 | 몸체 재질 | 실제 몸체 표면의 추가 효과 |
| --- | --- | --- |
| 甲 | 나무껍질 | 실제 면의 법선에서 자란 굽은 가지·분기·끝잎 |
| 乙 | 덩굴·잎 방향의 녹색 재질 | 이어진 삼각형을 따라 자라는 짧은 덩굴과 줄기에 연결된 잎 |
| 丙 | 불꽃 | 실제 면의 부착점에서 시작하는 기존 불꽃 |
| 丁 | 숯·잔불 | 실제 면의 부착점에서 시작하는 기존 잔불 |
| 戊 | 사암 | 몸체 shader와 같은 균열 필드에서 시작하는 모래 낙하 |
| 己 | 옥·움직이는 초록빛 | 원래 RGB triplet atlas와 strength-2 발광 |
| 庚 | 브러시드 티타늄 | 추가 입체 효과 없음 |
| 辛 | 액체 은빛 | 추가 입체 효과 없음 |
| 壬 | 흐르는 물 | 실제 캐릭터 물보라·포말은 미구현 |
| 癸 | 이슬 | 맺힘 → 연결된 곡면을 따라 미끄러짐 → 소멸·재생성 |

표면 경로는 UV seam의 중복 정점을 연결한 실제 삼각형 인접관계를 사용합니다. 별도 구형 껍질이나 가까운 다른 몸 부분에 투영하지 않습니다. reference 경로의 identity를 유지하고, 매 프레임 현재 morph 삼각형의 위치와 기하 법선으로 부착을 갱신합니다. 작은 장식의 가림은 지정한 로컬 box/sphere 안의 부착만 숨기는 공통 계약이며, 제거하면 같은 seed와 matrix가 복원됩니다. 이 릴리스에는 패션 UI를 포함하지 않습니다.

정령은 발 바닥을 유지하는 작은 호흡과 무게 이동, 눈 깜박임을 갖습니다. 화면 탭은 원본 `Gentle_wave_pose`를 최대 0.45로 사용하여 이어진 팔을 살짝 올리고 두 번 작은 인사를 한 뒤 idle로 돌아갑니다. 눈·눈빛·눈썹·미소는 같은 움직임 프레임을 공유합니다. 연속 탭은 한 번의 추가 인사로 모아 포즈 점프를 막습니다. 절대 시간·일시정지·되감기·초기화와 15/60Hz CPU 비교를 검증했습니다. 이는 소실된 production rig나 전체 제스처 라이브러리의 복구가 아닙니다.

[WebGL 캡처·보고서](qa/spirit-attached-effects-20261010/README.md), [가지와 짧은 덩굴 검증](qa/surface-vegetation-actual-b.md), [모래 검증](qa/surface-fissure-sand-20261010/README.md), [이슬 검증](qa/surface-sliding-dew/README.md), [수정한 불꽃 그림자와 기존 비교의 한계](qa/spirit-fire-shadow/README.md), [모래 법선 보정](qa/spirit-attached-effects-20261010/affine-normal-fix.md), [그래픽 복구 회귀](qa/spirit-attached-effects-20261010/context-recovery.md)를 함께 보존합니다. 검증된 구현을 먼저 private 후보로 커밋합니다. 실제 빌드 Worker의 앱 UI 검증과 owner-only 사이트 배포 상태는 후속 검증 기록에서 구분해 보고합니다.

전체 몸을 감싸는 덩굴, 연속 물리 충돌, 모래 튕김·퇴적, 이슬 합쳐짐·분리 낙하, 壬 물보라는 이번 범위에 없습니다. 모래 비행은 seek 시 현재 부착점 포즈로 재계산합니다. 물리 모바일 GPU의 FPS와 hosted 로그인 화면은 아직 확인하지 않았습니다. 패션은 별도의 private 후보이며 이 표면 릴리스에 섞지 않습니다. 신규 호랑이 후보는 기존 12지 연결이라는 사용자 범위 정정에 따라 사용하지 않고 별도로 보존합니다. 기존 12지의 제작 코드·Git·v29/v30 참조 추적은 별도 작업이며 한 보존 묶음의 검색 결과를 전체 원본 부재로 확대하지 않습니다.

실제 투명 Canvas에서 확인한 이슬 흰 실루엣은 [최종 출력 보정](qa/spirit-attached-effects-20261010/alpha-compositing.md)으로 해결했습니다. 불꽃·그림자 픽셀을 보존하고 옥의 offscreen 굴절 처리와 원본 재질 광학 값도 유지합니다. 집중 검사 9조건이 통과했으며 전체 Worker UI 결과는 별도로 기록합니다.

기존 12지 코드 모델은 이미 연결되어 있음을 [실제 이력·runtime 감사](qa/zodiac-pet-assets/runtime-audit/README.md)와 192회 CPU 대조로 확인했습니다. 선택은 기존 일지 기준입니다. 별도 최신 제작 모델과 용 C·돼지 과거 해시의 관계는 미확인으로 남기며, 새 호랑이로 대신 연결하지 않았습니다.

최종 실제 Worker UI 17조건과 같은 빌드의 은하 입장 8조건이 모두 통과했습니다. [최종 UI 증거](qa/spirit-attached-effects-20261010/worker/README.md)에 정확한 Worker·harness SHA, 44 PNG, native 검증과 미실행 범위를 고정했습니다. 이는 기존 소유자 전용 Site 반영 전 검증이며 실제 배포 결과는 Native version/deployment 조회로 확인합니다.
