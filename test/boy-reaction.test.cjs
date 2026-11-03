'use strict';
// Builtins only. Exact inline presenter and selected display/hit functions;
// no app IIFE, network, real DOM/audio/timers, or filesystem writes.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),catalog=JSON.parse(fs.readFileSync(path.join(root,'locales.json'),'utf8'));
const expected={ja:'3秒ゲット！',en:'3 seconds gained!',es:'¡3 segundos extra!','pt-BR':'Mais 3 segundos!','zh-Hans':'获得3秒！',fr:'3 secondes gagnées !',de:'3 Sekunden gewonnen!',ko:'3초 획득!',ru:'Ещё 3 секунды!',it:'3 secondi guadagnati!','zh-Hant':'獲得3秒！',id:'Dapat 3 detik!',tr:'3 saniye kazandın!',vi:'Nhận thêm 3 giây!',th:'ได้เพิ่ม 3 วินาที!'};
const inline=html.match(/<script id="tora-presentation">([\s\S]*?)<\/script>/);assert.ok(inline);
const functions=['say','text','react','hit'].map(name=>{const line=html.split('\n').find(s=>s.startsWith('function '+name+'('));assert.ok(line,name);return line;}).join('\n');
const msg=html.match(/,MSG=(\{[^\n]+\});/);assert.ok(msg);
for(const [locale,phrase] of Object.entries(expected))test(locale+': both actual display paths and +3-second effect',()=>{
 assert.equal(catalog[locale].boyReaction,phrase);
 let floating=[],effects=[],removed=0,count=[];
 const env={translator:{t:k=>catalog[locale][k],format:String},msg:{textContent:'',classList:{remove(){}}},msgTimer:0,startAt:10000,score:250,drop:2,W:600,H:400,
 document:{createElement:()=>({textContent:'',style:{setProperty(){}},remove(){}})},fx:{appendChild:e=>floating.push(e.textContent)},setTimeout(){},clamp:(n,a,b)=>Math.max(a,Math.min(n,b)),burst(){},playEffect:x=>effects.push(x),addCount:x=>count.push(x),remove:()=>removed++};
 const c=vm.createContext(env,{codeGeneration:{strings:false,wasm:false}});new vm.Script(inline[1]+'\nconst MSG='+msg[1]+';\n'+functions).runInContext(c,{timeout:1000});
 c.hit({type:'boy',x:120,y:180,removed:false});
 assert.equal(c.msg.textContent,phrase);assert.deepEqual(floating,[phrase]);assert.equal(c.startAt,13000);assert.equal(c.score,250);assert.equal(c.drop,2);assert.deepEqual(count,['boy']);assert.deepEqual(effects,['time']);assert.equal(removed,1);assert.equal(c.msgTimer,1100);
});
test('old phrase absent and editable presenter/catalog equal inline versions',()=>{
 assert.ok(!html.includes('ショタコンだよ！'));
 assert.equal(inline[1].trim(),fs.readFileSync(path.join(root,'presentation.cjs'),'utf8').trim());
 assert.deepEqual(JSON.parse(html.match(/<script type="application\/json" id="tora-catalog">([\s\S]*?)<\/script>/)[1]),catalog);
});
