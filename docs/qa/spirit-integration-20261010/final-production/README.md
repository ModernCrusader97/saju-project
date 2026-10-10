# 최종 통합 production 검증

제품 소스와 실제 빌드의 hash를 함께 기록한다. 검증 당시 HEAD는 `0cf16dcef6c7fb1dec40021eceffe53ba07db461`이고, 새 인사 구현을 포함한 working tree를 빌드했다. 이후 변경은 QA 계측과 증거 문서뿐이다. 최종 commit과 포장 시 제품 소스 hash가 검증 당시와 같음을 다시 확인한다. 테스트한 Worker SHA256은 `ab88fb26884c21c59199e8aa5261c77e4d062eb3b3c7a01e751042991c701214`이다. 같은 산출물을 source commit/push 뒤 포장하며, 새로운 build UUID로 다른 산출물을 만들지 않는다.

| 검사 | 실제 결과 | 근거 |
|---|---|---|
| 실제 원본 GLB CPU / 관련 회귀 | 13개 suite,119 PASS /0 FAIL | [verification.json](verification.json), [CPU log](commands/cpu-serial.log) |
| 타입 / 변경 제품 경로 lint / build | exit0. 기존 Canvas img 권고1개 | [명령과 hash](verification.json), [로그](command-log-manifest.json) |
| 원래 production 파일 보존 | 327개 중318개 바이트 동일, 허용한9개 변경 | [전체 바이트 비교](preservation.json) |
| 정확한 production Worker의 표면·인사·해제 | 19/19,6지원효과 stem×고저 품질12조합,44 PNG | [실제 Worker 보고서](spirit-worker/report.json) |
| 실제 UI의 십간·고저 품질 패션 | 28/28,40착용 조합,10인사 snapshot,17 PNG | [패션 Worker 보고서](fashion-worker/report.json) |
| 동일 Worker의 행성 진입·외형 회귀 | 8/8, 같은 build SHA,10기존 행성 효과 | [행성 보고서](galaxy-worker/report.json) |

몸체의 원래 POSITION/NORMAL/UV/index와 기존 모프 hash, depth1.35, 원래 blink, 새11개 제어와 native shader uniform 전체를 검사한다. 최대2개 파생 제어, 원래 source 제어0, 반복 탭의 연속성/대기 인사1회, 15/60fps의 같은 animation time, pause/drag/reset/큰 시간 간격과 context 복구를 확인했다. Root의 loader는 인사 제어를 설치한 다음 surface effects를 만든다. CPU의 실제 triangle/normal과 fashion 부착점 검사는 새 포즈에서 실행한다.

패션은4슬롯/6품목, 기본 미착용이다. 원래 눈/깜박임과 가리는 영역을 보존하며, head/face/neck/back과 표면 효과는 같은 몸체 소유자에 부착된다. 壬/癸에서는 원래 얼굴7개가 실제 렌더 호출 하나에서 transmission 뒤 canvas에 각각 한 번만 그려지는 순서를 측정했다. opacity1/depthWrite/원래 castShadow와 receiveShadow=false를 유지한다. 저장 복구·손상된 저장·quota denial·item 교체·실제 UI unmount/context 복구도 실행했다. fashion.set 시간 기준은 추가 QA gl.getError/isBuffer 계측 구간을 제외한 CPU 작업300ms이며, raw 계측 포함300ms나 물리 기기 기준을 통과했다고 주장하지 않는다.

GPU 해제는 context loss로 사라진 것을 해제로 세지 않는다. 실제 `isBuffer`와 `deleteBuffer`를 읽어 context loss **이전** 명시적 삭제를 확인한다. 환경 Room instance matrix도 원본96float/384byte/hash를 읽고 PMREM 이후 한 번 삭제된 것을 기록했다. 기본 view 퇴역·unmount와 착용 상태 퇴역에서 생성 수와 명시적 삭제 수가 같다.

초기 실패도 보존한다. `spirit-worker/failed-first-array-readback.json`은 native uniform array의 첫 위치만 읽어 길이1로 기록한 QA 오류다. active uniform의 실제11개 위치를 각각 읽도록 수정한 뒤19개 전체를 다시 실행했다. `fashion-worker/failed-*.json`은 rAF step 없이 UI가 여러 번 렌더한 얼굴 기록을 누적해35개로 센 QA 오류다. 렌더 호출 경계에서 기록을 초기화하고, 동일 호출에서7개 고유 얼굴과 body 이후 순서까지 검사한 뒤28개 전체를 다시 실행했다. 이 수정은 제품 소스를 바꾸지 않았다.

명령은 [verification.json](verification.json)에 실제 argv/exit/time/hash로 보존했다. Node22 spec의 `ℹ pass`/`ℹ fail` 요약과 TAP 요약을 읽어119/0을 판정했다. `commands/`는 Git whitespace 검사에 맞춰 줄 끝 공백과 마지막 빈 줄만 정리한 사본이며 원래 로그 hash와 사본 hash를 [manifest](command-log-manifest.json)에 나란히 기록했다. 원래 로그는 해당 working tree의 `outputs/spirit-integration/final/`에 남긴다.

Native 브라우저 검사는 Chromium SwiftShader에서 실제 WebGL draw/linked uniform/PNG를 사용한다. 합성 rAF/performance clock을 사용하며 중간 GPU draw는 생략하고, 효과/인사 CPU update는 각 step마다 실행한다. Miniflare의 일회성 합성 D1·합성 auth header만 사용했고 외부 요청을 차단했다. 운영 DB, 실제 로그인 세션, 물리 모바일 GPU나 전체 cloth/fluid/self-intersection 검증은 실행하지 않았다. Site 배포 상태와 원격 SHA는 별도 전달 파일의 실제 도구 readback으로 확인한다.
