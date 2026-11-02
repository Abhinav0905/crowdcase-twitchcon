import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIRC,caseMessage,TwitchConnection} from '../src/twitch.js';
const line='@display-name=Some\\sViewer;user-id=123;id=abc;tmi-sent-ts=1793638800000 :viewer!viewer@viewer.tmi.twitch.tv PRIVMSG #sample :!case [7,2,10,30]';
test('IRC parses tagged cases, escaped display names and timestamps',()=>{
  const c=caseMessage(parseIRC(line),'sample');assert.equal(c.name,'Some Viewer');assert.equal(c.user,'123');assert.equal(c.text,'[7,2,10,30]');assert.equal(c.sentAt,1793638800000);
  assert.equal(caseMessage(parseIRC(line),'wrong'),null);
  assert.equal(caseMessage(parseIRC(line.replace('!case','!casey')),'sample'),null);
  assert.equal(caseMessage(parseIRC(line.replace('user-id=123','user-id=')),'sample'),null);
});
test('read-only connection joins, handles fragmented IRC, pings, and ignores stale sockets',()=>{
  class Socket{static all=[];constructor(){this.sent=[];Socket.all.push(this)}send(v){this.sent.push(v)}close(){this.onclose?.()}}
  const statuses=[],cases=[];let activity=0;
  const c=new TwitchConnection({WebSocketClass:Socket,onStatus:s=>statuses.push(s),onCase:x=>cases.push(x),onActivity:()=>activity++});
  c.connect('sample');const ws=Socket.all[0];ws.onopen();assert.ok(ws.sent.includes('JOIN #sample\r\n'));
  ws.onmessage({data:':server 366 justinfan #sample :End of names\r\nPING :tmi.twitch.tv\r\n'+line.slice(0,50)});
  ws.onmessage({data:line.slice(50)+'\r\n'});
  assert.ok(statuses.includes('connected'));assert.equal(cases.length,1);assert.equal(activity,1);
  assert.ok(ws.sent.includes('PONG :tmi.twitch.tv\r\n'));assert.ok(ws.sent.every(s=>!s.startsWith('PRIVMSG')));
  c.connect('nextchannel');ws.onmessage({data:line+'\r\n'});assert.equal(cases.length,1);c.disconnect();
});
