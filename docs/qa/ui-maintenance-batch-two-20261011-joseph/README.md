# UI 유지보수 두 번째 5건 묶음 · Joseph · 2026-10-11

이전 묶음 343e3c3e에서 새 브랜치로 시작한 0/5 기준입니다. 아래 다섯 미해결 문제만 수정·검증했으며 이전 완료 항목은 다시 실행하거나 건수에 포함하지 않았습니다.

1. saju-post-http-error-false-success — Require response.ok before invoking the existing success callback or closing the Saju input draft. Non-2xx success-shaped JSON follows the existing error path and permits manual retry.
2. saju-input-close-accessible-name — Give the existing X close control an explicit name and button type; preserve pointer closing and permit native Tab/Enter identification.
3. saju-input-dialog-keyboard — Name the input pane as a modal dialog, focus its first input, contain native Tab/Shift+Tab, restore the opener, and keep focus inside when submission temporarily removes the form.
4. saved-category-selection-state — Expose the currently selected archive category with aria-pressed on existing chips; preserve pointer filtering and support native Space/Enter selection and reset.
5. guin-post-person-map-shape — Validate the POST friend map before acknowledging either manual or quick addition, retaining the current map and manual draft on malformed people. Existing GET validation stays byte-identical.

검증: 수정 전 Chrome 12/26 통과·14 실패·화면 충돌 4회 → 이번 묶음 최종 26/26 통과·화면 충돌 0회. 390×844와 1440×1000에서 실제 마우스·Tab·Shift+Tab·Space·Enter·Escape를 사용했습니다. HTTP503 가상 응답의 의도된 콘솔 메시지 2개는 별도 기록했습니다.

타입·프로덕션 빌드 통과. 기존 lint 오류 4개·경고 6개 유지, 새 오류·경고 0개, QA 스크립트 0개. 규칙이나 suppression 변경은 없습니다.
정상 UI PNG 8개 중 8개 원본 바이트 동일. 모든 CSS 바이트 동일. 세 제품 파일의 역패치를 기준 커밋 원본 CRLF 바이트와 비교했습니다.

1/5 중간 ZIP은 커밋 없이 본인 전용 Drive 새 파일로 보존했습니다. 다섯 건의 개별 검증과 이번 묶음 최종 회귀·타입·빌드·lint 완료 후에만 일반 commit/push 한 번을 수행합니다.

브랜치: fix/ui-maintenance-batch-two-20261011-joseph
기준 SHA: 343e3c3ee2ca91f42eafe7e14fbae1b91c0e5893

경계: 실제 UI에 가상 POST/GET 응답을 주는 loopback Chrome 시험입니다. 입력창 호스트와 next/navigation·next/link는 시험 fixture이고 GalaxyCanvas는 빈 렌더러입니다. 실제 API·DB·Gemini·사용자 저장소/클립보드·3D·물리 기기·배포 로그인 검증을 주장하지 않습니다. 기존 아트와 11종, 기본 모델, main, 이전 브랜치, 원본 WIP, 인증·결제·권한·DB 데이터 및 다른 실행 프로세스는 작업 범위 밖입니다.

원본 FAIL, navigation timeout, 수정 전후 소스, 개별·최종 보고서, 실제 UI PNG 및 재생성 도우미를 evidence/와 authoring/에 보존했습니다. SHA256SUMS와 .gitattributes는 이 증거 폴더의 원본 바이트 보존을 위한 것입니다.
