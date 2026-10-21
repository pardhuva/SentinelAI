const app = require('./app');
const config = require('./config');

const server = app.listen(config.port, () => {
  console.log(`[DemoTarget] Acme HR Assistant running on port ${config.port}`);
  console.log(`[DemoTarget] Chat endpoint: http://localhost:${config.port}/api/chat`);
});

module.exports = server;
