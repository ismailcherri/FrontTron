export class Connection extends EventTarget {
  pending = new Map();
  next = 0;
  open() {
    if (this.socket && this.socket.readyState < 2) return;
    const url = new URL('/ws', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.socket = new WebSocket(url);
    this.socket.onmessage = ({ data }) => {
      for (const [name, payload] of JSON.parse(data)) {
        if (typeof name === 'number') {
          this.pending.get(name)?.(payload);
          this.pending.delete(name);
        } else this.dispatchEvent(new CustomEvent('event', { detail: [name, payload] }));
      }
    };
    this.socket.onclose = () => {
      for (const reply of this.pending.values())
        reply({ success: false, error: 'Connection lost.' });
      this.pending.clear();
      this.dispatchEvent(new Event('offline'));
    };
  }
  signal(name, data) {
    if (this.socket?.readyState === 1) this.socket.send(JSON.stringify([[name, data]]));
  }
  request(name, data) {
    if (this.socket?.readyState !== 1)
      return Promise.resolve({ success: false, error: 'Connect to the server first.' });
    const id = ++this.next;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.socket.send(JSON.stringify([[name, data, id]]));
    });
  }
}
