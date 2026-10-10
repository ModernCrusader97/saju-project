# 십간·패션·이슬·얼굴·인사 통합 검증

2026-10-10의 보존 소스에서 만든 **새 구현**이다. 미확보 후보 `a97c418`과 동일하게 복원했다고 주장하지 않는다. 이 문서는 진행 중 검증 단위의 근거를 보존하며, 최종 배포 결과는 `release.json`의 실제 원격 SHA·Site 버전·종료 상태로 판단한다.

## 확인한 기준과 누락

기존 운영 Site는 소유자 전용 v31, 실제 원본 커밋 `a4011b690078001b148403a923735368b9768835`였다. 비공개 GitHub의 연결/검증 체크포인트는 `9ec0150bf7f595f28541d91355bf64143bd137e8`이었다. 이슬의 독립 단위 `1f1aa08ff74a1934a1ceb908957e041ffd97df41`은 정상 push 뒤886 tracked 파일을 원격에서 바이트 비교했다. 패션의 독립 후보는 `3fb604600de32687df4f2b2d3561e88ff9657486`으로 보존되어 있으나 v31에는 연결되지 않았다.

통합 branch는 `feature/spirit-fashion-dew-water-20261010`이며, 이슬1f에서 시작해 패션 동작 구현 `c4570c8`만 가져왔다. 이전 공통 수정 이력을 중복 적용하지 않았다. 원래 운영 소스 a401도 조상 이력에 포함되어 있다.

| 항목 | 기존 운영 v31 | 이번 통합 / 검증 경계 |
|---|---|---|
| 甲 | 나무껍질 + 표면 가지 | 유지. 실제 표면 법선의 짧은 분기 가지 |
| 乙 | 덩굴 재질 + 짧은 연결 덩굴/잎 | 유지. 전체 몸체 덩굴 완성이라고 주장하지 않음 |
| 丙 / 丁 | 불꽃 / 숯·잔불 및 기존 삼각형 발화 효과 | 유지. 불꽃 카드 자체의 그림자 예외와 몸체 그림자 유지 |
| 戊 | 사암 + 균열 입자 중력 낙하 | 유지. 기존 삼각형·충돌 범위의 효과 |
| 己 | 승인 옥 + 움직이는 초록빛 atlas | 원래 GLB UV와 재질 원본 보존 |
| 庚 / 辛 | 브러시드 티타늄 / 액체 은빛 | 유지 |
| 壬 | 흐르는 물의 큰 요철 .034 | 큰 요철 .017로 절반. 잔물결·거품·유동 좌표 유지. 새 물보라 완성 주장 없음 |
| 癸 | 표면을 미끄러지는 작은 이슬 | 짝 경로의 응결→접근→부피 보존 합침→큰 방울 낙하→재응결. 한정된 표면/중력 효과이며 전체 유체 구현 아님 |
| 패션 | 운영 UI 연결 누락 | 보존된4슬롯/6품목 후보 연결. 기본은 미착용, stem별 browser storage |
| 얼굴 | 壬/癸 원래 얼굴의 흐린 재굴절상 | 기존 얼굴7개만 transmission 뒤에 그리도록 조정. 눈 형태·깜박임·그림자 설정 보존 |
| 인사 | 단일 제한 모프 .45의 작은 흔들림 | 새 사용자 정정에 따라 얼굴 높이 팔 올림→손2–3회 흔들기→내리기 검증 진행. 완료 결과는 별도 motion 근거로 판정 |
| 기존12지 | 공통 원본 생성기가 실제 연결됨 | 조형 교체 없음. 마지막 피드백/후보와의 대조 한계를 아래 문서에 기록 |

## 원본과 실제 측정

B GLB SHA256은 `0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84`이다. `assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb`에서 기존 sync script가 만든 runtime 파일과 바이트 동일하다. 원래 몸체33207점/62124삼각형, UV, normal/index, 기존 모프 및 표시 depth1.35를 보존한다. 기존 승인 얼굴7개는 눈2·glint2·눈썹2·입1이며 두 번째 얼굴 메시는 없다.

눈 중복의 독립 원인 검증은 [40 matched cases](face-investigation/regression-report.json), [정확한 제안 코드8화면](face-investigation/source-patch/report.json), [선택된 원본/수정 PNG 및 조사](face-investigation/INVESTIGATION.md)에 보존했다. 얼굴 caster만 끈 물 화면은 바이트 동일했고, 모든 그림자를 끄면 바닥만 달라졌다. 실제 transmission buffer에 얼굴이 들어갔다가 물 표면에서 재굴절되는 것을 읽었다. 辛/己의 원래 렌더 경로는 해당 후보와 바이트 동일하다. 이는 접근 불가 사용자 screenshot을 가져온 검사가 아니다.

[임수 Native report](water/webgl/report.json)는 같은 GLB·loader·얼굴 경로·카메라·포즈·시각·조명에서 재질 두 버전만 교체했다. 실제 float GPU field를 시각0/1.25/5.5에 읽어 각 약53300표본에서 큰 요철 RMS비0.5와 오차0을 측정했다. 나머지 작은 요철 최대 오차는 `4.6566128730773926e-9`이다. high/low의16 PNG도 보존했다. 물결은 bump normal 요철이며 원래 silhouette의 vertex displacement가 아니다. [CPU recipe 검사](water/cpu/report.json)와 [변경 전 실패](water/cpu/initial-red.log)를 함께 기록했다.

기존 인사 원본에는 뼈/skin weights가 없지만 `Gentle_wave_pose`의 상대 POSITION+NORMAL 모프와3초 weight animation이 있었다. 작은 동작은 제한 포즈/컨트롤러 설계 문제였다. 원본 파일이 없어서 생긴 문제라고 판정하지 않았다.

[기존12지 현재 대조](zodiac-current-assessment.md)는 생성기 자체를 원본으로 인정하고, GLB 미발견이나 `Temporary` 주석을 최종 승인 판단으로 사용하지 않는다. 실제 조형·눈·idle은 dffb의 생성 구간과 바이트 동일하다. 소/돼지4다리와 작은 머리 idle은 존재하지만 전달된 긴 뱀형 공중 똬리 용의 마지막 피드백 반영은 확인되지 않았다. 미확보 후보를 새 동물로 대체하거나 연결 완료라고 주장하지 않는다.

## 보호 범위와 환경 한계

GitHub main/maint branch/PR/공개 접근·운영 DB·auth/payment/권한/새 Site는 변경하지 않는다. 기존 `.openai/hosting.json`의 project_id, DB/R2 binding과 운영 환경을 보존한다. 비밀키·`.env`·실제 사용자 DB를 source나 배포 archive에 포함하지 않는다. Library403 파일은 다운로드/재시도/우회하지 않았고, 사용자 D 전체/다른 실행 환경/전체 이전 대화까지 조사했다고 주장하지 않는다.

검증은 실제 보존 GLB와 기존 texture의 CPU/로컬 production Worker 및 Chromium SwiftShader를 사용한다. 실제 물리 GPU·모바일 기기·운영 로그인 세션 검사를 했다고 주장하지 않는다. Site 종료 상태와 원격 commit SHA는 별도 실제 도구 readback으로 확인한다. 초기 출처 단위의 historical 보고서는 수정 시점 당시 상태를 적으며 최종 통합 상태를 대신하지 않는다.
