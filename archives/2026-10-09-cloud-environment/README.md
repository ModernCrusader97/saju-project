이 보존 브랜치는 클라우드에서 직접 확인한 최신 코드 `43e2d8dc6efe1654641e639397f37d0ea44f525a`를 부모로 하고, 실제 보유 파일의 해시 목록과 클라우드 검증 산출물을 추가합니다. `main`이나 실행 중인 개선 브랜치를 바꾸지 않습니다. 원본 모델·재질·이펙트는 현재 코드의 Git 이력과 별도 dot 보존 브랜치에 있는 동일 바이트를 참조해 중복 업로드를 생략했습니다.

| 자료 | 보존 위치/근거 |
|---|---|
| 현재 앱·API·재질·이펙트·QA 코드 | 이 브랜치의 상속된 root tree, 기준 `43e2d8d`; 파일별 SHA-256/Git blob은 `inventory.json` |
| 원본/내보낸 모델·텍스처·shader·animation 설정 | 상속된 `assets/source-reference`, `public/models`, `lib/planet`, `components/planet`, `preservation-archives`; 모델 패키지의 `runtime` 폴더도 목록에 포함 |
| 실제 클라우드 비교 목록 | `inventory.json` 1,272개 경로, `inventory.tsv`; 세 checkout의 동일본을 포함하며 558개 고유 SHA-256 |
| 클라우드 보고·로그·합성 검사 결과·이전 bundle/ZIP | `cloud-verification-artifacts.zip` 243개 원본 파일, 1,074,022바이트, SHA-256 `f9fe570446f64c04a54952b3905f9d304fe24db97f5d681e0da4c3a5161f497c` |
| 압축·모델 검사 | `archive-inspection.json`: ZIP/중첩 ZIP CRC, gzip 내부 GLB, GLB header/chunk/JSON, Blender header, incremental bundle 검증 |
| 상세 결과 미완료 조사 | `PAUSED_INVESTIGATION.md`; 읽기 단계에서 멈췄으며 소스 변경/재현 테스트 없음 |
| dot 최신 보존 자료 | `archive/saju-local-authoring-20261009`의 `956fe6e2a7f3de3a0aabe3c59d9d5db3795c7123`, 조회만 수행 |

이 클라우드 checkout의 모델 경로는 `.blend` 6개·GLB 19개·gzip 1개, 총 26개입니다. 원본/복원본·중복 참조를 포함하므로 모델 작품 개수가 아닙니다. 파일별 `provenance`와 `original_status`는 원본 파일 그대로인지, 내보낸 모델인지, checksum으로 복원한 runtime 복사본인지 구분합니다. 최초 작가/제작 이력의 독립 인증을 의미하지 않습니다. 코드와 자산의 Git blob 및 SHA-256이 이미 있는 원격 바이트와 일치하는지 확인했습니다.

처음에는 비압축 `public/models/porcelain-hero-blink-v1.glb`의 Git blob이 원격 tree에 없었습니다. ZIP 내부까지 추가 대조한 결과 dot 브랜치의 아래 멤버에 동일 파일이 존재했습니다. 실제 ZIP 멤버를 읽어 CRC·GLB header·SHA-256을 확인하고 클라우드 복원본과 바이트 단위로 비교했습니다. 따라서 새 GLB 복사를 보존 폴더에 추가하지 않았습니다. 이 GLB는 이전부터 root의 gzip에도 손실 없이 보존돼 있었으며, 신규 모델 발견 또는 생성이 아닙니다.

```text
원격 commit: 956fe6e2a7f3de3a0aabe3c59d9d5db3795c7123
ZIP: archives/2026-10-09-local-authoring/source/saju-source-candidates-and-qa--part-01.zip
멤버: saju_planet_preview/public/models/porcelain-hero-blink-v1.glb
원본 크기: 13,700,928 bytes
SHA-256: 57d7ee5b3c4e0b99eaadefb8095283bed44986beaa5a91c096dd7a0c514bf9c2
```

`remote-compressed-asset-comparison.json`이 이 추가 대조의 근거입니다. `latest-authoring-comparison.json`의 최초 “missing” 값은 비압축 Git blob만 대상으로 한 중간 조회이며 최종 누락 판정이 아닙니다. Jade body·base-color·fields·still 네 파일은 이미 원격 Git blob에서 동일 바이트를 확인해 다시 복사하지 않았습니다.

추가 ZIP은 관련 사주 검증 폴더와 합성 테스트 출력만 담았습니다. 비밀 키·.env·사용자 DB·node_modules·빌드/설치 캐시·host registry·무관한 개인정보 경로를 수집하지 않았습니다. 압축 내부에도 금지 경로·symlink·CRC 오류가 없었고, 검사한 비밀 패턴의 일치 항목은 없었습니다. 이는 filename 및 정해진 credential 패턴 검사의 결과이며, 모든 형태의 비밀/개인정보를 판별하는 인증은 아닙니다. 이 ZIP의 이전 `a10d920.bundle`은 `40f0c9a` 기준이 필요한 증분 bundle이며 완전한 전체 저장소 backup으로 오해하면 안 됩니다.

검증 로그에는 의도적으로 실패시킨 red 검사와 당시 기록한 검사 실행 순서 오류도 그대로 있습니다. 해당 보고서의 성공/실패/미실행 구분을 보존했고 모두 성공으로 바꾸지 않았습니다. 최신 직접 실행 결과는 저장 목록 회귀 4/4, 기존 DOM 6그룹/API 4그룹, 통합 23/23, 타입·빌드 성공입니다. 전체 lint는 43오류·37경고로 실패가 남았습니다. 이 회차에는 자산/증거를 보존했으며 앱 코드를 바꾸거나 native GPU·Blender 렌더 검사를 새로 수행하지 않았습니다.

최신 홈 ZIP `libfile_063ee0caabbc8191a4a106468826f1dc`, 10천간 재질 ZIP `libfile_ea461fe7b4b08191a368a1023c392bfb`은 이 환경에서 미확보입니다. 과거 지원 다운로드 CONNECT 403 이후 재시도·다른 전송 경로·Library 우회를 수행하지 않았습니다. 별도 dot 보존 원본이 있을 수 있어도 이번 클라우드 작업에 이 두 Library 후보를 재생성하거나 실행 코드로 적용하지 않았습니다. 사라진 `2709bb7` 전체 복원 주장도 하지 않습니다.

클라우드 환경 설정 Publish/새 자동 복원, 사이트 배포·공개, 실제 hosted 로그인은 미실행/미검증으로 유지합니다. 원본 checkout·잠금파일·기존 DB와 이전 원격 버전은 보존했습니다. 재현용 도구 및 로그는 자료이며 install_script/start_skill의 게시 설정을 대체하지 않습니다. `prepare-preservation.py`는 파일 수집 당시의 도구 원문이며 자동으로 실행되는 앱/설치 코드가 아닙니다. 최종 원격 ZIP 비교와 push 검증은 별도 JSON 근거를 확인해야 합니다.
