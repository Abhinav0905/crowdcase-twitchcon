import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppServer} from '../server.mjs';
test('local display publishing requires host key and same origin',async()=>{
  const server=createAppServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    const room=await(await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json();
    const url=base+'/api/rooms/'+room.id,body=JSON.stringify({app:'CrowdCase',challenge:'sort',cases:[]});
    assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body})).status,403);
    assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://wrong.example',Authorization:'Bearer '+room.key},body})).status,403);
    assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+room.key},body})).status,200);
    assert.deepEqual(await(await fetch(url)).json(),JSON.parse(body));
    assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+room.key},body:'{}'})).status,400);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
