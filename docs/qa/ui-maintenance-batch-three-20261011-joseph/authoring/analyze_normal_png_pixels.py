import struct, zlib, hashlib, json
from pathlib import Path
root = Path('D:/Codex/Results/SaJuUiBatchThree-20261011-Joseph')
names = ['time-create-known-control','time-create-unknown-control','time-join-known-control','time-join-unknown-control','id-valid-control','choice-pointer-control','result-valid-control','result-error-control']
def decode_png(p):
    data = p.read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    chunks, compressed, pos = [], bytearray(), 8
    while pos < len(data):
        length = struct.unpack('>I',data[pos:pos+4])[0]
        typ, block = data[pos+4:pos+8], data[pos+8:pos+8+length]
        assert zlib.crc32(typ+block) & 0xffffffff == struct.unpack('>I',data[pos+8+length:pos+12+length])[0]
        chunks.append(typ.decode('ascii'))
        if typ == b'IHDR': w,h,depth,color,compression,filter_method,interlace = struct.unpack('>IIBBBBB',block)
        if typ == b'IDAT': compressed.extend(block)
        pos += 12+length
    assert depth == 8 and color in (2,6) and compression == 0 and filter_method == 0 and interlace == 0
    channels = 3 if color == 2 else 4
    raw, stride, previous, out = zlib.decompress(compressed), w*channels, bytearray(w*channels), bytearray()
    assert len(raw) == h*(stride+1)
    def paeth(a,b,c):
        p = a+b-c; pa,pb,pc = abs(p-a),abs(p-b),abs(p-c)
        return a if pa<=pb and pa<=pc else b if pb<=pc else c
    filters = []
    for y in range(h):
        start=y*(stride+1); filter_type=raw[start]; filters.append(filter_type); row=bytearray(raw[start+1:start+1+stride])
        assert 0 <= filter_type <= 4
        for x in range(stride):
            left = row[x-channels] if x>=channels else 0
            up = previous[x]; upper_left = previous[x-channels] if x>=channels else 0
            predictor = (0,left,up,(left+up)//2,paeth(left,up,upper_left))[filter_type]
            row[x]=(row[x]+predictor)&255
        out.extend(row); previous=row
    return {'width':w,'height':h,'channels':channels,'chunks':chunks,'filters':filters,'pixels':bytes(out)}
pairs=[]
for width in (390,1440):
    for name in names:
        filename=f'{name}-{width}.png'; ap=root/'before-v2'/filename; bp=root/'final'/filename
        a,b=decode_png(ap),decode_png(bp)
        assert (a['width'],a['height'],a['channels']) == (b['width'],b['height'],b['channels'])
        changed=[]; max_delta=0; channels=a['channels']; first_samples=[]
        for idx in range(0,len(a['pixels']),channels):
            aa,bb=a['pixels'][idx:idx+channels],b['pixels'][idx:idx+channels]
            if aa != bb:
                x=(idx//channels)%a['width']; y=(idx//channels)//a['width']; changed.append((x,y))
                max_delta=max(max_delta,max(abs(c-d) for c,d in zip(aa,bb)))
                if len(first_samples)<12: first_samples.append({'x':x,'y':y,'before':list(aa),'final':list(bb)})
        bounds=None if not changed else {'left':min(x for x,y in changed),'top':min(y for x,y in changed),'right':max(x for x,y in changed),'bottom':max(y for x,y in changed)}
        pairs.append({'file':filename,'width':a['width'],'height':a['height'],'channels':channels,'byte_identical':ap.read_bytes()==bp.read_bytes(),'pixel_identical':not changed,'different_pixels':len(changed),'total_pixels':a['width']*a['height'],'max_channel_delta':max_delta,'bounds':bounds,'first_samples':first_samples,'before_pixel_sha256':hashlib.sha256(a['pixels']).hexdigest(),'final_pixel_sha256':hashlib.sha256(b['pixels']).hexdigest(),'chunk_types_identical':a['chunks']==b['chunks'],'row_filters_identical':a['filters']==b['filters']})
proof={'status':'RETAINED_RAW_PNG_PIXEL_DIFFERENCE_ANALYSIS_BEFORE_COMMIT','analysis':'Independent standard-library PNG chunk CRC, zlib and reverse-filter decode. No image edited, masked or regenerated.','pairs':pairs,'byte_identical_count':sum(p['byte_identical'] for p in pairs),'pixel_identical_count':sum(p['pixel_identical'] for p in pairs),'generated_images':0,'altered_images':0,'commit_created':False,'push_performed':False}
with (root/'normal-ui-pixel-difference-diagnostic.json').open('x',encoding='utf-8',newline='\n') as f: json.dump(proof,f,ensure_ascii=False,indent=2);f.write('\n')
print(json.dumps({'byte_identical_count':proof['byte_identical_count'],'pixel_identical_count':proof['pixel_identical_count'],'differences':[p for p in pairs if not p['pixel_identical']]}))