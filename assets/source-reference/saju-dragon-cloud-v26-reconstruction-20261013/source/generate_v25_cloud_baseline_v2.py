"""Run the pinned literal V25 authoring source, with only OIDN disabled for this Blender build.
This is a V25 baseline, not a recovered V26. Original authoring sources are preserved.
"""
from pathlib import Path
import hashlib
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/"saju-dragon-volume-review-v22-face-v25-20261012/latest-static-face-v25/source/build_dragon_v8_volume_v25.py"
assert hashlib.sha256(source.read_bytes()).hexdigest()=="691202de75b0c3e11934a1fefa12dd1cf200e41edd88ffd9163b695b42308c4c"
code=source.read_text()
assert code.count("SCENE.cycles.use_denoising=True")==1
code=code.replace("SCENE.cycles.use_denoising=True","SCENE.cycles.use_denoising=False")
exec(compile(code,str(source),"exec"),{"__file__":str(source),"__name__":"__main__"})
