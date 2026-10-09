클라우드 보유 작업 자료의 Git 보존을 완료했습니다. 최신 앱 코드 `43e2d8dc6efe1654641e639397f37d0ea44f525a`를 부모로 한 별도 비공개 브랜치 `archive/saju-cloud-environment-20261009`에 증거·해시 목록을 추가했습니다. 실제 자료를 담은 첫 커밋은 `c481d7616eb7ca3f938e64a41e11e4551504a5cc`이며, 원격 전체 SHA readback과 독립 재다운로드 검사를 통과했습니다.

[보존 브랜치](https://github.com/ModernCrusader97/saju-project/tree/archive/saju-cloud-environment-20261009), [실제 자료 커밋](https://github.com/ModernCrusader97/saju-project/commit/c481d7616eb7ca3f938e64a41e11e4551504a5cc), [파일 목록](inventory.tsv), [독립 원격 바이너리 검증](remote-binary-verification.json).

| 직접 검증한 보존 범위 | 결과 |
|---|---|
| 최신 checkout의 앱·API·모델 원본·재질·효과·QA | 상속된 Git 파일 361개 전부 독립 fetch 바이트와 SHA-256 일치 |
| 이 환경의 모델 파일 | `.blend` 6개·GLB 19개·gzip 1개, 26개 경로·23개 고유 SHA; 기존 Git 바이트와 압축 멤버로 모두 보존됨 |
| Jade 런타임 복원본 | body·base-color·fields·still 4개가 원격 원본 Git blob과 일치 |
| 비압축 porcelain GLB | 13,700,928바이트. root gzip 복원본과 dot ZIP의 기존 멤버가 완전히 일치 |
| 클라우드 보고·로그·합성 QA·기존 증분 backup | ZIP 243개 파일 모두 CRC 및 원본 SHA-256 일치 |
| 전체 조사 목록 | 세 checkout의 중복을 포함한 1,272개 경로·558개 고유 SHA-256; 작품/독립 파일 개수가 아님 |
| 새 업로드 모델 파일 | 0개. 기존 원격 자료가 같은 바이트를 보존하므로 중복 생략 |

독립 검증은 기존 Git 객체를 공유하지 않는 빈 bare 저장소로 실제 원격 브랜치를 shallow fetch하여 실행했습니다. Git 인증 설정을 읽거나 바꾸지 않았습니다. 자료 커밋 `c481d761…`의 checksum 목록 9개, 최신 tracked 파일 361개, ZIP 멤버 243개, 런타임 원본 4개, dot ZIP의 알려진 porcelain 모델 멤버를 검증했습니다. 이 보고와 검증 JSON·도구는 이후 같은 보존 브랜치에 추가한 검증 증거입니다.

검증 ZIP은 `cloud-verification-artifacts.zip`, 크기 1,074,022바이트, SHA-256 `f9fe570446f64c04a54952b3905f9d304fe24db97f5d681e0da4c3a5161f497c`입니다. 기존 원본 실패 로그와 의도적인 red 회귀도 보존했으며 모두 성공한 로그로 바꾸지 않았습니다.

dot 자료 조회의 고정 기준은 `archive/saju-local-authoring-20261009`의 `956fe6e2a7f3de3a0aabe3c59d9d5db3795c7123`입니다. 비압축 porcelain 모델은 `archives/2026-10-09-local-authoring/source/saju-source-candidates-and-qa--part-01.zip`의 `saju_planet_preview/public/models/porcelain-hero-blink-v1.glb` 멤버에 있습니다. member SHA-256은 `57d7ee5b3c4e0b99eaadefb8095283bed44986beaa5a91c096dd7a0c514bf9c2`입니다. 알려진 모델 멤버만 열었고 해당 브랜치 변경이나 Library 후보의 재생성·적용은 하지 않았습니다. dot 전체 441개 자료를 이번 클라우드 검증에서 모두 독립 검사했다는 뜻은 아닙니다.

개발 준비는 이전 단계에서 직접 실행했습니다. 설치·승인 모델 복원·격리 D1 초기화·타입 검사·빌드·통합 23/23·개발 서버 응답·같은 디스크에서 서버 재시작 후 합성 데이터 유지가 성공했습니다. `43e2d8d` 기준 저장 목록 응답 회귀 4/4, 기존 저장 DOM 6그룹/API 4그룹도 성공했습니다. 전체 lint는 기존 43오류·37경고로 실패가 남았습니다. 이번 보존 단계는 앱 소스 변경이 없어 바이너리·압축 검사를 수행했으며 앱 검사 전체를 다시 실행하지 않았습니다. 보고 원문은 ZIP 안의 각 evidence 폴더에 있습니다.

원본 `/workspace/saju-project`는 clean인 `work`의 `2e2d82b05f87b39ff8057ae914e8dfa01100a974`, 개발 검증 checkout은 clean인 `maint/guin-map-loading-20261009`의 `43e2d8dc6efe1654641e639397f37d0ea44f525a`를 유지했습니다. root 잠금파일 SHA-256 `ffb8ad533a7ea1d2f48ca306489d19884296f7902423fbbc00c48f3b8fd11d4e`와 기존 합성 DB 파일 크기·mtime을 보존했습니다. 일반 push는 이번 별도 보존 브랜치만 대상으로 했습니다. main·다른 작업 브랜치·dot 보존 브랜치에 쓰지 않았으며 force·tag·PR·merge·배포·환경 설정 Publish는 하지 않았습니다.

최신 홈 `libfile_063ee0caabbc8191a4a106468826f1dc`와 10천간 재질 `libfile_ea461fe7b4b08191a368a1023c392bfb`의 Library ZIP 원본은 이 환경에서 미확보입니다. CONNECT 403 이후 재시도·우회하지 않았습니다. 사라진 `2709bb7` 전체 복원도 확인하지 못했습니다. 이 보존 완료는 현재 실제 보유 자료의 보존을 뜻하며 미확보 작업까지 복구했다는 뜻이 아닙니다.

자동 클라우드 복원·환경 설정 Publish·install_script/start_skill 저장 초안 원문·managed-linux 실행·native GPU/Blender 렌더·실제 hosted 로그인은 미검증입니다. 개발 서버 재시작 검사는 클라우드 간 DB 이동 검사가 아닙니다. 의존성·생성 모델·D1은 새 checkout에서 준비해야 합니다. ZIP의 `a10d920.bundle`은 `40f0c9a` 기준이 필요한 증분 bundle입니다.

다음 통합의 코드 기준은 `43e2d8d`입니다. 승인된 홈·10천간 원본이 확보되면 별도 통합 브랜치에서 보존 바이트를 대조하고 회귀를 실행해야 합니다. 상세 결과의 빠른 전환·실패 조사는 코드 읽기 단계에서 안전하게 멈췄으며 확정 결함이나 적용 수정이 없습니다. [중단 지점](PAUSED_INVESTIGATION.md)에 실제 홈/입력 모달의 합성 응답으로 재현할 다음 단계를 남겼습니다.
