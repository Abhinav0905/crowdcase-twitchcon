import test from 'node:test';
import assert from 'node:assert/strict';
import variant from '@jitl/quickjs-wasmfile-release-sync';
import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten-core';
import { executeFunction } from '../src/runner.js';
import { CONTRACTS, parseInput, checkCase, reduceFailure } from '../src/contracts.js';
const vm = await newQuickJSWASMModuleFromVariant(variant);
const run = (source, input) => executeFunction(vm, source, input);

test('a real sorting mismatch shrinks and the fix resolves both cases', () => {
  const r = reduceFailure('sort', CONTRACTS.sort.starter, [7,2,10,30], run);
  assert.equal(r.status, 'fail'); assert.deepEqual(r.actual, [10,2,30,7]);
  assert.deepEqual(r.reduction.input, [2,10]);
  for (const input of [r.input, r.reduction.input]) assert.equal(checkCase('sort', CONTRACTS.sort.fix, input, run).status, 'pass');
});
test('runner-up distinguishes repeated scores and defines empty/singleton inputs', () => {
  assert.equal(checkCase('runnerup', CONTRACTS.runnerup.starter, [9,9,3], run).status, 'fail');
  for (const input of [[9,9,3], [], [8], [8,8], [-3,-5,-3]]) assert.equal(checkCase('runnerup', CONTRACTS.runnerup.fix, input, run).status, 'pass');
});
test('input validation rejects oversized, noninteger and nonnumeric cases', () => {
  for (const text of ['{}','[1.5]','[1000]','["2"]','[null]','[1,]']) assert.throws(() => parseInput(text));
  assert.throws(() => parseInput(JSON.stringify(Array(25).fill(1))));
  assert.deepEqual(parseInput('[-999,0,999]'), [-999,0,999]);
});
test('infinite loop is stopped and the next case still runs', () => {
  const start = Date.now(); const r = run('function solve(){ while(true){} }', []);
  assert.equal(r.kind, 'timeout'); assert.ok(Date.now() - start < 1000);
  assert.deepEqual(run(CONTRACTS.sort.fix, [2,1]).value, [1,2]);
});
test('unavailable host APIs cannot be called', () => {
  for (const name of ['fetch','process','require','document','WebSocket']) {
    assert.equal(run(`function solve(){ return typeof ${name} === 'undefined' ? 1 : 0; }`, []).value, 1);
  }
});
test('output validation rejects promises, cycles, accessors, nonfinite and large arrays', () => {
  for (const code of ['async function solve(){return 1}', 'function solve(){const a=[];a[0]=a;return a}',
    'function solve(){const a=[];Object.defineProperty(a,0,{get(){while(true){}}});return a}',
    'function solve(){return Infinity}', 'function solve(){return Array(25).fill(1)}']) assert.equal(run(code, []).ok, false);
});
test('guest prototype mutations do not change trusted serialization or future contexts', () => {
  assert.deepEqual(run('function solve(){Array.prototype.toJSON=()=>[9];return [1,2]}', []).value,[1,2]);
  assert.equal(run('function solve(){globalThis.leak=5;return 1}', []).value,1);
  assert.equal(run('function solve(){return typeof leak === "undefined" ? 1 : 0}', []).value,1);
});
test('stack and memory exhaustion remain controlled execution errors', () => {
  assert.equal(run('function solve(){function f(){return 1+f()}return f()}', []).ok,false);
  assert.equal(run('function solve(){return new Array(10000000).fill(1)}', []).ok,false);
});
test('shrinking preserves wrong-answer failures rather than switching to exceptions', () => {
  const execute = (_, input) => input.length < 2 ? {ok:false,kind:'execute',error:'bad'} : {ok:true,value:[9]};
  const r=reduceFailure('sort','function solve(){}',[1,2,3],execute);
  assert.equal(r.reduction.input.length,2);
});
