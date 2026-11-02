import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {freshWorkspace,addResult,applySuite,recordStatus,regressionSource,exportPacket} from '../src/model.js';
import {CONTRACTS} from '../src/contracts.js';
const result={status:'fail',expected:[2,7,10,30],actual:[10,2,30,7],reduction:{input:[2,10],expected:[2,10],actual:[10,2],steps:[],exhausted:false}};
const entry={input:[7,2,10,30],result,contributor:{id:'practice:host',name:'Practice'},source:'practice'};
test('a patch must pass the original AND the reduced example',()=>{
  const w=freshWorkspace('sort');addResult(w,entry);
  applySuite(w,'function solve(n){return n.length===4?[2,7,10,30]:n.sort()}',[{status:'pass'},{status:'fail'}]);
  assert.equal(recordStatus(w.cases[0]),'fail');
  assert.equal(w.cases[0].first.status,'fail');assert.deepEqual(w.cases[0].input,entry.input);
  assert.equal(w.versions.length,2);
});
test('incomplete reruns never partially mutate a workspace',()=>{
  const w=freshWorkspace('sort');addResult(w,entry);const before=JSON.stringify(w);
  assert.throws(()=>applySuite(w,CONTRACTS.sort.fix,[{status:'pass'}]),/Incomplete/);
  assert.equal(JSON.stringify(w),before);
});
test('matching Twitch and practice contributions retain distinct provenance',()=>{
  const w=freshWorkspace('sort');addResult(w,entry);
  addResult(w,{...entry,source:'twitch',messageId:'real-id',contributor:{id:'twitch:123',name:'Viewer'}});
  assert.equal(w.cases.length,1);assert.deepEqual(w.cases[0].contributors.map(c=>c.source),['practice','twitch']);
  assert.deepEqual(w.cases[0].messageIds,['real-id']);
  assert.equal(exportPacket(w,'example').implementations[0].source,CONTRACTS.sort.starter);
});
test('a previously passing input can gain a reduction after a regression',()=>{
  const w=freshWorkspace('sort');w.code=CONTRACTS.sort.fix;
  addResult(w,{...entry,result:{status:'pass',expected:[2,7,10,30],actual:[2,7,10,30],reduction:null}});
  applySuite(w,CONTRACTS.sort.starter,[{status:'fail',expected:[2,7,10,30],actual:[10,2,30,7]}]);
  addResult(w,{...entry,source:'twitch',messageId:'new-case',contributor:{id:'twitch:42',name:'Viewer'}});
  assert.equal(w.cases.length,1);assert.equal(w.cases[0].first.status,'pass');
  assert.deepEqual(w.cases[0].reduction.input,[2,10]);assert.equal(w.cases[0].reductionVersion,2);
  assert.equal(recordStatus(w.cases[0]),'fail');
});
test('exported Node suite fails starter and passes fixed implementation independently',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'crowdcase-export-'));
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  try{
    const w=freshWorkspace('sort');addResult(w,entry);
    await writeFile(join(dir,'crowdcase.test.mjs'),regressionSource(w));
    await writeFile(join(dir,'solve.mjs'),'export default '+CONTRACTS.sort.starter);
    assert.throws(()=>execFileSync(process.execPath,['--test','crowdcase.test.mjs'],{cwd:dir,env,stdio:'pipe'}));
    await writeFile(join(dir,'solve.mjs'),'export default '+CONTRACTS.sort.fix);
    const output=execFileSync(process.execPath,['--test','crowdcase.test.mjs'],{cwd:dir,env,encoding:'utf8'});
    assert.match(output,/pass 2/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
