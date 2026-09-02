const express = require('express');
const http = require('http');
const https = require('https');
const next = require('next');
const { Server } = require('socket.io');
const os = require('os');
const cors = require('cors');

const isProd = process.env.NODE_ENV === 'production';
const app = next({ dev: !isProd });
const handle = app.getRequestHandler();

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT, 10) || 3443;

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.prepare().then(() => {
  const server = express();
  server.use(cors());

  const httpServer = http.createServer(server);

  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    socket.on('join-room', ({ roomId, role }) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.role = role;
      console.log(`[Room: ${roomId}] Socket ${socket.id} joined as ${role || 'peer'}`);

      socket.to(roomId).emit('peer-joined', {
        peerId: socket.id,
        role: role || 'peer',
      });
    });

    socket.on('offer', ({ roomId, offer }) => {
      socket.to(roomId).emit('offer', {
        senderId: socket.id,
        offer,
      });
    });

    socket.on('answer', ({ roomId, answer }) => {
      socket.to(roomId).emit('answer', {
        senderId: socket.id,
        answer,
      });
    });

    socket.on('ice-candidate', ({ roomId, candidate }) => {
      socket.to(roomId).emit('ice-candidate', {
        senderId: socket.id,
        candidate,
      });
    });

    socket.on('stream-status', ({ roomId, status, metadata }) => {
      socket.to(roomId).emit('stream-status', {
        status,
        metadata,
        senderId: socket.id,
      });
    });

    socket.on('disconnect', () => {
      const { roomId, role } = socket.data;
      if (roomId) {
        socket.to(roomId).emit('peer-left', {
          peerId: socket.id,
          role,
        });
      }
    });
  });

  server.get('/api/network-ip', (req, res) => {
    const currentIp = getLocalIpAddress();
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    const protocol = isHttps ? 'https' : 'http';
    const hostHeader = req.headers.host;

    res.json({
      localIp: currentIp,
      port: PORT,
      isProduction: isProd,
      currentOrigin: `${protocol}://${hostHeader}`,
      lanHttpUrl: `http://${currentIp}:${PORT}`,
      lanHttpsUrl: `https://${currentIp}:${HTTPS_PORT}`,
      allIps: Object.entries(os.networkInterfaces()).flatMap(([name, ifaces]) =>
        ifaces
          .filter((i) => i.family === 'IPv4')
          .map((i) => ({ name, ip: i.address, internal: i.internal }))
      ),
    });
  });

  server.all('*', (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(PORT, (err) => {
    if (err) throw err;
    const localIp = getLocalIpAddress();
    console.log('\n🚀 ===============================================');
    console.log(`📡 CastQR Mirroring Server Running!`);
    console.log(`👉 Environment: ${isProd ? 'Production' : 'Development'}`);
    console.log(`👉 Port:        ${PORT}`);
    console.log(`👉 Local:       http://localhost:${PORT}`);
    console.log(`👉 Network:     http://${localIp}:${PORT}`);
    console.log('===============================================\n');
  });
});
