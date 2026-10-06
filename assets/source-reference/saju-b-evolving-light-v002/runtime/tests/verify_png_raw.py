#!/usr/bin/env python3
"""Require exact RGBA8 PNG/raw agreement, source-row ordering and opaque alpha."""
from pathlib import Path
import hashlib,json
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]
meta=json.loads((root/'atlas-metadata.json').read_text())
raw=(root/'textures'/meta['atlasRaw']).read_bytes()
im=Image.open(root/'textures'/meta['atlasPng'])
assert im.mode=='RGBA',im.mode
assert im.size==(2048,1024),im.size
array=np.array(im)
assert array.dtype==np.uint8
assert len(raw)==8388608
assert array.tobytes()==raw, 'PNG row order, channels or bytes differ from source raw'
assert np.all(array[:,:,3]==255)
base_sha=hashlib.sha256((root/'textures/Jade_OriginalBaseColor_1024.png').read_bytes()).hexdigest()
assert base_sha=='29bdd5ab8a2c87715fd3aedae3f0465c8b6910b5a9c0e8b8bffeb84a03c6b824', 'Original unattenuated jade base changed'
sha=hashlib.sha256(raw).hexdigest()
assert sha==meta['raw_sha256']
report={'passed':True,'pixelFormat':'RGBA8_UNORM','pngMode':im.mode,'size':list(im.size),'bytes':len(raw),'raw_sha256':sha,'png_sha256':hashlib.sha256((root/'textures'/meta['atlasPng']).read_bytes()).hexdigest(),'pngRawExactMatch':True,'alphaAlways255':True,'originalUnattenuatedJadeBaseSHA256':base_sha,'originalJadeBaseUnchanged':True,'colorHandling':'Load RGB as normalized linear data; no sRGB conversion.'}
(root/'tests/png-raw-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
