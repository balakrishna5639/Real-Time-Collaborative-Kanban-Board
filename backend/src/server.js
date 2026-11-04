const http = require('http');
const app = require('./app');
const { PORT } = require('./config/environment');
const { initSocketServer } = require('./sockets/socket.server');

const server = http.createServer(app);

// Initialize Socket.IO real-time server
const io = initSocketServer(server);

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Collaborative Kanban Backend running on port ${PORT}`);
  console.log(`📡 WebSocket server initialized`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP and Socket servers.');
  server.close(() => {
    process.exit(0);
  });
});

