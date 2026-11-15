import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyUiTheme,parseUiTheme} from '../lib/ui-theme';
const css=readFileSync(new URL('../app/mission-theme.css',import.meta.url),'utf8');
function tokens(theme:'light'|'dark'){
 const light=css.match(/:root\s*\{([^}]+)\}/)![1];const dark=css.match(/html:root\[data-ui-theme="dark"\]\s*\{([^}]+)\}/)![1];
 const values=new Map([...`${light}${theme==='dark'?dark:''}`.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
 const resolve=(key:string):string=>{const value=values.get(key)!;const alias=value.match(/^var\((--[\w-]+)\)$/);return alias?resolve(alias[1]):value;};return resolve;
}
function lum(hex:string){const c=hex.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
function contrast(a:string,b:string){const [lo,hi]=[lum(a),lum(b)].sort((a,b)=>a-b);return(hi+.05)/(lo+.05);}
test('dark is the default; light preferences are explicit and affect only the root theme',()=>{
 for(const value of [null,undefined,'','system','invalid'])assert.equal(parseUiTheme(value),'dark');assert.equal(parseUiTheme('light'),'light');assert.equal(parseUiTheme('dark'),'dark');
 const calls:unknown[]=[];const root={dataset:{},classList:{toggle:(...args:unknown[])=>calls.push(args)}};applyUiTheme(root as unknown as HTMLElement,'dark');assert.deepEqual(root.dataset,{uiTheme:'dark'});assert.deepEqual(calls,[['dark',true]]);
});
test('dark mode is near-black with orange accents and readable ink across interface states',()=>{
 const v=tokens('dark');assert.ok(lum(v('--card'))<.03);assert.ok(lum(v('--background'))<.02);
 for(const surface of ['--card','--secondary','--mission-hover','--mission-success-bg','--mission-warning-bg'])for(const text of ['--foreground','--muted-foreground','--primary','--sun','--earth','--mission-success','--mission-warning','--destructive','--mission-link'])assert.ok(contrast(v(text),v(surface))>=4.5,`${text} on ${surface}`);
 for(const surface of ['--mission-title','--mission-selected'])assert.ok(contrast(v('--mission-ink'),v(surface))>=4.5);
 assert.ok(contrast(v('--primary-foreground'),v('--primary'))>=4.5);
});
