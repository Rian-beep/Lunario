import {build} from 'esbuild';import {chromium} from 'playwright-core';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const output=process.argv[2]||'/tmp/lunario-eval-terrain-material-browser';await fs.mkdir(output,{recursive:true});
const source=`import * as T from 'three';import {useStreamedAtlasMaterials} from './components/workbench/scene/ion/atlas-material';
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(400,300);renderer.setClearColor(0x11151b);document.body.appendChild(renderer.domElement);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(40,4/3,.1,100);camera.position.set(3,2,4);camera.lookAt(0,0,0);
 const material=new T.MeshStandardMaterial({color:0xcccccc,roughness:1}),mesh=new T.Mesh(new T.BoxGeometry(2,2,2),material);scene.add(mesh);
 scene.add(new T.AmbientLight(0xffffff,.15));const light=new T.DirectionalLight(0xffffff,2);light.position.set(3,8,2);scene.add(light);
 useStreamedAtlasMaterials(mesh);renderer.render(scene,camera);
 const pixels=new Uint8Array(400*300*4),gl=renderer.getContext();gl.readPixels(0,0,400,300,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 const histogram={};for(let y=115;y<185;y++)for(let x=150;x<250;x++){const i=(y*400+x)*4,key=Array.from(pixels.slice(i,i+3)).join(',');histogram[key]=(histogram[key]||0)+1;}
 window.result={material:mesh.material.type,interiorColors:Object.entries(histogram).sort((a,b)=>b[1]-a[1]).slice(0,5)};`;
const base=execFileSync('git',['show','3c82b5a:navigator/components/workbench/scene/ion/atlas-material.ts'],{encoding:'utf8'});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const rows=[];
try{for(const version of ['before','after']){
 const context=await browser.newContext({viewport:{width:400,height:300}}),page=await context.newPage();
 const bundle=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,format:'iife',write:false,platform:'browser',plugins:version==='before'?[{name:'exact-base-material',setup(build){build.onLoad({filter:/ion\/atlas-material\.ts$/},()=>({contents:base,loader:'ts'}));}}]:[]});
 await page.setContent('<html><body style="margin:0"></body></html>');await page.addScriptTag({content:bundle.outputFiles[0].text});rows.push({version,...await page.evaluate(()=>window.result)});await page.screenshot({path:`${output}/${version}.png`});await context.close();
}}finally{await browser.close();}
console.log(JSON.stringify({browser:browser.version(),scope:'synthetic box geometry only; actual base and changed material conversion',rows},null,2));
if(rows[0].material!=='MeshBasicMaterial'||rows[1].material!=='MeshStandardMaterial'||rows[1].interiorColors.length<2)process.exitCode=1;
