'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const ackInline=/<script id="normal-score-ack8">\n([\s\S]*?)\n<\/script>/.exec(html);
const a=html.indexOf('async function submitScoreOnce('),b=html.indexOf('async function loadRankings(',a);assert.ok(a>=0&&b>a);
const valid=()=>({accepted:true,result_normalized_name:'Alice',result_display_name:'Alice',result_first_score:0,result_best_score:100,result_play_count:2,is_first_play:false,is_new_best:true});
function fixture(data){
  const calls=[],saves=[];const c={playParticipation:Object.freeze({displayName:'Alice',participates:true}),playerName:'Alice',score:100,scoreSubmitted:false,lastSubmitInfo:null,high:10,homeBest:{},GAME_SLUG:'torani_yasashiku',CLIENT_VERSION:'torani_yasashiku-ranking-v1',
    renderResultExtra(){},saveHigh:value=>saves.push(value),fmt:String,errorText:error=>String(error.message),console:{error(){},warn(){}},
    sb:{rpc:async(name,args)=>{calls.push({name,args});return {data,error:null};}}};
  vm.createContext(c,{codeGeneration:{strings:false,wasm:false}});new vm.Script((ackInline?ackInline[1]:'')+'\n'+html.slice(a,b)).runInContext(c,{timeout:100});return {c,calls,saves};
}
test('actual normal8 later receipt preserves legitimate first0 and updates best only after validation',async()=>{
  const f=fixture([valid()]);assert.equal(await f.c.submitScoreOnce(),true);assert.equal(f.c.lastSubmitInfo.result_first_score,0);assert.equal(f.c.high,100);assert.deepEqual(f.saves,[100]);
  assert.equal(f.calls[0].name,'submit_score');assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0].args)),{p_display_name:'Alice',p_game_slug:'torani_yasashiku',p_score:100,p_client_version:'torani_yasashiku-ranking-v1'});
});
test('actual normal8 first play and historical signed int4 fields remain legitimate',async()=>{
  const first=fixture([{...valid(),result_first_score:100,result_play_count:1,is_first_play:true}]);assert.equal(await first.c.submitScoreOnce(),true);
  const signed=fixture([{...valid(),result_first_score:-2147483648}]);assert.equal(await signed.c.submitScoreOnce(),true);
});
const invalidCases=Object.keys(valid()).map(key=>[key,()=>{const row=valid();delete row[key];return [row];}]);
invalidCases.push(['acceptedfalse',()=>[{...valid(),accepted:false}]],['wrongname',()=>[{...valid(),result_normalized_name:'Bob'}]],['bestbelowcurrent',()=>[{...valid(),result_best_score:0,is_new_best:false}]],['rowobjectnotarray',()=>valid()],['twoRows',()=>[valid(),valid()]],['invented9thfield',()=>[{...valid(),submission_id:'not-the-normal8-contract'}]]);
for(const [label,data] of invalidCases)test('actual caller rejects '+label+' without saving best or automatically resending',async()=>{
  const f=fixture(data());assert.equal(await f.c.submitScoreOnce(),false);assert.equal(f.c.lastSubmitInfo.error,true);assert.equal(f.c.high,10);assert.equal(f.saves.length,0);assert.equal(f.c.scoreSubmitted,true);
  assert.equal(await f.c.submitScoreOnce(),false);assert.equal(f.calls.length,1);
});

test('actual loaded validator bytes match the approved fixed pure source',()=>{
  const bytes=fs.readFileSync(path.join(__dirname,'..','normal-score-ack8.js'));assert.ok(ackInline);assert.equal(ackInline[1],bytes.toString('utf8'));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'157871e38fcc2e75184f3c44d09624aa06355afc7feebad4aa8a5cdfa04a2a16');
});
test('validation uses the actual submitted snapshot despite later global edits',async()=>{
  const f=fixture(null);let release;f.c.sb.rpc=(name,args)=>{f.calls.push({name,args});return new Promise(resolve=>{release=resolve;});};
  const pending=f.c.submitScoreOnce();f.c.playerName='Changed later';f.c.score=-700;release({data:[valid()],error:null});
  assert.equal(await pending,true);assert.equal(f.calls[0].args.p_display_name,'Alice');assert.equal(f.calls[0].args.p_score,100);assert.equal(f.c.lastSubmitInfo.result_best_score,100);
});
