최종 렌더의 숨은 입력 경로 오류 1건 수정 · 누적 아트 5/5 검증

source/render_final_matched_after_portable.py는 --before 모델의 카메라 정보를 읽습니다.
예전 /workspace 작업 폴더의 render-provenance.json이 없어도 선언한 두 native 입력과
새 출력 디렉터리로 최종 3개 뷰를 렌더할 수 있습니다.

blender --background --factory-startup --python-exit-code 1 --threads 4 \
  --python source/render_final_matched_after_portable.py -- \
  --before /absolute/relocated/before.blend --after /absolute/relocated/after.blend \
  --out /absolute/new-output-directory

실행 환경: 클라우드 Linux의 기존 Blender 4.3.2, CPU Cycles, 640x640, 64 samples,
denoising off, seed 20261013. 모델·재질·색·동작·카메라 자산과 품질 설정은 그대로입니다.
원본 렌더러와 실패 기록을 archive 및 evidence에 보존했습니다.
세 이미지 RGBA8 픽셀 및 PNG IDAT는 기존 결과와 정확히 같습니다. 파일 SHA 차이는
tEXt 메타데이터 차이이므로 PNG 파일 자체의 byte-identical 주장은 하지 않습니다.

격리 증거는 Python open 감사로 특정 JSON 읽기를 차단한 범위입니다.
Blender native OS 읽기의 완전 격리나 Windows 실행을 검증했다는 주장은 아닙니다.
evidence-source와 이전 묶음의 고정 경로 진단 도구는 당시 실행 증거의 기록이며,
범용 재실행 진입점으로 소개하지 않습니다.

이 감사에서 생성기·최적화기 확인, 기존 158파일 복구 검증 재사용, 새 회귀 시험은
개선 건수에 포함하지 않았습니다. 증명된 생산 렌더러 오류 수정만 4→5로 셉니다.
누적 회귀: 정적 구조, 눈 크기·볼록함·대칭, 기존 눈꺼풀/갈기 접촉, 실제 동작,
무손실 GLB 데이터, Three.js 로더/동작, Khronos 및 native→현재 GLB 재가져오기.
원래 V26 파일 동일 복구 주장은 없으며, 입 경계 재구성의 추정은 그대로 명시합니다.

main, 별도 UI 묶음, 사이트, 인증·결제·권한, PR 및 배포는 대상에 포함하지 않습니다.
원본/실패/WIP는 삭제하거나 덮어쓰지 않습니다. 새 결과는 새 소유자 전용 Drive 파일로
보존하고, 검증·보존·비밀정보 점검 완료 후 현재 비공개 아트 브랜치에 1회 묶음 커밋합니다.
