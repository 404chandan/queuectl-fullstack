export function initSSE(app) {
  const clients = new Set();

  app.get('/events', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders();
    res.write('retry: 3000\n\n');
    const client = { res };
    clients.add(client);
    req.on('close', () => {
      clients.delete(client);
    });
  });

  function broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of clients) c.res.write(payload);
  }

  return { broadcast };
}