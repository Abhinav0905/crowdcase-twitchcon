import variant from '@jitl/quickjs-singlefile-browser-release-sync';
import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten-core';
import { executeFunction } from './runner.js';
import { checkCase, reduceFailure, LIMITS } from './contracts.js';

const ready = newQuickJSWASMModuleFromVariant(variant);
self.onmessage = async ({ data }) => {
  const { id, operation, contract, source, input, inputs } = data;
  try {
    const vm = await ready;
    const execute = (code, values) => executeFunction(vm, code, values);
    let result;
    if (operation === 'case') result = reduceFailure(contract, source, input, execute);
    else if (operation === 'suite') {
      if (!Array.isArray(inputs) || inputs.length > LIMITS.cases * 2) throw new Error('Too many cases.');
      result = inputs.map(values => checkCase(contract, source, values, execute));
    } else throw new Error('Unknown operation.');
    self.postMessage({ id, result });
  } catch (error) { self.postMessage({ id, error: error.message || 'The isolated runner could not complete this request.' }); }
};
