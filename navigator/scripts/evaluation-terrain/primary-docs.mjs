// Source documents and unauthenticated endpoint probe; no tokens or huge asset reads.
import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
const directory=process.argv[2]||'/tmp/lunario-eval-terrain-docs';await fs.mkdir(directory,{recursive:true});
const urls=[
 'https://pgda.gsfc.nasa.gov/products/90',
 'https://pgda.gsfc.nasa.gov/products/78',
 'https://cesium.com/platform/cesium-ion/content/cesium-moon/',
 'https://raw.githubusercontent.com/NASA-AMMOS/3DTilesRendererJS/v0.5.4/example/three/ionLunar.js',
 'https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/SDP/NAC_DTM/ESALL_SR12/NAC_DTM_ESALL_SR12_README.TXT',
 'https://api.cesium.com/v1/assets/2684829/endpoint',
];
const rows=[];
for(const [index,url] of urls.entries()){
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(20000)});const reader=response.body.getReader(),chunks=[];let bytes=0;
  for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>1024*1024){await reader.cancel();throw new Error('1 MiB document budget exceeded');}chunks.push(value);}
  const body=Buffer.concat(chunks),file=`source-${index}.txt`;await fs.writeFile(`${directory}/${file}`,body);
  rows.push({url,status:response.status,bytes,sha256:createHash('sha256').update(body).digest('hex'),file,lastModified:response.headers.get('last-modified'),contentType:response.headers.get('content-type')});
 }catch(error){rows.push({url,error:error.message});}
}
const result={retrievedUtc:new Date().toISOString(),rows};await fs.writeFile(`${directory}/results.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
