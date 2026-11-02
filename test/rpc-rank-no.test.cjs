'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const inline=/<script id="tora-presentation">\n([\s\S]*?)\n<\/script>/.exec(html);assert.ok(inline);
const a=html.indexOf('function renderRanking('),b=html.indexOf('function lockResultActions(',a);assert.ok(a>=0&&b>a);
function row(rank,name='Same'){return {rank_no:rank,display_name:name,first_score:100,best_score:100,play_count:2,updated_at:'2026-11-02T18:48:00Z'};}
function render(rows,kind){
  const target={innerHTML:''};const c={rankState:{active:kind,best:rows,first:rows,loading:false},$:id=>id==='rankContent'?target:null,translator:{format:String,t:(key,v={})=>key==='rankRow'?`${v.rank}|${v.name}|${v.score}`:key}};
  vm.createContext(c,{codeGeneration:{strings:false,wasm:false}});new vm.Script(inline[1]+'\n'+html.slice(a,b)).runInContext(c,{timeout:100});c.renderRanking();return target.innerHTML;
}
for(const kind of ['best','first']){
  test(kind+' actual inline callee and caller preserve normal RPC competition ranks and order',()=>{
    const result=render([row(1),row(1),row(3,'Third')],kind);
    assert.equal((result.match(/>1\|Same\|100</g)||[]).length,2);assert.ok(result.includes('>3|Third|100<'));assert.equal(result.includes('>2|'),false);
  });
  for(const [label,value] of [['missing',undefined],['null',null],['zero',0],['negative',-1],['fraction',1.5],['string','1'],['boolean',true],['nan',NaN],['infinite',Infinity],['unsafe',Number.MAX_SAFE_INTEGER+1]])test(kind+' '+label+' rank is unknown rather than client-guessed',()=>assert.ok(render([row(value)],kind).includes('>—|Same|100<')));
  test(kind+' positive safe integer is preserved and existing cap30 remains',()=>{
    const rows=Array.from({length:31},(_,i)=>row(i+10,'Row'+i));const result=render(rows,kind);assert.equal((result.match(/class="rankLine"/g)||[]).length,30);assert.ok(result.includes('>39|Row29|100<'));assert.equal(result.includes('Row30'),false);
  });
}
