import fs from 'node:fs/promises';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
const directory=process.argv[2]||'/tmp/lunario-eval-terrain-confidence';await fs.mkdir(directory,{recursive:true});
const manifest=JSON.parse(await fs.readFile('public/data/south-pole-detail/manifest.json','utf8')),d=manifest.datasets.find(d=>d.id==='shackleton-stereo-2m');
const raw=gunzipSync(await fs.readFile('public/data/south-pole-detail/'+d.file)),receipts=[];
async function read(first,last){
 const response=await fetch(d.confidenceSourceUrl,{headers:{Range:`bytes=${first}-${last}`,Connection:'close'},signal:AbortSignal.timeout(20000)});
 if(response.status!==206){await response.body.cancel();throw new Error('Primary confidence source did not honor bounded range');}
 if(Number(response.headers.get('content-length'))>8000){await response.body.cancel();throw new Error('Unexpected large response');}
 const body=Buffer.from(await response.arrayBuffer());if(body.length!==last-first+1)throw new Error('Range size mismatch');
 const file=`range-${receipts.length}.bin`;await fs.writeFile(`${directory}/${file}`,body);receipts.push({url:d.confidenceSourceUrl,range:`bytes=${first}-${last}`,status:response.status,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex'),file});return body;
}
const header=(await read(0,7499)).toString('ascii'),recordBytes=Number(header.match(/RECORD_BYTES\s*=\s*(\d+)/)[1]),imageRecord=Number(header.match(/\^IMAGE\s*=\s*(\d+)/)[1]);
if(recordBytes!==2500||imageRecord!==4||! /SAMPLE_BITS\s*=\s*8\b/.test(header))throw new Error('Unexpected confidence layout');
const selected=[1250*2500+1250,833*2500+833,1666*2500+1666];
for(let i=0;i<raw.length/2&&selected.length<6;i+=997)if(raw.readInt16LE(i*2)===d.nodata)selected.push(i);
const samples=[];
for(const index of selected){const offset=(imageRecord-1)*recordBytes+index,confidence=(await read(offset,offset))[0],encoded=raw.readInt16LE(index*2);
 samples.push({row:Math.floor(index/d.width),col:index%d.width,confidence,retained:encoded!==d.nodata});if(encoded!==d.nodata&&confidence!==14)process.exitCode=1;
}
console.log(JSON.stringify({retrievedUtc:new Date().toISOString(),sourceCommit:'3c82b5aa02c4da52053fd3c12c180cca18fd6d4e',recordBytes,imageRecord,receipts,samples},null,2));
