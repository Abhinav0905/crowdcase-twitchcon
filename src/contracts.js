export const LIMITS = Object.freeze({ inputLength: 24, magnitude: 999, sourceLength: 6000, cases: 50, queue: 12 });

export const CONTRACTS = Object.freeze({
  sort: {
    id: 'sort', title: 'Put the numbers in order', short: 'Numeric sort',
    description: 'Return every input number in ascending numeric order. Keep duplicates. An empty input returns [].',
    signature: 'solve(numbers) → number[]',
    starter: 'function solve(numbers) {\n  return [...numbers].sort();\n}',
    fix: 'function solve(numbers) {\n  return [...numbers].sort((a, b) => a - b);\n}',
    sample: [7, 2, 10, 30], warmup: [1, 2, 3],
    oracle: input => [...input].sort((a, b) => a - b),
  },
  runnerup: {
    id: 'runnerup', title: 'Find the runner-up score', short: 'Distinct runner-up',
    description: 'Return the second-highest distinct number. Repeated scores share a place. Return null when there are fewer than two distinct numbers.',
    signature: 'solve(numbers) → number | null',
    starter: 'function solve(numbers) {\n  const scores = [...numbers].sort((a, b) => b - a);\n  return scores.length < 2 ? null : scores[1];\n}',
    fix: 'function solve(numbers) {\n  const scores = [...new Set(numbers)].sort((a, b) => b - a);\n  return scores.length < 2 ? null : scores[1];\n}',
    sample: [9, 9, 3], warmup: [9, 6, 3],
    oracle: input => [...new Set(input)].sort((a, b) => b - a)[1] ?? null,
  },
});

export function validateInput(input) {
  if (!Array.isArray(input)) throw new Error('Use a JSON array, such as [7,2,10,30].');
  if (input.length > LIMITS.inputLength) throw new Error('Keep each case to 24 numbers or fewer.');
  if (!input.every(n => Number.isSafeInteger(n) && Math.abs(n) <= LIMITS.magnitude)) {
    throw new Error('Use whole numbers between -999 and 999.');
  }
  return input.map(n => Object.is(n, -0) ? 0 : n);
}

export function parseInput(text) {
  if (typeof text !== 'string' || text.length > 250) throw new Error('Keep the case under 250 characters.');
  let input;
  try { input = JSON.parse(text); } catch { throw new Error('Use a JSON array, such as [7,2,10,30].'); }
  return validateInput(input);
}

export function validateSource(source) {
  if (typeof source !== 'string' || !source.trim()) throw new Error('Write a function first.');
  if (source.length > LIMITS.sourceLength) throw new Error('Keep the function under 6,000 characters.');
  return source.trim();
}

export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function checkCase(contractId, source, input, execute) {
  const contract = CONTRACTS[contractId];
  if (!contract) throw new Error('Unknown challenge.');
  const normalized = validateInput(input);
  const expected = contract.oracle(normalized);
  const result = execute(validateSource(source), normalized);
  if (!result.ok) return { status: 'error', input: normalized, expected, error: result.error, kind: result.kind };
  return { status: same(result.value, expected) ? 'pass' : 'fail', input: normalized, expected, actual: result.value };
}

export function reduceFailure(contractId, source, input, execute, { maxChecks = 64, budgetMs = 1500, now = Date.now } = {}) {
  const started = now();
  const initial = checkCase(contractId, source, input, execute);
  if (initial.status !== 'fail') return { ...initial, reduction: null };
  let reduced = [...initial.input], checks = 0, changed = true, exhausted = false;
  const steps = [];
  while (changed) {
    changed = false;
    for (let i = 0; i < reduced.length; i++) {
      if (checks >= maxChecks || now() - started >= budgetMs) { exhausted = true; break; }
      const candidate = reduced.filter((_, index) => index !== i);
      const result = checkCase(contractId, source, candidate, execute); checks++;
      // Preserve a wrong answer. A timeout or exception is a different failure.
      if (result.status === 'fail') {
        steps.push({ input: candidate, expected: result.expected, actual: result.actual });
        reduced = candidate; changed = true; break;
      }
    }
    if (exhausted) break;
  }
  const final = steps.at(-1) || initial;
  return { ...initial, reduction: { input: reduced, expected: final.expected, actual: final.actual, checks, steps, exhausted,
    label: exhausted ? 'Reduction budget reached' : 'No single item can be removed while keeping this wrong answer' } };
}
