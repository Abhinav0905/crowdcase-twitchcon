import {test,expect} from '@playwright/test';
test('practice → reduction → overfit rejected → actual fix → reload and exports',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
  await page.locator('#sendCase').click();await expect(page.locator('#caseCount')).toHaveText('1');
  await expect(page.locator('#caseStatus')).toHaveText('WRONG ANSWER');
  await expect(page.locator('.reduced-numbers')).toHaveText('210');
  await page.locator('#code').fill('function solve(n) { return n.length===4 ? [2,7,10,30] : n.sort(); }');await page.locator('#runSuite').click();
  await expect(page.locator('#version')).toHaveText('v2');await expect(page.locator('#passingCount')).toHaveText('0');
  await expect(page.locator('#caseDetail')).toContainText('This smaller case still fails.');
  await page.locator('#exampleFix').click();await page.locator('#runSuite').click();await expect(page.locator('#version')).toHaveText('v3');
  await expect(page.locator('#passingCount')).toHaveText('1');await expect(page.locator('#caseDetail')).toContainText('The smaller case passes too.');
  const event=page.waitForEvent('download');await page.locator('#exportRecord').click();const download=await event;
  expect(download.suggestedFilename()).toBe('crowdcase-record.json');
  const stream=await download.createReadStream();let body='';for await(const chunk of stream)body+=chunk;
  const record=JSON.parse(body);expect(record.cases[0].contributors[0].source).toBe('practice');expect(record.implementations).toHaveLength(3);
  await page.reload();await expect(page.locator('#version')).toHaveText('v3');await expect(page.locator('#caseCount')).toHaveText('1');expect(errors).toEqual([]);
});
test('runner error recovers and challenges keep separate suites',async({page})=>{
  await page.goto('/');await page.locator('#sendCase').click();await expect(page.locator('#caseCount')).toHaveText('1');
  await page.locator('#code').fill('function solve(n) { while(true){} }');await page.locator('#runSuite').click();await expect(page.locator('#caseStatus')).toHaveText('RUNNER ERROR');
  await page.locator('#exampleFix').click();await page.locator('#runSuite').click();await expect(page.locator('#caseStatus')).toHaveText('PASS');
  await page.locator('#challenge').selectOption('runnerup');await expect(page.locator('#caseCount')).toHaveText('0');
  await page.locator('#sendCase').click();await expect(page.locator('#caseCount')).toHaveText('1');await expect(page.locator('#caseStatus')).toHaveText('WRONG ANSWER');
  await page.locator('#exampleFix').click();await page.locator('#runSuite').click();await expect(page.locator('#caseStatus')).toHaveText('PASS');
  await page.locator('#challenge').selectOption('sort');await expect(page.locator('#version')).toHaveText('v3');
});
test('local stream display synchronizes across separate browser contexts',async({page,browser})=>{
  await page.goto('/');await page.locator('#sendCase').click();await expect(page.locator('#caseCount')).toHaveText('1');
  await page.locator('#openDisplay').click();const url=await page.locator('#displayUrl').inputValue();expect(url).toContain('transport=local');await page.keyboard.press('Escape');
  const context=await browser.newContext({viewport:{width:1440,height:810}});const display=await context.newPage();await display.goto(url);
  await expect(display.locator('#displayApp')).toContainText('There is the');await expect(display.locator('#displayApp')).toContainText('PRACTICE');
  await page.locator('#exampleFix').click();await page.locator('#runSuite').click();await expect(display.locator('#displayApp')).toContainText('Now it passes.');
  await context.close();
});
test('mobile fits the viewport and worker needs no network after local assets load',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await page.locator('#sendCase').click();await expect(page.locator('#caseCount')).toHaveText('1');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.route('**/*',route=>route.abort());await page.locator('#exampleFix').click();await page.locator('#runSuite').click();await expect(page.locator('#caseStatus')).toHaveText('PASS');
  await page.screenshot({path:'artifacts/qa/04-mobile.png',fullPage:true});
});
test('static hosted display uses same-browser transport and escapes contributor text',async({page,context})=>{
  await page.route('**/api/**',route=>route.fulfill({status:404,body:'Not found'}));
  await page.goto('/');await page.locator('#sendCase').click();await expect(page.locator('#caseCount')).toHaveText('1');
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('crowdcase-workspaces-v1'));s.workspaces.sort.cases[0].contributors[0].name='<img src=x onerror=alert(1)>';localStorage.setItem('crowdcase-workspaces-v1',JSON.stringify(s));});
  await page.reload();await page.locator('#openDisplay').click();const url=await page.locator('#displayUrl').inputValue();expect(url).not.toContain('transport=local');await page.keyboard.press('Escape');
  const display=await context.newPage();await display.goto(url);await expect(display.locator('#displayApp')).toContainText('<img src=x onerror=alert(1)>');await expect(display.locator('#displayApp img')).toHaveCount(0);
  await page.locator('#exampleFix').click();await page.locator('#runSuite').click();await expect(display.locator('#displayApp')).toContainText('Now it passes.');
});
test('mocked IRC messages are deduplicated and pause intake rejects cases',async({page})=>{
  await page.addInitScript(()=>{
    class FakeSocket {constructor(){window.testSocket=this;this.readyState=1;setTimeout(()=>this.onopen?.(),10)}send(text){if(text.startsWith('JOIN'))setTimeout(()=>this.onmessage?.({data:':server 366 guest #sample :End\r\n'}),5)}close(){this.onclose?.()}receive(text){this.onmessage({data:text+'\r\n'})}}
    window.WebSocket=FakeSocket;
    window.sendFixture=(id,input)=>window.testSocket.receive('@display-name=TestViewer;user-id=123;id='+id+';tmi-sent-ts='+Date.now()+' :tester!tester@host PRIVMSG #sample :!case '+JSON.stringify(input));
  });
  await page.goto('/');await page.locator('#channel').fill('sample');await page.locator('#connect').click();await expect(page.locator('#connectionStatus')).toContainText('Reading #sample');
  await page.evaluate(()=>window.sendFixture('fixture-1',[7,2,10,30]));await expect(page.locator('#caseCount')).toHaveText('1');await expect(page.locator('#twitchCount')).toHaveText('1');
  await page.evaluate(()=>window.sendFixture('fixture-1',[9,2]));await expect(page.locator('#caseCount')).toHaveText('1');
  await page.locator('#intake').click();await page.evaluate(()=>window.sendFixture('fixture-2',[1,3]));await expect(page.locator('#eventLog')).toContainText('while intake was paused');await expect(page.locator('#caseCount')).toHaveText('1');
});
