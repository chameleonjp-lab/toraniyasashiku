'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const client=require('../client-core.cjs');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const ackInline=/<script id="normal-score-ack8">\n([\s\S]*?)\n<\/script>/.exec(html);assert.ok(ackInline);
function declaration(name){
  const expression=new RegExp('(?:async\\s+)?function '+name+'\\(');
  const match=expression.exec(html);
  assert.ok(match,'target declaration exists');
  const next=html.slice(match.index+match[0].length).search(/\b(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/);
  assert.ok(next>=0,'target declaration has a following declaration');
  return html.slice(match.index,match.index+match[0].length+next).trim();
}
function fixture(value){
  const hidden={classList:{add(){},remove(){}}};
  const events={starts:[],saved:[],rpc:0,renders:0,locks:[],rankReads:0};
  const context={ToraClient:client,mode:'home',nameComposing:false,playerName:'Previous',
    playerNameInput:{value},savedName:()=> 'Saved Alice',saveName:n=>events.saved.push(n),
    nameScreen:hidden,home:hidden,result:hidden,pauseBox:hidden,nameError:{textContent:''},
    playParticipation:null,resultRetired:false,scoreSubmitted:false,lastSubmitInfo:null,score:-3000,
    rankState:{active:'best',best:null,first:null},
    renderResultExtra(){events.renders++;},renderRanking(){events.rankReads++;},
    rank:()=>['rank','description','emoji'],hud(){},saveHigh(){},homeBest:{textContent:''},
    resultLabel:{textContent:''},resultTitle:{textContent:''},resultEmoji:{textContent:''},
    lockResultActions:on=>events.locks.push(on),unlockSound(){},playEffect(){},
    GAME_SLUG:'torani_yasashiku',CLIENT_VERSION:'torani_yasashiku-ranking-v1',
    high:0,console:{warn(){},error(){}},errorText:()=> 'test rejection',
    sb:{rpc:async()=>{events.rpc++;throw new Error('test stub: no network');}},
    start:()=>events.starts.push({name:context.playerName,participation:context.playParticipation}),
    setTimeout:()=>{throw new Error('unexpected delayed name gate');}
  };
  vm.createContext(context,{codeGeneration:{strings:false,wasm:false}});
  new vm.Script(ackInline[1]+'\n'+['startWithNameGate','submitScoreOnce','loadRankings','finish'].map(declaration).join('\n')).runInContext(context,{timeout:100});
  return {context,events};
}
test('actual Enter handler ignores IME keyCode 229 and composition events',()=>{
  const prefix='playerNameInput.addEventListener("keydown",';
  const start=html.indexOf(prefix)+prefix.length;
  const end=html.indexOf(';bind($("endGame")',start)-1;
  assert.ok(start>=prefix.length&&end>start,'specific key handler boundaries exist');
  const context={nameComposing:false,starts:0,confirmName(){context.starts++;}};
  vm.createContext(context,{codeGeneration:{strings:false,wasm:false}});
  const handler=new vm.Script('('+html.slice(start,end)+')').runInContext(context,{timeout:100});
  let prevented=0;
  const event={key:'Enter',keyCode:229,isComposing:false,preventDefault(){prevented++;}};
  handler(event);assert.equal(context.starts,0,'IME 229 must not start');
  handler({...event,keyCode:13,isComposing:true});assert.equal(context.starts,0);
  context.nameComposing=true;handler({...event,keyCode:13});assert.equal(context.starts,0);
  context.nameComposing=false;handler({...event,keyCode:13});assert.equal(context.starts,1);assert.equal(prevented,1);
});
test('home blank name starts anonymously instead of resurrecting a saved name',()=>{
  const {context,events}=fixture('');context.startWithNameGate();
  assert.equal(events.starts.length,1);
  assert.equal(events.starts[0].name,'');
  assert.equal(events.starts[0].participation.participates,false);
  assert.deepEqual(events.saved,['']);
});
test('finish then and finally cannot update a new play after its old submission settles',async()=>{
  const {context,events}=fixture('Bob');context.startWithNameGate();context.mode='play';
  let resolve;
  context.submitScoreOnce=()=>new Promise(done=>{resolve=done;});
  let rankingCalls=0;context.loadRankings=()=>{rankingCalls++;};
  context.finish();
  context.mode='result';context.playerNameInput.value='';context.startWithNameGate();
  const renders=events.renders,locks=events.locks.length;
  resolve(true);
  await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(rankingCalls,0,'old finish must not start a new ranking read');
  assert.equal(events.renders,renders,'old finally must not rerender the next play');
  assert.equal(events.locks.length,locks,'old finally must not mutate next play action state');
});
test('ranking responses already in flight cannot replace the next play ranking state',async()=>{
  const {context}=fixture('Bob');context.startWithNameGate();
  const resolves=[];context.sb.rpc=()=>new Promise(done=>resolves.push(done));
  const request=context.loadRankings();
  context.mode='result';context.playerNameInput.value='';context.startWithNameGate();
  const current={active:'first',best:null,first:null};context.rankState=current;
  for(const resolve of resolves) resolve({data:[],error:null});
  await request;
  assert.equal(context.rankState,current,'the next play ranking state reference must be preserved');
  assert.equal(context.rankState.best,null,'old best result must not mutate new state');
  assert.equal(context.rankState.first,null,'old first result must not mutate new state');
});
test('home name snapshot is fixed before start and not changed by later edits',()=>{
  const {context,events}=fixture('  Bob  ');context.startWithNameGate();
  context.playerNameInput.value='Mallory';
  assert.equal(events.starts[0].name,'Bob');
  assert.equal(events.starts[0].participation.displayName,'Bob');
  assert.ok(Object.isFrozen(events.starts[0].participation));
});
test('anonymous finish never enters the existing score RPC',async()=>{
  const {context,events}=fixture('');
  context.playParticipation=client.captureParticipation('');
  await context.submitScoreOnce();
  assert.equal(events.rpc,0);
});
test('late score response cannot overwrite the next play after a new start',async()=>{
  const {context}=fixture('Bob');
  context.startWithNameGate();
  let resolve;
  context.sb.rpc=()=>new Promise(done=>{resolve=done;});
  const oldRequest=context.submitScoreOnce();
  const nextReceipt={anonymous:true};
  context.mode='result';
  context.playerNameInput.value='';
  context.startWithNameGate();
  context.lastSubmitInfo=nextReceipt;
  resolve({data:[{accepted:true,result_normalized_name:'Bob',result_display_name:'Bob',result_best_score:-3000,result_first_score:-3000,result_play_count:1,is_first_play:true,is_new_best:true}],error:null});
  await oldRequest;
  assert.equal(context.lastSubmitInfo,nextReceipt,'stale response must not replace the next play receipt');
});
test('late score rejection cannot replace the next play receipt',async()=>{
  const {context}=fixture('Bob');context.startWithNameGate();
  let reject;context.sb.rpc=()=>new Promise((_,fail)=>{reject=fail;});
  const request=context.submitScoreOnce();
  context.mode='result';context.playerNameInput.value='';context.startWithNameGate();
  const receipt={anonymous:true};context.lastSubmitInfo=receipt;
  reject(new Error('controlled old failure'));await request;
  assert.equal(context.lastSubmitInfo,receipt);
});
test('late ranking rejection cannot mutate next play rankings',async()=>{
  const {context}=fixture('Bob');context.startWithNameGate();
  const rejects=[];context.sb.rpc=()=>new Promise((_,fail)=>rejects.push(fail));
  const request=context.loadRankings();
  context.mode='result';context.playerNameInput.value='';context.startWithNameGate();
  const state={active:'best',best:null,first:null};context.rankState=state;
  rejects.forEach(reject=>reject(new Error('controlled old ranking failure')));
  await request;assert.equal(context.rankState,state);assert.equal(state.best,null);assert.equal(state.first,null);
});
test('current named play keeps its existing legacy score and ranking behavior',async()=>{
  const {context}=fixture('Bob');context.startWithNameGate();
  const receipt={accepted:true,result_normalized_name:'Bob',result_display_name:'Bob',result_best_score:-100,result_first_score:-3000,result_play_count:2,is_first_play:false,is_new_best:false};
  const requests=[];
  context.sb.rpc=async(name,payload)=>{requests.push({name,payload});return {data:name==='submit_score'?[receipt]:[],error:null};};
  assert.equal(await context.submitScoreOnce(),true);
  assert.deepEqual(JSON.parse(JSON.stringify(context.lastSubmitInfo)),receipt);
  assert.equal(requests[0].payload.p_display_name,'Bob');
  assert.equal(requests[0].payload.p_score,-3000);
  assert.equal(requests[0].payload.p_game_slug,'torani_yasashiku');
  assert.equal(requests[0].payload.p_client_version,'torani_yasashiku-ranking-v1');
  await context.loadRankings();
  assert.equal(context.rankState.best.length,0);assert.equal(context.rankState.first.length,0);
  assert.equal(requests.length,3);
});
test('finish exposes retirement as boolean presentation state, not a translated label',async()=>{
  const {context}=fixture('Bob');context.startWithNameGate();context.mode='play';context.resultRetired=false;
  context.submitScoreOnce=async()=>false;context.loadRankings=async()=>{};
  context.finish(false,true);assert.equal(context.resultRetired,true);
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  context.mode='play';context.finish(false,false);assert.equal(context.resultRetired,false);
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
});
