'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ToraAudio=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  const enabledKey='torani_yasashiku_sound_enabled';
  const volumeKey='torani_yasashiku_sound_volume';
  const tones=Object.freeze({catch:[660,.10,'sine'],tap:[880,.07,'triangle'],penalty:[160,.13,'triangle'],time:[440,.10,'sine'],bonus:[990,.15,'sine'],countdown:[500,.06,'triangle'],start:[740,.12,'sine'],finish:[520,.20,'sine'],ui:[360,.04,'sine']});
  function createAudioController(options){
    let enabled=true,volume=.5,context=null,disposed=false,resumeQueued=false,lastAttempt=null;
    const voices=new Set(),lastPlayed=new Map();
    function read(key){try{return options.storage.getItem(key);}catch(_){return null;}}
    function save(key,value){try{options.storage.setItem(key,String(value));}catch(_){}}
    const savedEnabled=read(enabledKey),savedVolume=read(volumeKey);
    if(savedEnabled==='false')enabled=false;
    if(typeof savedVolume==='string'&&savedVolume.trim()!==''){
      const parsed=Number(savedVolume);
      if(Number.isFinite(parsed)&&parsed>=0&&parsed<=1)volume=parsed;
    }
    function cleanup(voice){
      if(voice.cleaned)return;
      voice.cleaned=true;voices.delete(voice);
      try{if(voice.oscillator)voice.oscillator.disconnect();}catch(_){}
      try{if(voice.gain)voice.gain.disconnect();}catch(_){}
    }
    function silence(){
      for(const voice of [...voices]){
        try{voice.oscillator.stop();}catch(_){}
        cleanup(voice);
      }
      lastPlayed.clear();
    }
    function unlock(){
      if(disposed||!enabled||volume===0||options.isHidden())return Promise.resolve(false);
      try{
        if(!context||context.state==='closed')context=options.createContext();
        if(!context)return Promise.resolve(false);
        if(context.state==='running')return Promise.resolve(true);
        if(resumeQueued)return lastAttempt||Promise.resolve(false);
        resumeQueued=true;
        Promise.resolve().then(()=>{resumeQueued=false;});
        const attemptContext=context;
        const resumed=attemptContext.resume();
        lastAttempt=Promise.resolve(resumed).then(()=>!disposed&&enabled&&volume>0&&!options.isHidden()&&context===attemptContext&&attemptContext.state==='running',()=>false);
        return lastAttempt;
      }catch(_){return Promise.resolve(false);}
    }
    function play(event){
      const tone=Object.hasOwn(tones,event)?tones[event]:null;
      if(!tone||disposed||!enabled||volume===0||options.isHidden()||!context||context.state!=='running')return false;
      const now=options.now();
      if(voices.size>=8||now-(lastPlayed.get(event)??-Infinity)<60)return false;
      const voice={oscillator:null,gain:null,cleaned:false};
      try{
        voice.oscillator=context.createOscillator();
        voice.gain=context.createGain();
        const at=context.currentTime;
        voice.oscillator.type=tone[2];
        voice.oscillator.frequency.setValueAtTime(tone[0],at);
        voice.gain.gain.setValueAtTime(.0001,at);
        voice.gain.gain.linearRampToValueAtTime(volume*.18,at+.008);
        voice.gain.gain.exponentialRampToValueAtTime(.0001,at+tone[1]);
        voice.oscillator.connect(voice.gain);voice.gain.connect(context.destination);
        voice.oscillator.onended=()=>cleanup(voice);
        voices.add(voice);
        voice.oscillator.start(at);voice.oscillator.stop(at+tone[1]+.01);
        lastPlayed.set(event,now);
        return true;
      }catch(_){
        try{if(voice.oscillator)voice.oscillator.stop();}catch(_){}
        cleanup(voice);return false;
      }
    }
    function setEnabled(value){enabled=Boolean(value);save(enabledKey,enabled);if(!enabled)silence();}
    function setVolume(value){const next=Number(value);if(!Number.isFinite(next))return;volume=Math.max(0,Math.min(1,next));save(volumeKey,volume);if(volume===0)silence();}
    function dispose(){
      if(disposed)return;
      disposed=true;silence();
      try{if(context&&typeof context.close==='function')Promise.resolve(context.close()).catch(()=>{});}catch(_){}
      context=null;
    }
    return Object.freeze({isEnabled:()=>enabled,getVolume:()=>volume,activeVoices:()=>voices.size,setEnabled,setVolume,unlock,play,silence,dispose});
  }
  return Object.freeze({createAudioController});
});
