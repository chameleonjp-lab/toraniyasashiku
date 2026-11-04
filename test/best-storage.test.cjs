'use strict';
// Built-ins and selected real game functions only. Storage, UI and RPC are
// controlled doubles; no browser bootstrap, network, files written or deleted.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const KEY='torani_yasashiku_high_score';
const keys=[KEY,'torani_yasashiku_high_dom_v10','torani_yasashiku_high_dom_v7','torani_yasashiku_high_dom_v5','torani_yasashiku_best_score_dom_v4','torani_yasashiku_best_score_v2'];
function between(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a);return html.slice(a,b);}
const storageCode=between('function loadHigh(','function url(');
const finishCode=between('function finish(','function loop(');
const submitCode=between('async function submitScoreOnce(','async function loadRankings(');
const ack=html.match(/<script id="normal-score-ack8">\n([\s\S]*?)\n<\/script>/);assert.ok(ack);
function fixture(initial={}){
  const values=new Map(Object.entries(initial)),reads=[],writes=[];
  const control={failKey:null,failWrite:false};
  const c={KEY,high:0,score:200,mode:'play',resultRetired:false,scoreSubmitted:false,lastSubmitInfo:null,
    playParticipation:Object.freeze({displayName:'Alice',participates:true}),playerName:'Alice',
    GAME_SLUG:'torani_yasashiku',CLIENT_VERSION:'torani_yasashiku-ranking-v1',
    localStorage:{getItem(key){reads.push(key);if(key===control.failKey)throw Error('read unavailable');return values.get(key)??null;},
      setItem(key,value){if(control.failWrite)throw Error('write unavailable');writes.push([key,value]);values.set(key,value);}},
    homeBest:{},result:{classList:{remove(){}}},resultLabel:{},resultTitle:{},resultEmoji:{},fmt:String,
    playEffect(){},hud(){},rank:()=>['rank','description','emoji'],lockResultActions(){},renderResultExtra(){},
    submitScoreOnce:async()=>false,loadRankings:async()=>{},errorText:String,console:{warn(){},error(){}},
    sb:{rpc:async()=>({data:[{accepted:true,result_normalized_name:'Alice',result_display_name:'Alice',result_first_score:200,result_best_score:200,result_play_count:1,is_first_play:true,is_new_best:true}],error:null})}};
  vm.createContext(c,{codeGeneration:{strings:false,wasm:false}});
  new vm.Script(storageCode+'\n'+finishCode).runInContext(c,{timeout:100});
  return {c,control,values,reads,writes,loadSubmit(){new vm.Script(ack[1]+'\n'+submitCode).runInContext(c,{timeout:100});}};
}
for(const failedKey of keys)test('finish does not overwrite an unreadable record: '+failedKey,()=>{
  const f=fixture({[KEY]:'10000',[failedKey]:'10000'});f.control.failKey=failedKey;f.c.high=f.c.loadHigh();
  f.c.finish();assert.equal(f.values.get(KEY),'10000');assert.equal(f.writes.length,0);
});
test('startup read failure followed by recovery protects a higher current best',()=>{
  const f=fixture({[KEY]:'10000'});f.control.failKey=KEY;f.c.high=f.c.loadHigh();f.control.failKey=null;
  f.c.finish();assert.equal(f.values.get(KEY),'10000');assert.equal(f.c.high,10000);assert.equal(f.c.homeBest.textContent,'10000');
});
for(const legacyKey of keys.slice(1))test('recovered legacy best is migrated without changing its key: '+legacyKey,()=>{
  const f=fixture({[legacyKey]:'10000'});f.control.failKey=legacyKey;f.c.high=f.c.loadHigh();f.control.failKey=null;
  f.c.finish();assert.equal(f.values.get(KEY),'10000');assert.equal(f.values.get(legacyKey),'10000');assert.equal(f.c.high,10000);
});
test('a higher value saved after startup is not replaced by a stale lower result',()=>{
  const f=fixture({[KEY]:'100'});f.c.high=f.c.loadHigh();f.values.set(KEY,'10000');f.c.finish();
  assert.equal(f.values.get(KEY),'10000');assert.equal(f.c.high,10000);
});
test('normal improvement and legacy values retain their existing comparison',()=>{
  const f=fixture({[KEY]:'100',[keys[1]]:'150'});f.c.high=f.c.loadHigh();f.c.finish();
  assert.equal(f.values.get(KEY),'200');assert.equal(f.values.get(keys[1]),'150');assert.equal(f.c.high,200);
  assert.deepEqual([...new Set(f.reads)],keys);assert.deepEqual(f.writes,[[KEY,'200']]);
});
test('lower, equal and negative finish results leave saved best unchanged',()=>{
  for(const score of [199,200,-700]){const f=fixture({[KEY]:'200'});f.c.high=f.c.loadHigh();f.c.score=score;f.c.finish();assert.equal(f.values.get(KEY),'200');assert.equal(f.writes.length,0);}
});
test('write failure cannot escape finish or destroy the existing best',()=>{
  const f=fixture({[KEY]:'100'});f.c.high=f.c.loadHigh();f.control.failWrite=true;
  assert.doesNotThrow(()=>f.c.finish());assert.equal(f.values.get(KEY),'100');assert.equal(f.c.high,200);
});
test('validated ranking ACK also cannot overwrite a current best after startup failure',async()=>{
  const f=fixture({[KEY]:'10000'});f.loadSubmit();f.control.failKey=KEY;f.c.high=f.c.loadHigh();f.control.failKey=null;
  assert.equal(await f.c.submitScoreOnce(),true);assert.equal(f.values.get(KEY),'10000');assert.equal(f.c.high,10000);assert.equal(f.c.lastSubmitInfo.result_best_score,200);
});
test('validated ranking ACK does not write while a legacy read is failing',async()=>{
  const f=fixture({[KEY]:'10000'});f.loadSubmit();f.control.failKey=keys[3];f.c.high=f.c.loadHigh();
  assert.equal(await f.c.submitScoreOnce(),true);assert.equal(f.values.get(KEY),'10000');assert.equal(f.writes.length,0);
});
