// src/contracts.js
var LIMITS = Object.freeze({ inputLength: 24, magnitude: 999, sourceLength: 6e3, cases: 50, queue: 12 });
var CONTRACTS = Object.freeze({
  sort: {
    id: "sort",
    title: "Put the numbers in order",
    short: "Numeric sort",
    description: "Return every input number in ascending numeric order. Keep duplicates. An empty input returns [].",
    signature: "solve(numbers) \u2192 number[]",
    starter: "function solve(numbers) {\n  return [...numbers].sort();\n}",
    fix: "function solve(numbers) {\n  return [...numbers].sort((a, b) => a - b);\n}",
    sample: [7, 2, 10, 30],
    warmup: [1, 2, 3],
    oracle: (input) => [...input].sort((a, b) => a - b)
  },
  runnerup: {
    id: "runnerup",
    title: "Find the runner-up score",
    short: "Distinct runner-up",
    description: "Return the second-highest distinct number. Repeated scores share a place. Return null when there are fewer than two distinct numbers.",
    signature: "solve(numbers) \u2192 number | null",
    starter: "function solve(numbers) {\n  const scores = [...numbers].sort((a, b) => b - a);\n  return scores.length < 2 ? null : scores[1];\n}",
    fix: "function solve(numbers) {\n  const scores = [...new Set(numbers)].sort((a, b) => b - a);\n  return scores.length < 2 ? null : scores[1];\n}",
    sample: [9, 9, 3],
    warmup: [9, 6, 3],
    oracle: (input) => [...new Set(input)].sort((a, b) => b - a)[1] ?? null
  }
});
function validateInput(input) {
  if (!Array.isArray(input)) throw new Error("Use a JSON array, such as [7,2,10,30].");
  if (input.length > LIMITS.inputLength) throw new Error("Keep each case to 24 numbers or fewer.");
  if (!input.every((n) => Number.isSafeInteger(n) && Math.abs(n) <= LIMITS.magnitude)) {
    throw new Error("Use whole numbers between -999 and 999.");
  }
  return input.map((n) => Object.is(n, -0) ? 0 : n);
}
function parseInput(text) {
  if (typeof text !== "string" || text.length > 250) throw new Error("Keep the case under 250 characters.");
  let input;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error("Use a JSON array, such as [7,2,10,30].");
  }
  return validateInput(input);
}
function validateSource(source) {
  if (typeof source !== "string" || !source.trim()) throw new Error("Write a function first.");
  if (source.length > LIMITS.sourceLength) throw new Error("Keep the function under 6,000 characters.");
  return source.trim();
}
var same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// src/model.js
function freshWorkspace(id) {
  return { id, code: CONTRACTS[id].starter, version: 1, versions: [{ version: 1, source: CONTRACTS[id].starter }], cases: [], selected: null, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function recordStatus(record) {
  const statuses = [record.current.status, record.reducedCurrent?.status].filter(Boolean);
  return statuses.includes("error") ? "error" : statuses.includes("fail") ? "fail" : "pass";
}
function addResult(workspace, { input, result, contributor, source, messageId, receivedAt }) {
  validateInput(input);
  let record = workspace.cases.find((c) => same(c.input, input));
  if (record) {
    if (!record.contributors.some((c) => c.id === contributor.id)) record.contributors.push({ ...contributor, source });
    record.contributors = record.contributors.slice(0, 20);
    if (source === "twitch" && messageId && !record.messageIds.includes(messageId)) record.messageIds.push(messageId);
    record.messageIds = record.messageIds.slice(-20);
    if (!record.reduction && result.reduction) {
      record.reduction = result.reduction;
      record.reductionVersion = workspace.version;
      record.reducedCurrent = { status: "fail", input: result.reduction.input, expected: result.reduction.expected, actual: result.reduction.actual };
    }
    return { record, duplicate: true };
  }
  if (workspace.cases.length >= LIMITS.cases) throw new Error("This challenge has 50 saved cases. Export them before starting a new session.");
  record = {
    id: crypto.randomUUID(),
    input: [...input],
    contributors: [{ ...contributor, source }],
    messageIds: messageId ? [messageId] : [],
    receivedAt: receivedAt || (/* @__PURE__ */ new Date()).toISOString(),
    first: { ...result, version: workspace.version },
    current: { ...result, version: workspace.version },
    reduction: result.reduction,
    reductionVersion: result.reduction ? workspace.version : null,
    history: [{ version: workspace.version, status: result.status }],
    source
  };
  workspace.cases.unshift(record);
  workspace.selected = record.id;
  return { record, duplicate: false };
}
function applySuite(workspace, source, results) {
  if (workspace.version >= 20) throw new Error("Export this session before starting another set of revisions.");
  let cursor = 0;
  for (const record of workspace.cases) {
    const original = results[cursor++];
    const reduced = record.reduction ? results[cursor++] : null;
    if (!original || record.reduction && !reduced) throw new Error("Incomplete suite results.");
  }
  if (cursor !== results.length) throw new Error("Unexpected suite results.");
  workspace.code = source;
  workspace.version++;
  workspace.versions.push({ version: workspace.version, source });
  cursor = 0;
  for (const record of workspace.cases) {
    record.current = { ...results[cursor++], version: workspace.version };
    record.reducedCurrent = record.reduction ? results[cursor++] : null;
    record.history.push({ version: workspace.version, status: record.current.status });
    record.history = record.history.slice(-12);
  }
}
function exportPacket(workspace, channel) {
  return {
    format: "crowdcase.v1",
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    challenge: workspace.id,
    contract: CONTRACTS[workspace.id].description,
    channel: channel || null,
    implementation: workspace.code,
    version: workspace.version,
    implementations: workspace.versions,
    cases: workspace.cases,
    limits: { inputLength: 24, inputIntegerRange: [-999, 999], supportedLanguage: "synchronous JavaScript functions" },
    notice: "Practice and Twitch contributions are labelled. A pass checks these inputs only. Reduced examples are not globally minimal. Seeded challenge bugs are demonstration fixtures."
  };
}
function regressionSource(workspace) {
  const tests = [];
  for (const c of workspace.cases) {
    tests.push({ input: c.input, expected: CONTRACTS[workspace.id].oracle(c.input) });
    if (c.reduction && !same(c.input, c.reduction.input)) tests.push({ input: c.reduction.input, expected: CONTRACTS[workspace.id].oracle(c.reduction.input) });
  }
  return '// CrowdCase regression cases. Save your function as solve.mjs with a default export.\n// Run: node --test crowdcase.test.mjs\nimport test from "node:test";\nimport assert from "node:assert/strict";\nimport solve from "./solve.mjs";\n\nconst cases = ' + JSON.stringify(tests, null, 2) + ';\nfor (const [index, item] of cases.entries()) {\n  test("CrowdCase " + (index + 1), () => {\n    assert.deepEqual(solve([...item.input]), item.expected);\n  });\n}\n';
}

// src/twitch.js
function parseIRC(line) {
  let rest = line, tags = {}, prefix = "";
  if (rest.startsWith("@")) {
    const end = rest.indexOf(" ");
    if (end < 0) return null;
    for (const pair of rest.slice(1, end).split(";")) {
      const i2 = pair.indexOf("=");
      tags[i2 < 0 ? pair : pair.slice(0, i2)] = (i2 < 0 ? "" : pair.slice(i2 + 1)).replace(/\\([s:nr\\])/g, (_, c) => ({ s: " ", ":": ";", n: "\n", r: "\r", "\\": "\\" })[c]);
    }
    rest = rest.slice(end + 1);
  }
  if (rest.startsWith(":")) {
    const end = rest.indexOf(" ");
    if (end < 0) return null;
    prefix = rest.slice(1, end);
    rest = rest.slice(end + 1);
  }
  const i = rest.indexOf(" :"), text = i < 0 ? "" : rest.slice(i + 2);
  const parts = (i < 0 ? rest : rest.slice(0, i)).split(" ");
  return { command: parts.shift(), params: parts, text, tags, prefix };
}
function caseMessage(message, channel) {
  if (message?.command !== "PRIVMSG" || message.params[0] !== "#" + channel || !/^!case(?:\s|$)/i.test(message.text)) return null;
  if (!/^\d+$/.test(message.tags["user-id"] || "") || !message.tags.id) return null;
  return {
    text: message.text.replace(/^!case\s*/i, ""),
    user: message.tags["user-id"],
    name: (message.tags["display-name"] || message.prefix.split("!")[0]).slice(0, 32),
    id: message.tags.id,
    sentAt: Number(message.tags["tmi-sent-ts"])
  };
}
var TwitchConnection = class {
  constructor({ onStatus, onCase, onActivity, WebSocketClass = globalThis.WebSocket }) {
    Object.assign(this, { onStatus, onCase, onActivity, WebSocketClass });
    this.generation = 0;
  }
  connect(channel) {
    channel = channel.trim().toLowerCase().replace(/^#/, "");
    if (!/^[a-z0-9_]{3,25}$/.test(channel)) throw new Error("Enter a Twitch channel name, without a URL.");
    this.disconnect();
    const generation = ++this.generation;
    this.channel = channel;
    this.buffer = "";
    this.onStatus("connecting", "Joining #" + channel);
    const ws = this.socket = new this.WebSocketClass("wss://irc-ws.chat.twitch.tv:443");
    this.timer = setTimeout(() => {
      if (generation === this.generation) {
        ws.close();
        this.onStatus("error", "Twitch did not confirm the channel. Reconnect to try again.");
      }
    }, 15e3);
    ws.onopen = () => {
      if (generation !== this.generation) return;
      ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands\r\n");
      ws.send("PASS SCHMOOPIIE\r\n");
      ws.send("NICK justinfan" + Math.floor(1e5 + Math.random() * 9e5) + "\r\n");
      ws.send("JOIN #" + channel + "\r\n");
    };
    ws.onmessage = (event) => {
      if (generation !== this.generation) return;
      this.buffer += String(event.data);
      if (this.buffer.length > 1e5) {
        ws.close();
        return;
      }
      const lines = this.buffer.split("\r\n");
      this.buffer = lines.pop();
      for (const line of lines) {
        const m = parseIRC(line);
        if (!m) continue;
        if (m.command === "PING") {
          ws.send("PONG :" + (m.text || m.params[0]) + "\r\n");
          continue;
        }
        if (m.command === "366" && m.params.includes("#" + channel) || m.command === "ROOMSTATE" && m.params[0] === "#" + channel) {
          clearTimeout(this.timer);
          this.onStatus("connected", "Reading #" + channel + ". No messages are sent.");
        }
        if (m.command === "NOTICE") this.onStatus("error", m.text || "Twitch rejected the connection.");
        if (m.command === "RECONNECT") {
          ws.close();
          this.onStatus("error", "Twitch requested a reconnect. Intake is paused.");
        }
        if (m.command === "PRIVMSG" && m.params[0] === "#" + channel) {
          this.onActivity?.();
          const c = caseMessage(m, channel);
          if (c) this.onCase(c);
        }
      }
    };
    ws.onerror = () => {
      if (generation === this.generation) this.onStatus("error", "Could not reach Twitch. Check the network and reconnect.");
    };
    ws.onclose = () => {
      clearTimeout(this.timer);
      if (generation === this.generation) this.onStatus("disconnected", "Chat disconnected. Intake is paused.");
    };
    return channel;
  }
  disconnect() {
    this.generation++;
    clearTimeout(this.timer);
    this.socket?.close();
    this.socket = null;
  }
};

// src/app.js
var $ = (id) => document.getElementById(id);
var escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var format = (value) => JSON.stringify(value);
var sourceLabel = (record) => {
  const sources = new Set(record.contributors.map((c) => c.source));
  return sources.has("twitch") ? sources.has("practice") ? "TWITCH + PRACTICE" : "TWITCH" : "PRACTICE";
};
var badge = (status, version) => `<span class="tag ${escape(status)}">v${version} \xB7 ${status === "fail" ? "FAIL" : status === "pass" ? "PASS" : "ERROR"}</span>`;
var toastTimer;
function toast(message, error = false) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").className = "toast" + (error ? " error" : "");
  $("toast").hidden = false;
  toastTimer = setTimeout(() => $("toast").hidden = true, 6500);
}
function resultMarkup(record, compact = false) {
  const result = record.current, reduction = record.reduction;
  const credit = record.contributors.map((c) => escape(c.name)).join(", ");
  const history = `<div class="history-line"><span>FIRST CHECK</span>${badge(record.first.status, record.first.version)}<span>\u2192</span>${badge(recordStatus(record), result.version)}</div>`;
  return `<div class="case-credit"><span class="tag neutral">${sourceLabel(record)}</span><span>Case by <strong>${credit}</strong></span></div>
  <div class="case-input"><span class="label">ORIGINAL INPUT \xB7 KEPT IN THE SUITE</span><code>${escape(format(record.input))}</code></div>
  ${result.status === "error" ? `<div class="case-error"><strong>Execution stopped.</strong><p>${escape(result.error)}</p><span>This is not a wrong-answer result.</span></div>` : `<div class="output-compare"><div class="output-cell ${result.status}"><span class="label">ACTUAL \xB7 VERSION ${result.version}</span><code>${escape(format(result.actual))}</code></div><div class="output-cell"><span class="label">EXPECTED BY THE CONTRACT</span><code>${escape(format(result.expected))}</code></div></div>`}
  ${reduction ? `<div class="reduction"><div class="reduction-head"><h4>${record.reducedCurrent?.status === "pass" ? "The smaller case passes too." : record.reducedCurrent?.status === "fail" && result.status === "pass" ? "This smaller case still fails." : "Less noise. Same mistake."}</h4><span class="tag neutral">${record.input.length} \u2192 ${reduction.input.length} ITEMS</span></div><div class="reduced-numbers">${reduction.input.length ? reduction.input.map((n) => `<span class="number">${n}</span>`).join("") : '<span class="number">[ ]</span>'}</div><p class="subtle">Reduced from the original wrong answer on version ${record.reductionVersion || record.first.version}. ${reduction.exhausted ? "The reduction budget was reached." : "No single remaining item could be removed while keeping a wrong answer."} This is not a claim of global minimality.</p>${record.reducedCurrent ? `<p class="result-caption">Reduced case on v${result.version}: <strong>${record.reducedCurrent.status.toUpperCase()}</strong>${record.reducedCurrent.status === "error" ? " \xB7 Execution could not complete." : " \xB7 Actual " + escape(format(record.reducedCurrent.actual)) + " \xB7 Expected " + escape(format(record.reducedCurrent.expected))}</p>` : ""}</div>` : result.status === "pass" ? '<p class="result-caption">This input matches the selected contract. Other inputs may still expose a bug.</p>' : ""}
  ${compact ? "" : history}`;
}
var params = new URLSearchParams(location.search);
if (params.get("view") === "display") {
  $("hostApp").hidden = true;
  $("displayApp").hidden = false;
  document.body.classList.add("display-mode");
  document.title = "CrowdCase \xB7 Stream display";
  const roomId = params.get("room");
  let snapshot, received = 0;
  const renderDisplay = () => {
    const stale = Date.now() - received > 16e3;
    if (!snapshot) {
      $("displayApp").innerHTML = '<div class="display-wait"><div class="brand"><span class="brand-icon">[c]</span>CrowdCase</div><h1>The next good catch<br>could come from chat.</h1><p>Waiting for the workbench. Keep its tab open and send a case.</p></div>';
      return;
    }
    const c = snapshot.selected, contract = CONTRACTS[snapshot.challenge];
    $("displayApp").innerHTML = `<div class="display-top"><div class="brand"><span class="brand-icon">[c]</span>CrowdCase</div><p>${escape(contract.short)} \xB7 v${snapshot.version}</p><span class="tag ${stale ? "error" : "neutral"}">${stale ? "HOST NOT UPDATING" : snapshot.intake ? "CHAT INTAKE OPEN" : "CHAT INTAKE PAUSED"}</span></div>
    ${c ? `<div class="display-main"><div><p class="eyebrow">${recordStatus(c) === "pass" && c.first.status === "fail" ? "THE FIX HOLDS FOR THIS CASE" : "THE ROOM FOUND A CASE"}</p><h1 class="${escape(recordStatus(c))}">${recordStatus(c) === "pass" ? c.first.status === "fail" ? "Good catch.<br>Now it passes." : "This case passes." : recordStatus(c) === "fail" ? "There is the<br>edge case." : "This run stopped."}</h1><p>${escape(contract.description)}</p><div class="history-line">${badge(c.first.status, c.first.version)} \u2192 ${badge(recordStatus(c), c.current.version)}</div></div><div>${resultMarkup(c, true)}</div></div>` : `<div class="display-wait"><p class="eyebrow">${escape(contract.short)}</p><h1>Can you find<br>the case we missed?</h1><p>${escape(contract.description)}</p></div>`}
    <div class="display-footer"><code>!case ${escape(format(contract.sample))}</code><span>${snapshot.cases.length} saved cases \xB7 ${snapshot.cases.filter((c2) => c2.twitch).length} from Twitch</span><span>${stale ? '<span class="display-offline">Last known state \xB7 reopen the host</span>' : "Deliberately buggy starters \xB7 exact contract checks"}</span></div>`;
  };
  const accept = (value) => {
    if (value?.app !== "CrowdCase" || !CONTRACTS[value.challenge]) return;
    snapshot = value;
    received = Date.now();
    renderDisplay();
  };
  if (params.get("transport") === "local" && /^[a-f0-9]{32}$/.test(roomId || "")) {
    const events = new EventSource("/api/rooms/" + roomId + "/events");
    events.onmessage = (e) => {
      try {
        accept(JSON.parse(e.data));
      } catch {
      }
    };
    events.onerror = () => {
      received = 0;
      renderDisplay();
    };
  } else if (roomId && /^[a-zA-Z0-9-]{10,64}$/.test(roomId)) {
    const channel = new BroadcastChannel("crowdcase-" + roomId);
    channel.onmessage = (e) => accept(e.data);
    try {
      const last = JSON.parse(localStorage.getItem("crowdcase-display-" + roomId));
      if (last) {
        accept(last);
        received = Date.now() - (Date.now() - last.updatedAt);
      }
    } catch {
    }
    channel.postMessage({ requestSnapshot: true });
  }
  renderDisplay();
  setInterval(renderDisplay, 5e3);
} else {
  let save = function() {
    try {
      localStorage.setItem("crowdcase-workspaces-v1", JSON.stringify({ schema: 1, active, workspaces }));
    } catch {
      toast("Browser storage is full. Download the case record to keep this session.", true);
    }
  }, render = function() {
    const w = workspace(), c = CONTRACTS[active], selected = w.cases.find((x) => x.id === w.selected) || w.cases[0];
    $("challenge").value = active;
    $("contractTitle").textContent = c.title;
    $("contractDescription").textContent = c.description;
    $("signature").textContent = c.signature;
    $("version").textContent = "v" + w.version;
    const dirty = $("code").value.trim() !== w.code.trim();
    $("codeState").textContent = dirty ? "Unapplied edit" : w.version === 1 ? "Seeded example bug" : "Current implementation";
    $("caseTitle").textContent = selected ? recordStatus(selected) === "pass" && selected.first.status === "fail" ? "A good catch. A checked fix." : recordStatus(selected) === "fail" ? "The case still has a mismatch." : recordStatus(selected) === "pass" ? "This case matches." : "The runner stopped this case." : "Waiting for a good catch.";
    $("caseStatus").className = "tag " + (selected ? recordStatus(selected) : "neutral");
    $("caseStatus").textContent = selected ? recordStatus(selected) === "fail" ? "WRONG ANSWER" : recordStatus(selected) === "pass" ? "PASS" : "RUNNER ERROR" : "READY";
    if (selected) $("caseDetail").innerHTML = resultMarkup(selected);
    else $("caseDetail").innerHTML = `<div class="empty-case"><span class="empty-icon">[ ? ]</span><h4>One input can change the conversation.</h4><p>Try <code>${escape(format(c.sample))}</code>. Then see what the starter code gets wrong.</p></div>`;
    $("caseCount").textContent = w.cases.length;
    $("twitchCount").textContent = w.cases.filter((c2) => c2.contributors.some((x) => x.source === "twitch")).length;
    $("passingCount").textContent = w.cases.filter((c2) => recordStatus(c2) === "pass").length;
    $("suiteEmpty").hidden = !!w.cases.length;
    $("suiteTable").hidden = !w.cases.length;
    $("suiteBody").innerHTML = w.cases.map((r) => `<tr class="${r.id === selected?.id ? "selected" : ""}"><td><strong>${escape(r.contributors.map((x) => x.name).join(", "))}</strong><span>${sourceLabel(r)}</span></td><td><code>${escape(format(r.input))}</code></td><td>${badge(r.first.status, r.first.version)}</td><td>${badge(recordStatus(r), r.current.version)}</td><td><button class="text-button inspect-case" data-id="${escape(r.id)}">Inspect \u2197</button></td></tr>`).join("");
    for (const button of document.querySelectorAll(".inspect-case")) button.onclick = () => {
      w.selected = button.dataset.id;
      save();
      render();
      void publish();
    };
    $("suiteSummary").textContent = w.cases.length ? `${w.cases.filter((c2) => recordStatus(c2) === "pass").length} of ${w.cases.length} case files pass all their saved checks on v${w.version}. Other inputs may still fail.` : "A pass checks these inputs, not every possible input.";
    $("exportSummary").textContent = w.cases.length ? `${w.cases.length} original cases, ${w.cases.filter((c2) => c2.reduction).length} reduced examples. Practice and Twitch sources stay labelled.` : "Add a case to enable export.";
    for (const id of ["runSuite", "exampleFix", "challenge", "sendCase", "warmup", "clearSession", "code"]) $(id).disabled = busy;
    $("exportTests").disabled = busy || !w.cases.length;
    $("exportRecord").disabled = busy || !w.cases.length;
    $("exportImplementation").disabled = busy;
    $("intake").disabled = twitchStatus !== "connected" || busy;
    $("intake").textContent = intake ? "Intake open \xB7 pause" : "Intake paused \xB7 open";
    $("runnerBadge").innerHTML = `<span class="live-dot"></span> ${busy ? "Checking in isolation" + (queue.length ? " \xB7 " + queue.length + " queued" : "") : "Isolated JavaScript runner"}`;
    $("connect").textContent = twitchStatus === "connected" || twitchStatus === "connecting" ? "Disconnect" : "Connect Twitch";
  }, request = function(operation, data) {
    return new Promise((resolve, reject) => {
      if (!worker) worker = new Worker(new URL("./sandbox.worker.js", import.meta.url), { type: "module" });
      const id = ++requestId, currentWorker = worker;
      const finish = () => {
        clearTimeout(timer);
        currentWorker.removeEventListener("message", onMessage);
        currentWorker.removeEventListener("error", onError);
      };
      const stop = (message) => {
        finish();
        currentWorker.terminate();
        if (worker === currentWorker) worker = null;
        reject(new Error(message));
      };
      const onMessage = (e) => {
        if (e.data.id !== id) return;
        finish();
        e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.result);
      };
      const onError = () => stop("The isolated runner stopped unexpectedly. Your saved cases are unchanged. Try again.");
      const timer = setTimeout(() => stop("The runner exceeded its time budget. Your saved cases are unchanged."), 12e3);
      currentWorker.addEventListener("message", onMessage);
      currentWorker.addEventListener("error", onError);
      currentWorker.postMessage({ id, operation, ...data });
    });
  }, enqueue = function(text, contributor, source = "practice", messageId) {
    const input = parseInput(text), w = workspace();
    if (queue.length >= LIMITS.queue) throw new Error("The case queue is full. Please try again in a moment.");
    if (w.cases.length >= LIMITS.cases && !w.cases.some((c) => format(c.input) === format(input))) throw new Error("The suite is full. Export it before clearing this challenge.");
    queue.push({ contract: active, version: w.version, input, contributor, source, messageId, receivedAt: (/* @__PURE__ */ new Date()).toISOString() });
    void drain();
  }, download = function(text, filename, type) {
    const blob = new Blob([text], { type }), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2e3);
  };
  let active = "sort", workspaces = { sort: freshWorkspace("sort"), runnerup: freshWorkspace("runnerup") };
  try {
    const saved = JSON.parse(localStorage.getItem("crowdcase-workspaces-v1"));
    if (saved?.schema === 1 && CONTRACTS[saved.active]) {
      for (const id of Object.keys(CONTRACTS)) {
        const w = saved.workspaces[id];
        if (!w || w.id !== id || !Array.isArray(w.cases) || w.cases.length > LIMITS.cases || !Array.isArray(w.versions) || w.versions.length > 20) throw new Error("Invalid saved session");
        validateSource(w.code);
        w.cases.forEach((c) => validateInput(c.input));
      }
      active = saved.active;
      workspaces = saved.workspaces;
    }
  } catch {
    toast("A saved session could not be restored. Starting a fresh workbench.", true);
  }
  let busy = false, queue = [], worker, requestId = 0, twitchStatus = "disconnected", intake = false, intakeSince = 0, messages = 0;
  let roomId = crypto.randomUUID(), roomKey, localTransport = false, pubChannel;
  const seenMessages = /* @__PURE__ */ new Set(), userLastSeen = /* @__PURE__ */ new Map(), logs = [];
  const workspace = () => workspaces[active];
  const log = (message) => {
    logs.unshift({ at: (/* @__PURE__ */ new Date()).toLocaleTimeString(), message });
    logs.splice(30);
    $("eventLog").innerHTML = logs.map((l) => `<li>${escape(l.at)} \xB7 ${escape(l.message)}</li>`).join("");
    $("logCount").textContent = logs.length;
  };
  const snapshot = () => {
    const w = workspace(), selected = w.cases.find((c) => c.id === w.selected) || w.cases[0];
    const small = selected ? { ...selected, first: { status: selected.first.status, version: selected.first.version }, history: void 0, messageIds: void 0, reduction: selected.reduction ? { ...selected.reduction, steps: void 0 } : null } : null;
    return {
      app: "CrowdCase",
      challenge: active,
      version: w.version,
      intake: intake && twitchStatus === "connected",
      updatedAt: Date.now(),
      selected: small,
      cases: w.cases.map((c) => ({ id: c.id, status: recordStatus(c), twitch: c.contributors.some((x) => x.source === "twitch") }))
    };
  };
  async function publish() {
    const value = snapshot();
    if (localTransport) {
      try {
        const r = await fetch("/api/rooms/" + roomId, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + roomKey }, body: JSON.stringify(value) });
        if (!r.ok) throw new Error();
      } catch {
        log("The local stream display could not update. Reopen its URL after restarting the host.");
      }
    } else {
      pubChannel?.postMessage(value);
      try {
        localStorage.setItem("crowdcase-display-" + roomId, JSON.stringify(value));
      } catch {
      }
    }
  }
  async function drain() {
    if (busy || !queue.length) return;
    busy = true;
    render();
    while (queue.length) {
      const job = queue.shift();
      try {
        const w = workspaces[job.contract];
        if (w.version !== job.version) throw new Error("The code changed before this case could run. Send it again.");
        const result = await request("case", { contract: job.contract, source: w.code, input: job.input });
        const added = addResult(w, { ...job, result });
        log(`${job.source === "twitch" ? "Twitch" : "Practice"} case by ${job.contributor.name}: ${result.status}${added.duplicate ? " \xB7 matching input already saved" : ""}.`);
        save();
        render();
        void publish();
      } catch (error) {
        log(error.message);
        toast(error.message, true);
      }
    }
    busy = false;
    render();
  }
  const connection = new TwitchConnection({
    onStatus(status, message) {
      const wasConnected = twitchStatus === "connected";
      twitchStatus = status;
      if (status === "connected" && !wasConnected) {
        intake = true;
        intakeSince = Date.now() - 3e3;
      } else if (status !== "connected") {
        intake = false;
      }
      $("connectionStatus").textContent = message;
      $("connectionStatus").parentElement.classList.toggle("connected", status === "connected");
      log(message);
      render();
      void publish();
    },
    onActivity() {
      messages++;
      $("activity").textContent = messages + " chat messages received";
    },
    onCase(message) {
      if (seenMessages.has(message.id)) return;
      seenMessages.add(message.id);
      if (seenMessages.size > 500) seenMessages.delete(seenMessages.values().next().value);
      if (!intake) {
        log("A Twitch case arrived while intake was paused. It was not accepted.");
        return;
      }
      if (!Number.isFinite(message.sentAt) || message.sentAt < intakeSince || message.sentAt > Date.now() + 3e4) {
        log("An old or invalid-timestamp Twitch case was ignored.");
        return;
      }
      if (Date.now() - (userLastSeen.get(message.user) || 0) < 2500) {
        log("A repeat from the same viewer arrived too quickly.");
        return;
      }
      userLastSeen.set(message.user, Date.now());
      try {
        enqueue(message.text, { id: "twitch:" + message.user, name: message.name }, "twitch", message.id);
      } catch (error) {
        log("Case from " + message.name + " was not accepted: " + error.message);
        toast(error.message, true);
      }
    }
  });
  $("connect").onclick = () => {
    try {
      if (twitchStatus === "connected" || twitchStatus === "connecting") {
        connection.disconnect();
        twitchStatus = "disconnected";
        intake = false;
        $("connectionStatus").textContent = "Disconnected. Practice remains available.";
        $("connectionStatus").parentElement.classList.remove("connected");
        render();
        void publish();
      } else connection.connect($("channel").value);
    } catch (error) {
      toast(error.message, true);
    }
  };
  $("intake").onclick = () => {
    intake = !intake;
    if (intake) intakeSince = Date.now() - 1e3;
    log(intake ? "Chat intake opened for " + CONTRACTS[active].short + "." : "Chat intake paused.");
    render();
    void publish();
  };
  $("practiceForm").onsubmit = (e) => {
    e.preventDefault();
    try {
      enqueue($("caseInput").value, { id: "practice:host", name: "Practice" });
    } catch (error) {
      toast(error.message, true);
    }
  };
  $("warmup").onclick = () => {
    $("caseInput").value = format(CONTRACTS[active].warmup);
    try {
      enqueue($("caseInput").value, { id: "practice:host", name: "Practice" });
    } catch (error) {
      toast(error.message, true);
    }
  };
  $("code").oninput = () => render();
  $("code").onkeydown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.target.selectionStart, end = e.target.selectionEnd;
      e.target.setRangeText("  ", start, end, "end");
      render();
    }
  };
  $("exampleFix").onclick = () => {
    $("code").value = CONTRACTS[active].fix;
    render();
    toast("Example fix loaded. Apply it to check every saved case.");
  };
  $("runSuite").onclick = async () => {
    if (busy) return;
    let source;
    try {
      source = validateSource($("code").value);
    } catch (error) {
      toast(error.message, true);
      return;
    }
    const w = workspace(), wasOpen = intake;
    intake = false;
    busy = true;
    render();
    void publish();
    try {
      const inputs = w.cases.flatMap((c) => c.reduction ? [c.input, c.reduction.input] : [c.input]);
      const results = await request("suite", { contract: active, source, inputs: inputs.length ? inputs : [CONTRACTS[active].warmup] });
      if (!inputs.length && results[0].status === "error") throw new Error(results[0].error);
      applySuite(w, source, inputs.length ? results : []);
      save();
      log("Applied version " + w.version + ". Reran " + inputs.length + " saved original and reduced inputs.");
      toast(inputs.length ? "Saved cases rerun on version " + w.version + "." : "Version " + w.version + " is ready. Send a case to challenge it.");
    } catch (error) {
      toast(error.message, true);
      log(error.message);
    } finally {
      busy = false;
      intake = wasOpen && twitchStatus === "connected";
      if (intake) intakeSince = Date.now() - 1e3;
      render();
      void publish();
    }
  };
  $("challenge").onchange = () => {
    if (busy) return;
    active = $("challenge").value;
    intake = false;
    queue = [];
    $("code").value = workspace().code;
    $("caseInput").value = format(CONTRACTS[active].sample);
    save();
    render();
    void publish();
    log("Switched challenge. Chat intake is paused until you reopen it.");
  };
  $("clearSession").onclick = () => {
    if (busy || !confirm("Clear this challenge and its saved cases? Download the record first if you want to keep it.")) return;
    workspaces[active] = freshWorkspace(active);
    intake = false;
    queue = [];
    $("code").value = workspace().code;
    save();
    render();
    void publish();
    log("Challenge cleared. Chat intake paused.");
  };
  $("exportTests").onclick = () => {
    download(regressionSource(workspace()), "crowdcase.test.mjs", "text/javascript");
    toast("Regression tests downloaded. Import your function from solve.mjs to run them.");
  };
  $("exportRecord").onclick = () => {
    download(JSON.stringify(exportPacket(workspace(), connection.channel), null, 2), "crowdcase-record.json", "application/json");
    toast("Case record downloaded, including implementation versions and contribution sources.");
  };
  $("exportImplementation").onclick = () => {
    download("export default " + workspace().code + "\n", "solve.mjs", "text/javascript");
    toast("Current applied function downloaded.");
  };
  async function setupDisplay() {
    try {
      const health = await fetch("/api/health");
      const data = health.ok ? await health.json() : null;
      if (data?.app === "CrowdCase") {
        let retained;
        try {
          retained = JSON.parse(sessionStorage.getItem("crowdcase-local-room"));
        } catch {
        }
        if (retained?.id && retained.key) {
          const check = await fetch("/api/rooms/" + retained.id);
          if (check.ok) {
            roomId = retained.id;
            roomKey = retained.key;
            localTransport = true;
          }
        }
        if (!localTransport) {
          const r = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
          if (!r.ok) throw new Error();
          const room = await r.json();
          roomId = room.id;
          roomKey = room.key;
          localTransport = true;
          sessionStorage.setItem("crowdcase-local-room", JSON.stringify(room));
        }
      }
    } catch {
    }
    if (!localTransport) {
      pubChannel = new BroadcastChannel("crowdcase-" + roomId);
      pubChannel.onmessage = (e) => {
        if (e.data?.requestSnapshot) void publish();
      };
    }
    void publish();
    setInterval(() => void publish(), 5e3);
  }
  $("openDisplay").onclick = () => {
    const url = new URL(location.origin);
    url.searchParams.set("view", "display");
    url.searchParams.set("room", roomId);
    if (localTransport) url.searchParams.set("transport", "local");
    $("displayUrl").value = url.href;
    $("launchDisplay").href = url.href;
    $("displayHelp").textContent = localTransport ? "Use this URL in an OBS Browser Source at 1440 \xD7 810, or open it in another browser. The local host synchronizes the display." : "This hosted preview synchronizes tabs in the same browser. For a separate OBS process, run the local host from the source repository and open its display URL.";
    $("displayDialog").showModal();
  };
  $("copyDisplay").onclick = async () => {
    try {
      await navigator.clipboard.writeText($("displayUrl").value);
      toast("Display URL copied.");
    } catch {
      $("displayUrl").select();
      toast("Select and copy the display URL.");
    }
  };
  $("code").value = workspace().code;
  $("caseInput").value = format(CONTRACTS[active].sample);
  render();
  void setupDisplay();
}
