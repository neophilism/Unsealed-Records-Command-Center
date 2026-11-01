const http=require('node:http');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const entry=`import {mountCatalog} from '/src/catalog-view.mjs';
const make=labelId=>({labelId,releaseId:'release_001',title:labelId==='label_0001'?'Album <img src=x onerror=alert(1)>':'Second label album',releaseDate:'2026-10-18',artworkUrl:null,works:[{workId:'work_0001',title:'Work & composition'}],tracks:[{trackId:'track_0001',title:'Song <script>alert(1)</script>',isrc:'USABC1234567',workIds:['work_0001']}],source:{system:'engine',status:'cached',revision:1,observedAtMs:1000}});
window.pending={};window.delay=false;
const client=mountCatalog(document.querySelector('#catalog'),{expectedSource:'engine',now:()=>2000,fetchImpl:async url=>{
 const label=url.split('/')[3];
 if(window.delay&&label==='label_0001') await new Promise(resolve=>{window.pending[label]=resolve;});
 return new Response(JSON.stringify(make(label)),{headers:{'content-type':'application/json'}});
}});
window.select=label=>client.select(label);window.dispose=()=>client.dispose();window.ready=true;`;
(async()=>{
 const server=http.createServer(async(req,res)=>{
  if(req.url==='/'){res.writeHead(200,{'content-type':'text/html'});return res.end('<!doctype html><html lang="en"><title>Catalog verification</title><main><div id="catalog"></div></main><script type="module" src="/test-entry.mjs"></script></html>');}
  if(req.url==='/test-entry.mjs'){res.writeHead(200,{'content-type':'text/javascript'});return res.end(entry);}
  if(/^\/src\/catalog-(?:view|client|identity|response)\.mjs$/.test(req.url)){
   res.writeHead(200,{'content-type':'text/javascript'});return res.end(await fs.readFile('.'+req.url));
  }
  res.writeHead(404);res.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage();page.setDefaultTimeout(5000);let dialogs=0;
  page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.ready===true);
  await page.evaluate(()=>window.select('label_0001'));
  assert.equal(await page.getByRole('table').count(),1);
  assert.equal(await page.locator('#catalog img').count(),0);
  assert.equal(await page.locator('#catalog script').count(),0);
  assert.match(await page.locator('#catalog').innerText(),/Cached observation/);
  assert.match(await page.getByRole('rowheader').innerText(),/<script>/);
  await page.evaluate(()=>{window.delay=true;void window.select('label_0001');});
  assert.equal(await page.getByRole('table').count(),0);
  assert.equal(await page.locator('#catalog').getAttribute('aria-busy'),'true');
  await page.evaluate(()=>window.select('label_0002'));
  assert.match(await page.locator('#catalog').innerText(),/Second label album/);
  await page.evaluate(()=>window.pending.label_0001());
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
  assert.doesNotMatch(await page.locator('#catalog').innerText(),/Album <img/);
  assert.equal(dialogs,0);
  await page.evaluate(()=>window.dispose());assert.equal(await page.locator('#catalog').innerText(),'');
  console.log('PASS: Chromium catalog rendering, escaped metadata, immediate scope clearing, stale response rejection, disposal; no external requests.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
