export function parseIRC(line) {
  let rest = line, tags = {}, prefix = '';
  if (rest.startsWith('@')) {
    const end = rest.indexOf(' '); if (end < 0) return null;
    for (const pair of rest.slice(1, end).split(';')) {
      const i = pair.indexOf('=');
      tags[i < 0 ? pair : pair.slice(0, i)] = (i < 0 ? '' : pair.slice(i + 1)).replace(/\\([s:nr\\])/g, (_, c) => ({s:' ',':':';',n:'\n',r:'\r','\\':'\\'})[c]);
    }
    rest = rest.slice(end + 1);
  }
  if (rest.startsWith(':')) { const end = rest.indexOf(' '); if (end < 0) return null; prefix = rest.slice(1,end); rest = rest.slice(end+1); }
  const i = rest.indexOf(' :'), text = i < 0 ? '' : rest.slice(i+2);
  const parts = (i < 0 ? rest : rest.slice(0,i)).split(' ');
  return { command: parts.shift(), params: parts, text, tags, prefix };
}

export function caseMessage(message, channel) {
  if (message?.command !== 'PRIVMSG' || message.params[0] !== '#' + channel || !/^!case(?:\s|$)/i.test(message.text)) return null;
  if (!/^\d+$/.test(message.tags['user-id'] || '') || !message.tags.id) return null;
  return { text: message.text.replace(/^!case\s*/i, ''), user: message.tags['user-id'],
    name: (message.tags['display-name'] || message.prefix.split('!')[0]).slice(0,32),
    id: message.tags.id, sentAt: Number(message.tags['tmi-sent-ts']) };
}

export class TwitchConnection {
  constructor({ onStatus, onCase, onActivity, WebSocketClass = globalThis.WebSocket }) {
    Object.assign(this, {onStatus,onCase,onActivity,WebSocketClass}); this.generation = 0;
  }
  connect(channel) {
    channel = channel.trim().toLowerCase().replace(/^#/, '');
    if (!/^[a-z0-9_]{3,25}$/.test(channel)) throw new Error('Enter a Twitch channel name, without a URL.');
    this.disconnect(); const generation = ++this.generation;
    this.channel = channel; this.buffer = ''; this.onStatus('connecting', 'Joining #' + channel);
    const ws = this.socket = new this.WebSocketClass('wss://irc-ws.chat.twitch.tv:443');
    this.timer = setTimeout(() => { if (generation === this.generation) { ws.close(); this.onStatus('error','Twitch did not confirm the channel. Reconnect to try again.'); } }, 15000);
    ws.onopen = () => {
      if (generation !== this.generation) return;
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands\r\n');
      ws.send('PASS SCHMOOPIIE\r\n'); ws.send('NICK justinfan' + Math.floor(100000 + Math.random()*900000) + '\r\n'); ws.send('JOIN #' + channel + '\r\n');
    };
    ws.onmessage = event => {
      if (generation !== this.generation) return;
      this.buffer += String(event.data);
      if (this.buffer.length > 100000) { ws.close(); return; }
      const lines = this.buffer.split('\r\n'); this.buffer = lines.pop();
      for (const line of lines) {
        const m = parseIRC(line); if (!m) continue;
        if (m.command === 'PING') { ws.send('PONG :' + (m.text || m.params[0]) + '\r\n'); continue; }
        if ((m.command === '366' && m.params.includes('#' + channel)) || (m.command === 'ROOMSTATE' && m.params[0] === '#' + channel)) { clearTimeout(this.timer); this.onStatus('connected', 'Reading #' + channel + '. No messages are sent.'); }
        if (m.command === 'NOTICE') this.onStatus('error', m.text || 'Twitch rejected the connection.');
        if (m.command === 'RECONNECT') { ws.close(); this.onStatus('error', 'Twitch requested a reconnect. Intake is paused.'); }
        if (m.command === 'PRIVMSG' && m.params[0] === '#' + channel) { this.onActivity?.(); const c = caseMessage(m,channel); if (c) this.onCase(c); }
      }
    };
    ws.onerror = () => { if (generation === this.generation) this.onStatus('error','Could not reach Twitch. Check the network and reconnect.'); };
    ws.onclose = () => { clearTimeout(this.timer); if (generation === this.generation) this.onStatus('disconnected','Chat disconnected. Intake is paused.'); };
    return channel;
  }
  disconnect() { this.generation++; clearTimeout(this.timer); this.socket?.close(); this.socket = null; }
}
