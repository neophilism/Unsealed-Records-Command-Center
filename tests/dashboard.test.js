import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {setTimeout as pause} from 'node:timers/promises';
import {JSDOM} from 'jsdom';

async function until(check) {
  for(let i=0;i<200;i++){if(check())return;await pause(10);}
  throw new Error('Dashboard did not reach its expected state');
}
test('Built dashboard switches label/family scopes, ignores an older report and preserves honest cached-data state',async t=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
  const window=dom.window,document=window.document;
  const menu={all:{name:'All accessible labels'},labels:[{id:'alpha',name:'Alpha'},{id:'beta',name:'Beta'}],families:[{id:'family',name:'Family',labelIds:['alpha','beta']}]};
  const response=data=>({ok:true,status:200,json:async()=>data});
  function summary(labelId='all') {
    return {synthetic:false,counts:{sales:labelId==='beta'?31:11,streams:4,plays:2,events:1,attendees:3},currencies:{USD:{salesMinor:500}},
      scope:{labelIds:labelId==='all'?['alpha','beta']:[labelId],familyId:null},
      byRelease:{[labelId+'-release']:{title:labelId==='beta'?'Beta Release':'Alpha Release',labelId:labelId==='all'?'alpha':labelId,sales:1,streams:4,plays:2}},
      bySource:{trackzero:{facts:1}},daily:[],platforms:{trackzero:{completedListens:4,speakerPlays:2,rewardsRedeemed:1,groovesGranted:3}}};
  }
  let pendingAlpha,failNext=false;
  const requested=[];
  window.fetch=async path=>{
    requested.push(path);
    if(path.includes('/scopes'))return response(menu);
    if(failNext){failNext=false;throw new Error('temporary outage');}
    const url=new URL(path,'http://localhost');const labelId=url.searchParams.get('labelId') || 'all';
    if(labelId==='alpha')return new Promise(resolve=>{pendingAlpha=()=>resolve(response(summary('alpha')));});
    if(url.searchParams.get('familyId'))return response({...summary(),scope:{labelIds:['alpha','beta'],familyId:'family'}});
    return response(summary(labelId));
  };
  const files=await readdir('dist/assets');const bundle=await readFile('dist/assets/'+files.find(f=>f.endsWith('.js')),'utf8');window.eval(bundle);
  await until(()=>document.querySelector('#label-scope')?.options.length===4);
  const select=document.querySelector('#label-scope');
  select.value='label:alpha';select.dispatchEvent(new window.Event('change',{bubbles:true}));
  await until(()=>pendingAlpha);
  select.value='label:beta';select.dispatchEvent(new window.Event('change',{bubbles:true}));
  await until(()=>document.body.textContent.includes('Beta Release'));
  pendingAlpha();await pause(30);
  assert.equal(document.querySelector('#label-scope').value,'label:beta');
  assert.equal(document.body.textContent.includes('Alpha Release'),false);
  assert.ok(requested.some(p=>p.endsWith('?labelId=beta')));
  const nav=name=>[...document.querySelectorAll('.sidebar nav button')].find(b=>b.textContent===name);
  nav('TrackZero').click();await until(()=>document.body.textContent.includes('Unlocked Grooves'));
  nav('SceneSignal').click();await until(()=>document.body.textContent.includes('Awaiting SceneSignal telemetry'));
  nav('Overview').click();await until(()=>document.body.textContent.includes('Beta Release'));
  failNext=true;document.querySelector('.refresh').click();await until(()=>document.body.textContent.includes('Cached engine data'));
  assert.equal(document.body.textContent.includes('Illustrative data only'),false);assert.equal(document.body.textContent.includes('Beta Release'),true);
  select.value='family:family';select.dispatchEvent(new window.Event('change',{bubbles:true}));
  await until(()=>document.body.textContent.includes('Live engine data')&&requested.some(p=>p.endsWith('?familyId=family')));
});
