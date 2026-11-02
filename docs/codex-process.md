# How Codex was used

CrowdCase was built in the existing Codex conversation after the participant requested a separate software project for the same hackathon. The participant had already completed a physical-experiment project, DropLab. CrowdCase has a different user task, implementation and output.

## Research and choice

Codex compared several directions and checked existing public project descriptions. The chosen scope targets a coding stream problem: useful viewer test suggestions often disappear without becoming reproducible tests. A small reduction experiment checked that a concrete sorting failure could become an understandable two-number example before building the interface.

## Build and review

Codex implemented the Twitch connection, two contracts, execution worker, reducer, case history, downloads, stream display and local host. A separate research/review agent examined QuickJS packaging and execution hazards. That review informed fresh runtimes, captured output validators and rejection of promise/accessor outputs.

The first UI verification exposed a product risk: an edit could pass the original example while failing the smaller one. The case status was changed to require both checks, and model/browser tests now cover an overfit patch. An export test runs downloaded tests against both broken and corrected implementations in a separate Node process.

## Real evidence

The participant sent a fresh Twitch command. Codex kept the actual browser listener running, checked the message receipt and case record, and captured the separate display. Practice fixtures remain labelled and do not increase the real Twitch count.

## Runtime AI

There is no runtime language model and no AI verdict. QuickJS executes the host's code; an explicit contract defines the expected output. Codex was the development collaborator. The demo narration uses Kokoro TTS, voice `af_heart`, with separate English captions. It is synthetic speech, not a voice clone.
