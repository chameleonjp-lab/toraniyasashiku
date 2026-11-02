'use strict';
// Pure presentation policy: no storage, networking, timers, audio or game mutation.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToraClient = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const languages = Object.freeze([
    ['ja','日本語','ja-JP'],['en','English','en-US'],['es','Español','es-ES'],
    ['pt-BR','Português (Brasil)','pt-BR'],['zh-Hans','简体中文','zh-CN'],
    ['fr','Français','fr-FR'],['de','Deutsch','de-DE'],['ko','한국어','ko-KR'],
    ['ru','Русский','ru-RU'],['it','Italiano','it-IT'],['zh-Hant','繁體中文','zh-TW'],
    ['id','Bahasa Indonesia','id-ID'],['tr','Türkçe','tr-TR'],
    ['vi','Tiếng Việt','vi-VN'],['th','ไทย','th-TH']
  ].map(Object.freeze));
  const publicUrl = 'https://chameleonjp.codeberg.page/torani_yasashiku/';
  const rankingUrl = 'https://chameleonjp-lab.github.io/chameleonjp_lab/ranking.html?game=torani_yasashiku';
  const tags = '#虎に優しく #ゲーム制作';
  const messages = Object.freeze({
    ja:['「虎に優しく」残り60秒から開始！指で手を動かし虎を受け止めよう。','「虎に優しく」で {score} 点！'],
    en:['虎に優しく: Start with 60 seconds! Move your hand with your finger to catch tigers.','I scored {score} points in 虎に優しく!'],
    es:['虎に優しく: ¡Empieza con 60 segundos! Mueve la mano con el dedo para atrapar tigres.','¡He conseguido {score} puntos en 虎に優しく!'],
    'pt-BR':['虎に優しく: Comece com 60 segundos! Mova a mão com o dedo para pegar tigres.','Fiz {score} pontos em 虎に優しく!'],
    'zh-Hans':['《虎に優しく》从60秒开始！用手指移动手掌，接住老虎。','我在《虎に優しく》中得了 {score} 分！'],
    fr:['虎に優しく : Commencez avec 60 secondes ! Déplacez la main avec votre doigt pour attraper les tigres.',"J’ai marqué {score} points dans 虎に優しく !"],
    de:['虎に優しく: Starte mit 60 Sekunden! Bewege die Hand mit dem Finger und fange Tiger.','Ich habe {score} Punkte in 虎に優しく erreicht!'],
    ko:['虎に優しく: 60초로 시작! 손가락으로 손을 움직여 호랑이를 받아 주세요.','虎に優しく에서 {score}점을 기록했어요!'],
    ru:['虎に優しく: Начните с 60 секунд! Двигайте ладонь пальцем и ловите тигров.','Мой результат в 虎に優しく: {score} очков!'],
    it:['虎に優しく: Inizia con 60 secondi! Muovi la mano con il dito per prendere le tigri.','Ho ottenuto {score} punti in 虎に優しく!'],
    'zh-Hant':['《虎に優しく》從60秒開始！用手指移動手掌，接住老虎。','我在《虎に優しく》中得了 {score} 分！'],
    id:['虎に優しく: Mulai dengan 60 detik! Gerakkan tangan dengan jari untuk menangkap harimau.','Saya mendapat {score} poin di 虎に優しく!'],
    tr:['虎に優しく: 60 saniye ile başla! Parmağınla eli hareket ettir ve kaplanları yakala.','虎に優しく oyununda {score} puan aldım!'],
    vi:['虎に優しく: Bắt đầu với 60 giây! Di chuyển bàn tay bằng ngón tay để đỡ hổ.','Tôi đạt {score} điểm trong 虎に優しく!'],
    th:['虎に優しく: เริ่มด้วยเวลา 60 วินาที! ใช้นิ้วเลื่อนมือเพื่อรับเสือ','ฉันได้ {score} คะแนนใน 虎に優しく!']
  });
  function isSupported(value) { return languages.some(row => row[0] === value); }
  function languageFromLocale(value) {
    const raw=String(value || '').trim().replace(/_/g,'-').toLowerCase();
    if (!raw) return null;
    if (raw.startsWith('zh')) {
      if (raw.includes('hant')) return 'zh-Hant';
      if (raw.includes('hans')) return 'zh-Hans';
      return /(?:^|-)(tw|hk|mo)(?:-|$)/.test(raw) ? 'zh-Hant' : 'zh-Hans';
    }
    const base=raw.split('-')[0];
    if(base==='pt') return 'pt-BR';
    return isSupported(base) ? base : null;
  }
  function resolveLocale(saved, browserLocales) {
    if(isSupported(saved)) return saved;
    for(const locale of Array.isArray(browserLocales) ? browserLocales : []) {
      const code=languageFromLocale(locale);
      if(code) return code;
    }
    return 'en';
  }
  function captureParticipation(value) {
    const displayName=typeof value==='string' ? value.trim().slice(0,20) : '';
    return Object.freeze({displayName, participates:displayName.length>0});
  }
  function shareText(options) {
    const locale=isSupported(options.locale) ? options.locale : 'en';
    const result=options.screen==='result';
    if(result && (typeof options.score!=='number' || !Number.isFinite(options.score))) throw new TypeError('A finite current score is required');
    const numberLocale=languages.find(row=>row[0]===locale)[2];
    const line=result ? messages[locale][1].replace('{score}',new Intl.NumberFormat(numberLocale).format(options.score)) : messages[locale][0];
    return line+'\n'+publicUrl+'\n'+tags;
  }
  function shareIntent(text) { return 'https://twitter.com/intent/tweet?text='+encodeURIComponent(text); }
  function createShareAction(options) {
    let lastActivation=-Infinity;
    return function activateShare(event) {
      if(options.getScreen()!==options.screen || options.isDisabled() || (event.button!=null&&event.button!==0))return;
      event.preventDefault();
      const now=options.now();
      if(now-lastActivation<500)return;
      lastActivation=now;
      const text=options.getText();
      let popup;
      try {
        popup=options.openPopup('', '_blank');
        if(!popup)throw new Error('Popup unavailable');
        popup.opener=null;
        if(popup.opener!==null)throw new Error('Popup opener could not be detached');
        const destination=popup.document.createElement('a');
        destination.href=shareIntent(text);
        destination.target='_self';
        destination.rel='noreferrer';
        destination.referrerPolicy='no-referrer';
        popup.document.body.append(destination);
        destination.click();
      } catch (_) {
        try { if(popup)popup.close(); } catch (_) {}
        options.fallback(text);
      }
    };
  }
  return Object.freeze({languages,publicUrl,rankingUrl,resolveLocale,captureParticipation,shareText,shareIntent,createShareAction});
});
