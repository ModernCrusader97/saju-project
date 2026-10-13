import hashlib,json
from pathlib import Path
import numpy as np
from PIL import Image

root=Path('/workspace/saju-cloud-lossless-buffer-reuse-20261013/evidence/browser-render-comparison')
source=json.loads((root/'actual-render-equivalence.json').read_text());pairs=[]
for row in source['pairs']:
    angle=row['angle'];time=row['time_seconds'];a=root/f'original-angle-{angle}-time-{time}.png';b=root/f'candidate-angle-{angle}-time-{time}.png'
    # JavaScript uses 0 in filenames, while Python's decoded JSON may also produce integers.
    if not a.exists():
        angle=0 if angle==0 else angle;time=int(time);a=root/f'original-angle-{angle}-time-{time}.png';b=root/f'candidate-angle-{angle}-time-{time}.png'
    with Image.open(a) as im:x=np.asarray(im.convert('RGBA'))
    with Image.open(b) as im:y=np.asarray(im.convert('RGBA'))
    assert x.shape==y.shape==(640,640,4) and np.array_equal(x,y)
    nonblank=int(np.count_nonzero(np.any(x!=x[0,0],axis=2)));assert nonblank>10000,'Blank/background-only image cannot prove equivalence'
    pairs.append({'angle':angle,'time_seconds':time,'decoded_PNG_RGBA8_sha256':hashlib.sha256(x.tobytes()).hexdigest(),'original_PNG_file_sha256':hashlib.sha256(a.read_bytes()).hexdigest(),'candidate_PNG_file_sha256':hashlib.sha256(b.read_bytes()).hexdigest(),'actual_non_background_pixels':nonblank,'different_pixels':0,'captured_WebGL_RGBA8_sha256':row['original']['pixel_rgba8_sha256'],'captured_WebGL_pixel_hash_equal':row['exact_pixel_match']})
report={'status':'PASS_ALL_SIX_ACTUAL_NONBLANK_RENDER_PAIRS_EXACT_PIXELS','environment':source['environment'],'pairs':pairs,'legacy_unused_placeholder':'Original browser probe records non_background_pixels:0 as an unused placeholder, not a measurement. This separate image-based count is authoritative. Original records preserved; corrected reproduction source provided separately.','model_or_quality_changes':False}
with (root/'actual-render-nonblank-verified-summary.json').open('x') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps({'status':report['status'],'non_background_pixels':[x['actual_non_background_pixels'] for x in pairs],'different_pixels':0}))
