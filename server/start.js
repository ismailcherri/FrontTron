import { createGameServer } from './server.js';

const { server, wss } = createGameServer({
  analytics: process.env.ANALYTICS_ID,
});
const port = Number(process.env.PORT || 8080);
server.listen(port, process.env.HOST || '0.0.0.0', () => {
  console.log('FrontTron listening on http://localhost:' + server.address().port);
});
function shutdown() {
  for (const client of wss.clients) client.terminate();
  server.close(() => process.exit(0));
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
