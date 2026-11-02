import {chromium} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
await mkdir('submission/screenshots',{recursive:true});
const verified=JSON.parse(await readFile('artifacts/live/verified.json','utf8'));
await context.addInitScript(state=>localStorage.setItem('crowdcase-workspaces-v1',JSON.stringify(state)),verified.state);
await page.goto('http://127.0.0.1:8782');
await page.screenshot({path:'submission/screenshots/01-problem.png'});
await page.locator('#workbench').scrollIntoViewIfNeeded();await page.evaluate(()=>scrollTo(0,document.querySelector('#workbench').offsetTop+100));
await page.screenshot({path:'submission/screenshots/02-real-case-replay.png'});
await page.locator('#exampleFix').click();await page.locator('#runSuite').click();await page.waitForFunction(()=>document.querySelector('#version').textContent==='v2');
await page.screenshot({path:'submission/screenshots/03-checked-fix.png'});
await writeFile('artifacts/live/fixed-state.json',JSON.stringify(await page.evaluate(()=>JSON.parse(localStorage.getItem('crowdcase-workspaces-v1'))),null,2));
for(const [id,file]of [['exportTests','crowdcase.test.mjs'],['exportImplementation','solve.mjs'],['exportRecord','crowdcase-record.json']]){
 const event=page.waitForEvent('download');await page.locator('#'+id).click();const download=await event;await download.saveAs('artifacts/live/'+file);
}
await page.locator('#openDisplay').click();const url=await page.locator('#displayUrl').inputValue();await page.keyboard.press('Escape');
const overlayContext=await browser.newContext({viewport:{width:1440,height:810}});const display=await overlayContext.newPage();await display.goto(url);await display.waitForFunction(()=>document.querySelector('#displayApp').textContent.includes('Now it passes.'));
await display.screenshot({path:'submission/screenshots/04-stream-display.png'});
await page.locator('#results').scrollIntoViewIfNeeded();await page.screenshot({path:'submission/screenshots/05-result.png'});
await page.setViewportSize({width:1200,height:800});
const cover=(wide=false)=>`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;width:100vw;height:100vh;background:#f5f3ec;color:#19252b;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;padding:${wide?'72px 100px':'58px 72px'};position:relative;overflow:hidden}.brand{font-size:28px;font-weight:800;display:flex;gap:14px;align-items:center}.icon{background:#244fed;color:white;border-radius:8px;padding:7px 10px}.event{position:absolute;right:72px;top:70px;font:13px monospace;letter-spacing:2px;color:#52616a}h1{font-size:${wide?'126px':'100px'};line-height:.98;letter-spacing:-6px;margin:46px 0 20px}h1 span{color:#244fed}.sub{font-size:25px;color:#52616a;margin:0}.flow{display:flex;align-items:center;gap:20px;margin-top:46px}.card{border:1px solid #ccd2ce;border-radius:10px;background:#fffefa;padding:23px 27px;box-shadow:5px 5px 0 #e0e4df;flex:1;height:150px}.label{font:11px monospace;letter-spacing:1.4px;color:#52616a;margin-bottom:21px}.code{font:25px monospace;white-space:nowrap}.arrow{color:#244fed;font-size:34px}.numbers{display:flex;gap:10px}.num{font:34px monospace;border-radius:6px;padding:8px 14px;background:#e9ecff;color:#244fed}.fail{color:#bc4932;background:#fff0e8}.pass{color:#19785d;font-weight:800}.footer{position:absolute;left:72px;right:72px;bottom:36px;display:flex;justify-content:space-between;font:13px monospace;color:#52616a}.dot{color:#244fed}</style></head><body><div class="brand"><span class="icon">[c]</span>CrowdCase</div><div class="event">CODEX × TWITCHCON</div><h1>Good catch.<br><span>Keep the test.</span></h1><p class="sub">Your chat becomes your test suite.</p><div class="flow"><div class="card"><div class="label">01 / VIEWER INPUT</div><div class="code">!case [7,2,10,30]</div></div><span class="arrow">→</span><div class="card"><div class="label">02 / SMALLER FAILURE</div><div class="numbers"><span class="num">2</span><span class="num fail">10</span></div></div><span class="arrow">→</span><div class="card"><div class="label">03 / A TEST THAT STAYS</div><div class="code pass">✓ .test.mjs</div></div></div><div class="footer"><span><span class="dot">●</span> Built with Codex</span><span>TWITCH CHAT → REPRODUCIBLE TESTS</span></div></body></html>`;
await page.setContent(cover());await page.screenshot({path:'submission/CrowdCase-cover.png'});
await page.setViewportSize({width:1440,height:810});await page.setContent(cover(true));await page.screenshot({path:'submission/CrowdCase-cover-wide.png'});
await writeFile('artifacts/demo/cover.html',cover(true));
await browser.close();console.log('Screenshots, covers and real-case exports saved.');
