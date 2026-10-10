# 실제 Worker 초기 GPU 정리 실패 보존

패션 후보 `68b91c7165250107c378117f92c57a8f85321e2c`, Worker SHA256 `53cf7d83833454d553c4f6253c9d457c04396d728e4bff1581e3547180ee3048`에서 발생했다. 착용 전 기본 을 정령에서 갑 정령으로 전환한 직후 이전 Canvas의 buffer 1개가 명시적으로 해제되지 않아 엄격한 잔류 0 검사가 실패했다. 이 실행으로 착용 40개 검증을 완료했다고 주장하지 않는다.

- `first-retired-buffer-fail.json`과 `first-retired-buffer-fail-harness.mjs`: 첫 실패의 원본 JSON과 실행 코드. 추가한 생성 stack 계측만 되돌려 코드를 재구성했고, 원본 보고서의 harness SHA256 `ca5df63b250cc7a74d1cdbf994684405fd643fbea33921422e6d7009e59519df`와 정확히 일치하는 것을 확인했다.
- `creation-stack-fail.json`과 `creation-stack-fail-harness.mjs`: stack/native liveness 계측 후 두 번째 실패의 원본 보고서와 실행 코드. harness SHA256 `93086d8187b1932a0d419db08f90eaed83cbe09eb141dfcd37a2b2ea95ab436e`가 일치한다.
- `ownership-evidence.json`: 실제 creation stack, 생성 166/명시적 해제 165, unmount 뒤 분리된 Canvas/context lost/native `isBuffer=false`/GL 오류 없음과 해당 compiled callsite를 보존한다. 실제 호출은 `WebGLObjects.update`의 `instanceMatrix` 업로드다. 같은 stack의 `PMREMGenerator.fromScene` 입력인 설치된 `RoomEnvironment`는 6개의 인스턴스를 사용하고, 그 `dispose()`는 geometry/material만 정리한다.

96 float/384 byte라는 크기는 `InstancedMesh`의 `Float32Array(count * 16)`와 `RoomEnvironment`의 count 6에서 도출했다. 이 두 실행에서는 `bufferData` 인자나 unmount **전** native `isBuffer`를 직접 계측하지 않았으므로 그 값은 실측이라고 주장하지 않는다. 초기 context generation 0이며 별도 restore probe 전에 전환했다.

기존 소스 WebGL harness는 환경 생성 뒤 buffer 계측을 설치했기 때문에 이 환경 instanceMatrix를 집계하지 않았다. 옷·몸체 buffer 검사를 완화하지 않았고 패션/공유 runtime도 수정하지 않았다. root가 공유 환경의 `InstancedMesh.dispose()` 누락을 별도 수정·검증하는 동안 GPU 슬롯을 반납했다. 수정 뒤 같은 엄격한 검사와 최종 40개 Worker QA를 재실행할 예정이다.

모든 자료는 로컬 disposable synthetic D1/Chromium SwiftShader 실행이다. 실제 사용자 DB, 인증 정보, 외부 에셋 다운로드는 포함하지 않는다. 패션은 배포하지 않았다.
