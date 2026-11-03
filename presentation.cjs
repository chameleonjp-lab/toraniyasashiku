'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ToraPresentation=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  const comments=Object.freeze({rating0:'comment0',rating1:'comment1',rating2:'comment2',rating3:'comment3',rating4:'comment4'});
  const countKeys=Object.freeze({tiger:'countTiger',bath:'countBath',spinach:'countSpinach',clock:'countClock',boy:'countBoy',wifi:'countWifi'});
  function escape(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  function number(value,tr){return value!=null&&Number.isFinite(Number(value))?tr.format(Math.round(Number(value))):'—';}
  function result(state,tr){
    const rating=Object.hasOwn(comments,state.rankId)?state.rankId:null;
    const title=state.retired?tr.t('retiredLabel'):(rating?tr.t(rating):tr.t('resultLabel'));
    const label=tr.t(state.retired?'retiredLabel':'resultLabel');
    const countHtml=Object.entries(countKeys).map(([type,key])=>'<div>'+escape(tr.t(key,{count:number(state.counts[type]||0,tr)}))+'</div>').join('');
    let status;
    const info=state.info;
    if(info&&info.anonymous)status=escape(tr.t('anonymousNotSubmitted'));
    else if(!info)status=escape(tr.t('sending'));
    else if(info.error)status=escape(tr.t('submissionFailed'));
    else{
      const lines=[tr.t('currentScore',{score:number(state.score,tr)}),tr.t('firstScore',{score:number(info.result_first_score,tr)}),tr.t('bestScore',{score:number(info.result_best_score,tr)}),tr.t('playCount',{count:number(info.result_play_count,tr)})];
      if(info.is_first_play)lines.push(tr.t('firstRecorded'));
      if(info.is_new_best)lines.push(tr.t('newBest'));
      status=lines.map(escape).join('<br>');
    }
    const html='<span class="scoreLine">'+escape(tr.t('points',{score:number(state.score,tr)}))+'</span><br>'+escape(tr.t('drops',{count:number(state.drop,tr)}))+'<div class="itemCounts">'+countHtml+'</div><div class="syncBox" id="syncBox">'+status+'</div>';
    return Object.freeze({title,label,html,comment:rating?tr.t(comments[rating]):''});
  }
  function ranking(data,kind,tr){
    const title='<div class="rankTitle">'+escape(tr.t(kind==='first'?'firstRanking':'bestRanking'))+'</div>';
    let body;
    if(data===null)body=escape(tr.t('loading'));
    else if(data&&data.error)body=escape(tr.t('rankingFailed'));
    else{
      const rows=Array.isArray(data)?data:[];
      if(rows.length)return title+rows.slice(0,30).map(row=>{
        const name=row.display_name||row.player_name||row.name||tr.t('unnamed');
        const score=kind==='first'?row.first_score:row.best_score;
        const scoreText=Number.isInteger(score)&&score>=-2147483648&&score<=2147483647?tr.format(score):'—';
        return '<div class="rankLine">'+escape(tr.t('rankRow',{rank:Number.isSafeInteger(row.rank_no)&&row.rank_no>0?tr.format(row.rank_no):'—',name,score:scoreText}))+'</div>';
      }).join('');
      body=escape(tr.t('noRecords'));
    }
    return title+'<div class="rankLine">'+body+'</div>';
  }
  function notice(message,tr,sourceMessages){
    // This is a display-only source-string dictionary. It never selects gameplay
    // rules, scores, ranks, sound events or state transitions.
    const fixed=Object.freeze({'一時停止中':'paused','再開！':'resumed','残り5秒！':'fiveSeconds','虎に優しく':'initialMessage','🐯 虎を落とした… -3000点':'tigerMiss','👦🏻 逃した… -2秒':'boyMiss','🛜 配信できない！ -3000':'wifiMiss'});
    if(Object.hasOwn(fixed,message))return tr.t(fixed[message])??message;
    if(message===sourceMessages.spinachPenalty[0]+' -600')return tr.t('spinachPenalty')+' '+tr.format(-600);
    const groups={tiger:['tiger1','tiger2','tiger3'],bath:['bath1','bath2','bath3'],spinachTap:['spinachTap'],spinachPenalty:['spinachPenalty'],clock:['clockReaction'],wifi:['wifi1','wifi2','wifi3']};
    for(const [group,keys] of Object.entries(groups)){
      const index=sourceMessages[group].indexOf(message);
      if(index>=0&&keys[index])return tr.t(keys[index])??message;
    }
    // The original boy reaction is intentionally not rewritten while its
    // meaning-preserving translation is unresolved.
    return message;
  }
  return Object.freeze({escape,result,ranking,notice});
});
