export default function openWebSocket(currentLocation: Location) {
  try {
    const wsProtocol = currentLocation.protocol === 'https:' ? 'wss://' : 'ws://';
    const wsUri = [wsProtocol, currentLocation.host, '/websocket'].join('');
    return new WebSocket(wsUri);
  } catch {
    // WebSocket URL error or WebSocket is not supported by browser.
    // Assume it's the second case since URL error is easy to notice.
    (async () => {
      try {
        await fetch('/nowebsocket', {
          method: 'post',
          headers: {
            'Content-Length': '0',
          },
        });
      } catch (e) {
        console.log('Error:', e);
      }
    })();
    return null;
  }
}
