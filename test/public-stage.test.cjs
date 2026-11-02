'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const bytes=fs.readFileSync(path.join(root,'index.html'));
const html=bytes.toString('utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'publish-manifest.json'),'utf8'));
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
test('the public candidate preserves the reviewed runtime bytes',()=>{
  assert.deepEqual(manifest.runtimeFiles,['index.html']);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.runtimeSHA256);
  assert.equal(manifest.runtimeSHA256,'283475f7f8a3ce7a83139aef8d722e8fc1a8a7908c54e96896c5030f156169ab');
});
test('standalone editable sources match the scripts actually included in the page',()=>{
  for(const [id,file] of Object.entries(manifest.inlineSources)){
    const entries=scripts.filter(entry=>entry[1].includes('id="'+id+'"'));
    assert.equal(entries.length,1,id);
    const source=fs.readFileSync(path.join(root,file),'utf8');
    if(id==='tora-catalog')assert.deepEqual(JSON.parse(entries[0][2]),JSON.parse(source));
    else assert.equal(entries[0][2].replace(/^\n/,'').replace(/\n+$/,''),source.replace(/\n+$/,''),id);
  }
});
test('scripts compile without executing the game or external library',()=>{
  for(const entry of scripts){
    if(/\bsrc=/.test(entry[1])||/application\/json/.test(entry[1]))continue;
    new vm.Script(entry[2]);
  }
  const sources=scripts.map(entry=>/\bsrc="([^"]+)"/.exec(entry[1])?.[1]).filter(Boolean);
  assert.deepEqual(sources,manifest.externalRuntime);
});
test('15 catalogs and unchanged game identity are explicit',()=>{
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'locales.json'),'utf8'));
  assert.deepEqual(Object.keys(catalog).sort(),['ja','en','es','pt-BR','zh-Hans','fr','de','ko','ru','it','zh-Hant','id','tr','vi','th'].sort());
  assert.ok(html.includes('const GAME_SLUG="torani_yasashiku";'));
  assert.ok(html.includes(manifest.canonicalURL));
  assert.ok(html.includes('ranking.html?game=torani_yasashiku'));
  for(const locale of Object.keys(catalog))assert.equal(catalog[locale].boyReaction,null,'unresolved legacy phrase remains documented, not falsely translated');
});
test('missing social image is pending, never a declared broken local asset',()=>{
  const images=[...html.matchAll(/<meta\b[^>]*(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*>/g)];
  if(images.length===0){assert.equal(manifest.thumbnail.status,'pending');assert.ok(manifest.thumbnail.reason);return;}
  for(const match of images){
    const content=/\bcontent=["']([^"']+)["']/.exec(match[0]);assert.ok(content,'declared image must have a nonempty content');
    assert.ok(!/^(?:https?:)?\/\//.test(content[1]),'remote assets need separate verified publication review');
    const target=path.resolve(root,content[1]);assert.ok(target.startsWith(root+path.sep),'image must be within the publication root');
    assert.ok(fs.statSync(target).isFile(),'declared image file must exist');
  }
});
