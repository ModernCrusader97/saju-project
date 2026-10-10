# 컨텍스트 복구와 종료의 실제 GPU 자원 회귀

최종 production Worker를 실제 React 화면으로 구동한 검사에서 기존 컨텍스트 복구 결함을 발견했다. 테스트는 임시 합성 D1만 사용하며 실제 사용자 DB, hosted 인증, Library 파일에 접근하지 않는다. 원래 GLB·재질·투영 깊이를 그대로 사용한다.

| 단계 | 실제 Worker SHA-256 | 확인한 결과 |
| --- | --- | --- |
| 수정 전 | `9d049c4ca8096b732841b73b68c686aeda2cbf15ffb6396df46c541aad853b5f` | 복구 후 기존 environment의 framebuffer/renderbuffer/texture 삭제에서 GL 1282 세 번 발생 |
| environment만 loss 때 해제 | `e94251f4329b1c5e5fffba79ef4218731e743a5ac065c746a96b83e3cacf74f0` | 복구 렌더 오류 0, 종료에서 old VAO 79 / buffer 115 / texture 3 / framebuffer 1 삭제 오류 발생 |
| 현재 GPU allocation 해제 | `c7a0dd754fdf6d4565f9024a1bfa779c336009a5a21a4986c8cdffe055bcdb8f` | high 집중 검사 3개 통과, 복구·다시 인사·idle 복귀·종료 모두 GL 오류 0 |

이전 실패는 QA의 stale program 조회가 아니었다. trace에서 복구된 live/current program과 renderer program이 일치했고 native `getUniform`/`readPixels`에는 오류가 없었다. 오류가 난 원래 disposal callback과 stack을 [첫 실패](context-recovery/environment-fail.json), [부분 수정의 종료 실패](context-recovery/environment-only-teardown-fail.json)에 보존했다. 각 당시 harness도 함께 기록한다.

`releaseSceneGPUAllocations`는 loss 동안 기존 GPU callback을 해제한다. 고유 instance/geometry, 일반 material texture와 compiled uniform texture, shadow target을 처리하고 material·motion·surface-effect의 논리적인 dispose는 호출하지 않는다. 따라서 원래 CPU attribute/morph 배열, shader recipe, texture image, 부착 경로와 동작 제어기가 유지되고 복구 후 다시 업로드된다. onContextLost 중복 호출은 guard로 막으며 environment를 loss 때 해제한 뒤 restore 때 새 PMREM을 만든다.

[집중 검사](context-recovery/focused-pass.json)는 PROBE이며 전체 최종 앱 인증으로 표시하지 않는다. 실제 UI 재탭 후 원본 wave weight 0.4489056과 변화한 이슬 instance 데이터, 중립 0 복귀, 화면 전환 후 종료·draw 정지를 확인했다. 해당 exact harness SHA-256은 `731053732ca3cba067090b14951c293eb920e111dcd61b2cec75d100c7402f36`이다. 최종 12조건·모바일·jade shader-only atlas 복구 검사는 별도 후속 증거를 추가한다.

TypeScript·build는 통과했고 대상 lint 오류는 0개, 기존 img 경고 1개다. 독립 read-only 검토와 CPU probe는 원본 배열·weight·shader hook·texture pixels·material updates 보존과 pinned Three r186 해제 순서를 확인했으며 현재 장면에서 Critical/Important 문제를 발견하지 않았다. helper의 `InstancedMesh.dispose()`는 instanced morphTexture를 비우므로 instanced morph 모델에는 별도 보존 처리가 필요하다. 현재 B 몸체는 non-instanced이고 추가 효과에는 instanced morph가 없어 이 릴리스의 해당 경로는 영향을 받지 않는다.

이 체크포인트는 검증된 복구 소스의 private 보존 단위이며 아직 배포하지 않았다. 전체 최종 Worker 검증과 owner-only 배포는 각각 확인 후 기록한다.
