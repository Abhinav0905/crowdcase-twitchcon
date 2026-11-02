# Validation record

Checked locally on November 2, 2026. Node 26.6.0; Google Chrome on macOS.

## Automated checks

`npm test`: 17 passing tests.

- Numeric sort failure reduces to `[2,10]`; both examples pass the corrected function.
- Distinct runner-up handles duplicates, empty and singleton arrays and negative values.
- Oversized/noninteger input is rejected.
- Infinite loops, memory pressure and stack exhaustion stop without blocking the next run.
- Guest code has no exposed fetch, process, require, document or WebSocket.
- Promises, cyclic values, getters, nonfinite values and oversized outputs are rejected.
- Guest prototype mutations do not change trusted serialization or the next runtime.
- A shrink step cannot replace a wrong answer with an exception.
- Overfit fixes remain unresolved; incomplete reruns leave the workspace unchanged.
- Matching practice/Twitch contributions retain separate provenance.
- Exported tests run in an independent Node process: starter fails, fixed source passes.
- IRC parsing, fragmented messages, PING handling and stale-connection rejection.
- Local display writes require the host key and reject another origin.

`npm run test:browser`: 6 passing browser scenarios.

- Full practice/reduction/overfit/fix/export/reload flow.
- Runner timeout recovery and separate challenge state.
- Local SSE display updates across separate browser contexts.
- Mobile width at 390 pixels and runner operation after network requests are blocked.
- Static same-browser display synchronization and escaped contributor text.
- Mocked IRC message deduplication and paused-intake rejection. This is explicitly a fixture test, separate from the real Twitch check below.

## Real Twitch integration

At 17:14:34 UTC, channel `kumarabhinav0905` sent `!case [7,2,10,30]`. The browser received a tagged Twitch message with a unique message ID. The app credited the channel owner, compared the starter output `[10,2,30,7]` against `[2,7,10,30]`, and reduced the failing example to `[2,10]` in six checks. A separate browser context received the read-only display snapshot.

The raw receipt is retained locally under `artifacts/live/verified.json`; it is not a bundled sample in the app. The app starts empty for judges. Demo footage that reopens this recorded case will be labelled as a replay of the verified input.

This establishes one real connection and contribution. It does not establish audience size, engagement gains, classroom learning, production bug discovery or an actual public broadcast.

## Manual visual review

Desktop at 1440 pixels, mobile at 390 pixels, and the 1440 x 810 stream display. The narrative is ordered problem, solution, workbench, result. Source labels distinguish practice from Twitch contributions. The public hosted display and local OBS transport limits are stated in the UI.
