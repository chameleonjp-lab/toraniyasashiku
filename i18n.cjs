'use strict';
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./locales.json'));
  else root.ToraI18n=factory(JSON.parse(root.document.getElementById('tora-catalog').textContent));
})(typeof globalThis==='object'?globalThis:this,function(catalogs){
  for(const catalog of Object.values(catalogs))Object.freeze(catalog);
  Object.freeze(catalogs);
  function createTranslator(options){
    const key='torani_yasashiku_language';
    let saved=null;
    try{saved=options.storage.getItem(key);}catch(_){}
    let locale=options.client.resolveLocale(saved,options.languages);
    function setLocale(next){
      if(!Object.hasOwn(catalogs,next))return false;
      locale=next;
      try{options.storage.setItem(key,next);}catch(_){}
      return true;
    }
    function t(key,values={}){
      if(!Object.hasOwn(catalogs[locale],key))return key;
      const template=catalogs[locale][key];
      if(template===null)return null;
      return template.replace(/\{([a-zA-Z]+)\}/g,(token,name)=>Object.hasOwn(values,name)?String(values[name]):token);
    }
    function format(value){
      const row=options.client.languages.find(entry=>entry[0]===locale);
      return new Intl.NumberFormat(row[2]).format(value);
    }
    return Object.freeze({getLocale:()=>locale,setLocale,t,format});
  }
  return Object.freeze({catalogs,createTranslator});
});
