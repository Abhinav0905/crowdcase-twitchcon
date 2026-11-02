# CrowdCase

CrowdCase is a separate Codex x TwitchCon entry from DropLab. Keep changes inside this repository.
Use plain, human writing. Product and video order: problem, solution, what we built, results.
Build: npm run build. Unit tests: npm test. Browser scenarios: npm run test:browser. Local host: npm start (port 8782).
The MVP supports two explicit numeric-array contracts. Viewers send JSON data, never code. The host edits a synchronous JavaScript function in a QuickJS sandbox. Never evaluate it in Node or the main browser context. Apply time, memory, stack, input, output and queue limits. Every execution gets a fresh context.
A passing case means agreement with the selected contract on that input, not proof that the implementation is correct. Reduction means a smaller observed failure, not a globally smallest counterexample. Preserve original cases after reduction. Identify practice and Twitch cases separately. Do not present seeded bugs as discovered production bugs or technical checks as audience research.
Keep tokens and local recordings out of Git. All external messages and final Devpost submission require the user's authorization.
