const express = require('express');
const http = require('http');
const https = require('https');
const next = require('next');
const { Server } = require('socket.io');
const os = require('os');
const cors = require('cors');
const selfsigned = require('selfsigned');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const HTTP_PORT = parseInt(process.env.PORT, 10) || 3000;
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT, 10) || 3443;

// Helper to get local Wi-Fi / Ethernet IPv4 address
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

  // Generate robust self-signed certificate with IP Subject Alternative Names (SANs)
  const localIp = getLocalIpAddress();
  const attrs = [
    { name: 'commonName', value: localIp },
    { name: 'organizationName', value: 'CastQR' },
  ];
  
  const pems = selfsigned.generate(attrs, {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'basicConstraints',
        cA: true,
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true,
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true,
      },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 7, ip: localIp },
          { type: 7, ip: '127.0.0.1' },
          { type: 2, value: 'localhost' },
          { type: 2, value: localIp },
        ],
      },
    ],
  });

  const sslOptions = {
    key: pems.private,
    cert: pems.cert,
    minVersion: 'TLSv1.2',
    honorCipherOrder: true,
  };

  const httpServer = http.createServer(server);
  const httpsServer = https.createServer(sslOptions, server);

  // Initialize Socket.io on both HTTP and HTTPS servers
  const ioHttp = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  const ioHttps = new Server(httpsServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  function setupSignaling(ioInstance, protocol) {
    ioInstance.on('connection', (socket) => {
      socket.on('join-room', ({ roomId, role }) => {
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.role = role;
        console.log(`[Room: ${roomId} (${protocol})] Socket ${socket.id} joined as ${role || 'peer'}`);

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
  }

  setupSignaling(ioHttp, 'HTTP');
  setupSignaling(ioHttps, 'HTTPS');

  // REST endpoint to get current server network info
  server.get('/api/network-ip', (req, res) => {
    const currentIp = getLocalIpAddress();
    res.json({
      localIp: currentIp,
      httpPort: HTTP_PORT,
      httpsPort: HTTPS_PORT,
      lanHttpUrl: `http://${currentIp}:${HTTP_PORT}`,
      lanHttpsUrl: `https://${currentIp}:${HTTPS_PORT}`,
      allIps: Object.entries(os.networkInterfaces()).flatMap(([name, ifaces]) =>
        ifaces
          .filter((i) => i.family === 'IPv4')
          .map((i) => ({ name, ip: i.address, internal: i.internal }))
      ),
    });
  });

  // Let Next.js handle all other routes
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(HTTP_PORT, () => {
    console.log(`👉 HTTP Server:   http://localhost:${HTTP_PORT} | http://${localIp}:${HTTP_PORT}`);
  });

  httpsServer.listen(HTTPS_PORT, () => {
    console.log('\n🚀 ===============================================');
    console.log(`📡 QR Screen Mirroring Dual Server Ready!`);
    console.log(`🔒 HTTPS (Mobile): https://${localIp}:${HTTPS_PORT}`);
    console.log(`🌐 HTTP (Desktop): http://localhost:${HTTP_PORT}`);
    console.log('===============================================\n');
  });
});
