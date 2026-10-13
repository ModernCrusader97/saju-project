무손실 GLB 저장 정리 한 건 검증 완료. 원본43,474,952→후보43,148,280바이트,326,672바이트(0.7514%)절감. 모든79accessor자료형/값/정점/인덱스/색/스키닝/애니메이션/재질/카메라/씬 그대로입니다. 원본GLB/native와3건WIP는 보존했으며 새 ledger에4/5로기록했습니다. commit/push0.
변경은9개 동일바이트 구간의 중복저장 제거뿐입니다. bufferView79개와accessor79개는 유지하고오프셋/전체버퍼길이만변경했습니다. 양자화,geometry수정,확장,새런타임의존성,앱/UI변경없음. 이전V6 UV정리를 반복하지않았습니다.
검증: 모든논리component비트·모든bufferView바이트·비저장JSON동등, 실제Three79accessor/material/skin/track동등,145프레임과5시점전체564587정점bit동등, 기존루프/노멀/가중치/팔레트회귀PASS, Khronos모든issues0,640x640SwiftShader정면/사선0·3·6초6쌍RGBA픽셀차이0.
source/reuse_identical_glb_bytes.py --source ORIGINAL --out NEW_CANDIDATE --report NEW_REPORT 로 원본SHA를확인하고 새경로에생성합니다. source/verify_exact_glb_storage.py --original ORIGINAL --candidate CANDIDATE --out NEW_QA 로모든논리비트와용량차이를검증합니다. 기존출력덮어쓰기는거부합니다.
실제Three/브라우저비교스크립트는저장된클라우드의/workspace경로와이미설치된three/playwright/Chromium을사용합니다. 재시험은새출력디렉터리에서경로를지정해야합니다. 의존성설치는하지않았습니다.
초기렌더프로브의non_background_pixels:0은사용되지않는placeholder여서검증주장에서제외했습니다. actual-render-nonblank-verified-summary.json에실제PNG측정값이있고독립검토에서도PNG↔WebGL해시일치를확인했습니다. 수정된재현용v2소스는카운터만교정했으며전체렌더를재실행하지않았습니다. 초기소스/기록도보존합니다.
이개선은저장바이트절감이며GPU geometry메모리나모바일프레임속도개선판정은하지않았습니다. 원본은별도V26재구성후보이고원본V26동일복구주장은없습니다.
