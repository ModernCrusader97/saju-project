import assert from 'node:assert/strict';import zlib from 'node:zlib';import crypto from 'node:crypto';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
export function pngDecode(bytes){
 const b=Buffer.from(bytes);assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');let i=8,ihdr,parts=[];
 while(i<b.length){const len=b.readUInt32BE(i),tag=b.subarray(i+4,i+8).toString();if(tag==='IHDR')ihdr=b.subarray(i+8,i+8+len);if(tag==='IDAT')parts.push(b.subarray(i+8,i+8+len));i+=12+len;}
 const width=ihdr.readUInt32BE(0),height=ihdr.readUInt32BE(4),depth=ihdr[8],type=ihdr[9];assert.equal(depth,8);assert([2,6].includes(type));assert.equal(ihdr[12],0);
 const channels=type===6?4:3,rowlen=width*channels,raw=zlib.inflateSync(Buffer.concat(parts));assert.equal(raw.length,height*(rowlen+1));const unpacked=Buffer.alloc(width*height*channels);
 const paeth=(a,b,c)=>{const p=a+b-c,x=Math.abs(p-a),y=Math.abs(p-b),z=Math.abs(p-c);return x<=y&&x<=z?a:y<=z?b:c;};
 for(let y=0;y<height;y++){const filter=raw[y*(rowlen+1)],start=y*rowlen;for(let x=0;x<rowlen;x++){const left=x>=channels?unpacked[start+x-channels]:0,up=y?unpacked[start+x-rowlen]:0,upperLeft=y&&x>=channels?unpacked[start+x-rowlen-channels]:0;let pred=0;switch(filter){case 0:break;case 1:pred=left;break;case 2:pred=up;break;case 3:pred=Math.floor((left+up)/2);break;case 4:pred=paeth(left,up,upperLeft);break;default:throw Error('Unsupported PNG filter');}unpacked[start+x]=(raw[y*(rowlen+1)+1+x]+pred)&255;}}
 const data=new Uint8Array(width*height*4);for(let p=0;p<width*height;p++){data[p*4]=unpacked[p*channels];data[p*4+1]=unpacked[p*channels+1];data[p*4+2]=unpacked[p*channels+2];data[p*4+3]=channels===4?unpacked[p*channels+3]:255;}return {width,height,data,png_sha256:hash(b),pixel_sha256:hash(data)};
}
