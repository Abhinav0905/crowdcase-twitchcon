import { validateInput, validateSource } from './contracts.js';

// Captured before guest code runs. Never call guest toJSON or read accessor values.
const SERIALIZER = `(function () {
  const isArray = Array.isArray, descriptor = Object.getOwnPropertyDescriptor;
  const integer = Number.isSafeInteger;
  return function (value) {
    if (value === null) return 'null';
    if (typeof value === 'number' && integer(value) && value >= -999 && value <= 999) return '' + value;
    if (!isArray(value)) throw new Error('Return a number, null or an array of numbers.');
    const size = descriptor(value, 'length');
    if (!size || !integer(size.value) || size.value > 24) throw new Error('Output is too large.');
    let result = '[';
    for (let i = 0; i < size.value; i++) {
      const item = descriptor(value, '' + i);
      if (!item || !('value' in item) || typeof item.value !== 'number' || !integer(item.value) || item.value < -999 || item.value > 999) throw new Error('Invalid output item.');
      result += (i ? ',' : '') + item.value;
    }
    return result + ']';
  };
})()`;

export function executeFunction(QuickJS, source, input, { timeoutMs = 75, memoryBytes = 8 * 1024 * 1024 } = {}) {
  validateSource(source); validateInput(input);
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(memoryBytes);
  runtime.setMaxStackSize(256 * 1024);
  const deadline = Date.now() + timeoutMs;
  let interrupted = false, phase = 'compile', context;
  runtime.setInterruptHandler(() => { interrupted = Date.now() >= deadline; return interrupted; });
  const handles = [];
  const take = result => {
    if (result.error) { result.error.dispose(); throw new Error('Guest execution failed'); }
    handles.push(result.value); return result.value;
  };
  try {
    context = runtime.newContext();
    const serialize = take(context.evalCode(SERIALIZER));
    const fn = take(context.evalCode('(' + source + '\n)', 'streamer-function.js'));
    if (context.typeof(fn) !== 'function') return { ok: false, kind: 'code', error: 'The editor must contain one synchronous function.' };
    const argument = take(context.evalCode(JSON.stringify(input)));
    phase = 'execute';
    const result = take(context.callFunction(fn, context.undefined, argument));
    phase = 'output';
    const serialized = take(context.callFunction(serialize, context.undefined, result));
    const text = context.getString(serialized);
    if (text.length > 512) throw new Error('Output is too large');
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, kind: interrupted ? 'timeout' : phase,
      error: interrupted ? 'Execution stopped at the time limit. This case was not scored.' :
        phase === 'output' ? 'Return only a number, null or an array of up to 24 whole numbers between -999 and 999. Promises and accessors are not supported.' :
          'The function could not run. Check its syntax and return value. Network, file and browser APIs are unavailable; memory and stack limits apply.' };
  } finally {
    for (const handle of handles.reverse()) handle.dispose();
    context?.dispose(); runtime.dispose();
  }
}
