import { CONTRACTS, LIMITS, validateInput, same } from './contracts.js';
export function freshWorkspace(id) {
  return { id, code: CONTRACTS[id].starter, version: 1, versions:[{version:1,source:CONTRACTS[id].starter}], cases: [], selected: null, createdAt: new Date().toISOString() };
}
export function recordStatus(record) {
  const statuses = [record.current.status, record.reducedCurrent?.status].filter(Boolean);
  return statuses.includes('error') ? 'error' : statuses.includes('fail') ? 'fail' : 'pass';
}
export function addResult(workspace, {input, result, contributor, source, messageId, receivedAt}) {
  validateInput(input);
  let record = workspace.cases.find(c => same(c.input,input));
  if (record) {
    if (!record.contributors.some(c => c.id === contributor.id)) record.contributors.push({...contributor,source});
    record.contributors = record.contributors.slice(0,20);
    if (source === 'twitch' && messageId && !record.messageIds.includes(messageId)) record.messageIds.push(messageId);
    record.messageIds = record.messageIds.slice(-20);
    if (!record.reduction && result.reduction) {
      record.reduction = result.reduction;
      record.reductionVersion = workspace.version;
      record.reducedCurrent = {status:'fail', input:result.reduction.input, expected:result.reduction.expected, actual:result.reduction.actual};
    }
    return {record, duplicate:true};
  }
  if (workspace.cases.length >= LIMITS.cases) throw new Error('This challenge has 50 saved cases. Export them before starting a new session.');
  record = { id: crypto.randomUUID(), input:[...input], contributors:[{...contributor,source}],
    messageIds:messageId?[messageId]:[], receivedAt:receivedAt || new Date().toISOString(),
    first:{...result, version:workspace.version}, current:{...result,version:workspace.version},
    reduction:result.reduction, reductionVersion:result.reduction?workspace.version:null, history:[{version:workspace.version,status:result.status}], source };
  workspace.cases.unshift(record); workspace.selected = record.id;
  return {record, duplicate:false};
}
export function applySuite(workspace, source, results) {
  if (workspace.version >= 20) throw new Error('Export this session before starting another set of revisions.');
  let cursor = 0;
  for (const record of workspace.cases) {
    const original = results[cursor++];
    const reduced = record.reduction ? results[cursor++] : null;
    if (!original || (record.reduction && !reduced)) throw new Error('Incomplete suite results.');
  }
  if (cursor !== results.length) throw new Error('Unexpected suite results.');
  workspace.code = source; workspace.version++; workspace.versions.push({version:workspace.version,source}); cursor = 0;
  for (const record of workspace.cases) {
    record.current = {...results[cursor++],version:workspace.version};
    record.reducedCurrent = record.reduction ? results[cursor++] : null;
    record.history.push({version:workspace.version,status:record.current.status}); record.history=record.history.slice(-12);
  }
}
export function exportPacket(workspace, channel) {
  return { format:'crowdcase.v1', exportedAt:new Date().toISOString(), challenge:workspace.id,
    contract:CONTRACTS[workspace.id].description, channel:channel || null, implementation:workspace.code,
    version:workspace.version, implementations:workspace.versions, cases:workspace.cases,
    limits:{inputLength:24,inputIntegerRange:[-999,999],supportedLanguage:'synchronous JavaScript functions'},
    notice:'Practice and Twitch contributions are labelled. A pass checks these inputs only. Reduced examples are not globally minimal. Seeded challenge bugs are demonstration fixtures.' };
}
export function regressionSource(workspace) {
  const tests = [];
  for (const c of workspace.cases) {
    tests.push({input:c.input,expected:CONTRACTS[workspace.id].oracle(c.input)});
    if(c.reduction && !same(c.input,c.reduction.input)) tests.push({input:c.reduction.input,expected:CONTRACTS[workspace.id].oracle(c.reduction.input)});
  }
  // The generated tests import an implementation; they never interpolate chat text as code.
  return '// CrowdCase regression cases. Save your function as solve.mjs with a default export.\n'+
    '// Run: node --test crowdcase.test.mjs\n'+
    'import test from "node:test";\nimport assert from "node:assert/strict";\nimport solve from "./solve.mjs";\n\n'+
    'const cases = '+JSON.stringify(tests,null,2)+';\n'+
    'for (const [index, item] of cases.entries()) {\n  test("CrowdCase " + (index + 1), () => {\n    assert.deepEqual(solve([...item.input]), item.expected);\n  });\n}\n';
}
