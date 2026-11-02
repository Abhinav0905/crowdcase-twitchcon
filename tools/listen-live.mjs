import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const dir='artifacts/live';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
await page.goto('http://127.0.0.1:8782');
await page.locator('#channel').fill('kumarabhinav0905');await page.locator('#connect').click();
await page.waitForFunction(()=>document.querySelector('#connectionStatus').textContent.startsWith('Reading #'),{timeout:25000});
console.log('READY: Live Twitch intake confirmed; send !case [7,2,10,30].');
await page.locator('#openDisplay').click();const displayUrl=await page.locator('#displayUrl').inputValue();await page.keyboard.press('Escape');
const displayContext=await browser.newContext({viewport:{width:1440,height:810}});const display=await displayContext.newPage();await display.goto(displayUrl);
let previous='';
setInterval(async()=>{try{
  const value=await page.evaluate(()=>({status:document.querySelector('#connectionStatus').textContent,activity:document.querySelector('#activity').textContent,cases:document.querySelector('#caseCount').textContent,twitch:document.querySelector('#twitchCount').textContent,log:document.querySelector('#eventLog').textContent,state:JSON.parse(localStorage.getItem('crowdcase-workspaces-v1'))}));
  const key=JSON.stringify([value.status,value.activity,value.cases,value.twitch]);
  if(key!==previous){previous=key;console.log(JSON.stringify({...value,state:undefined}));await writeFile(dir+'/state.json',JSON.stringify(value,null,2));
    if(Number(value.twitch)>0){await page.locator('#workbench').scrollIntoViewIfNeeded();await page.screenshot({path:dir+'/host.png'});await display.screenshot({path:dir+'/display.png'});await writeFile(dir+'/verified.json',JSON.stringify(value,null,2));console.log('REAL TWITCH CASE SAVED');}
  }
}catch(e){console.log(e.message)}},2000);
