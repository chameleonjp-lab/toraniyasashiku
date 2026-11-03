'use strict';
// Complete closure: built-in reads/VM + the explicit pure presentation module.
// The game bootstrap, CDN, DOM, audio, RPC and timers are never executed.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const presentation=require('../presentation.cjs');
const inline=/<script id="tora-presentation">\n([\s\S]*?)\n<\/script>/.exec(html);assert.ok(inline);
const start=html.indexOf('function renderRanking('),end=html.indexOf('function lockResultActions(',start);assert.ok(start>=0&&end>start);
const legacyStart=html.indexOf('function rowScore('),legacyEnd=html.indexOf('function renderRanking(',legacyStart);assert.ok(legacyStart>=0&&legacyEnd>legacyStart);
const translator={format:String,t:(key,v={})=>key==='rankRow'?`${v.rank}|${v.name}|${v.score}`:key};
function row(extra={}){return {rank_no:1,display_name:'A',first_score:9,best_score:7,play_count:2,updated_at:'2026-11-02T18:48:00Z',...extra};}
function actual(rows,kind){const target={innerHTML:''},c={rankState:{active:kind,best:rows,first:rows,loading:false},$:id=>id==='rankContent'?target:null,translator};vm.createContext(c,{codeGeneration:{strings:false,wasm:false}});new vm.Script(inline[1]+'\n'+html.slice(start,end)+'\n'+html.slice(legacyStart,legacyEnd)).runInContext(c,{timeout:100});c.renderRanking();return {html:target.innerHTML,legacy:c.rowScore};}
for(const kind of ['best','first']){
 const field=kind==='best'?'best_score':'first_score';
 for(const [label,value] of [['missing',undefined],['null',null],['zero string','0'],['negative string','-700'],['positive string','42'],['fraction string','1.5'],['empty',''],['space',' '],['boolean false',false],['boolean true',true],['object',{}],['array',[]],['NaN',NaN],['infinite',Infinity],['negative infinite',-Infinity],['fraction',1.5],['above int4',2147483648],['below int4',-2147483649]]){
  test(kind+' '+label+' is unknown despite aliases/other-tab score',()=>{
   const record=row({[field]:value,score:55,result_first_score:66,result_best_score:77});if(label==='missing')delete record[field];
   const view=actual([record],kind);assert.ok(view.html.includes('>1|A|—<'),view.html);assert.ok(presentation.ranking([record],kind,translator).includes('>1|A|—<'));assert.equal(view.legacy(record,kind),null);
  });
 }
 test(kind+' numeric int4 zero/negative/boundaries stay exact with ties, repeated names and order',()=>{
  const values=[0,-700,-2147483648,2147483647],records=values.map((score,i)=>row({rank_no:[1,1,3,4][i],display_name:i<2?'Same':'Row'+i,[field]:score}));
  const view=actual(records,kind),moduleView=presentation.ranking(records,kind,translator);let previous=-1;
  for(let i=0;i<values.length;i++){const text='>'+records[i].rank_no+'|'+records[i].display_name+'|'+values[i]+'<';const at=view.html.indexOf(text);assert.ok(at>previous);previous=at;assert.ok(moduleView.includes(text));assert.equal(view.legacy(records[i],kind),values[i]);}
 });
 test(kind+' ignores legacy alias fields when authoritative field is a valid different score',()=>{
  const record=row({[field]:-123,score:500,result_first_score:600,result_best_score:700});assert.ok(actual([record],kind).html.includes('>1|A|-123<'));
 });
}
