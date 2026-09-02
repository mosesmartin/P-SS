# 📱 CastQR - Real-time QR Code Mobile Screen Mirroring

A high-performance, real-time mobile screen casting and mirroring web application built with **Next.js**, **Socket.io**, and **WebRTC Peer-to-Peer streaming**.

---

## ✨ Features

- ⚡ **Zero Apps or Plugins Needed**: Runs entirely inside modern web browsers (Chrome, Edge, Firefox, Brave).
- 📷 **Dynamic QR Code Generation**: Host monitor renders a high-res QR code with auto-detected LAN IP or custom domain.
- 🚀 **Sub-Second Low Latency**: WebRTC P2P direct video streaming with Google STUN servers.
- 🔒 **End-to-End Encryption**: Secure WebRTC DTLS/SRTP media encryption with strict user consent prompts.
- 🎥 **Host Recording & Snapshots**: One-click PNG snapshot capture and direct WebM stream recording.
- 🎛️ **Mobile Stream Controls**: Quality presets (1080p FHD, 720p HD, 480p Fast), System audio toggle, and live broadcast timers.

---

## 🏗️ Architecture & How It Works

```
+-------------------+                      +-----------------------+
|   Host Computer   | <==================> |  Next.js + Socket.io  |
|  (Desktop Screen) |   WebSockets (SDP)   |   (Signaling Server)  |
+-------------------+                      +-----------------------+
          ^                                            ^
          |                                            |
          |       Direct WebRTC Video Stream (P2P)     | WebSockets
          +============================================+
                               |
                               v
                     +-------------------+
                     |    Mobile Phone   |
                     |  (Screen Capture) |
                     +-------------------+
```

1. **Host Dashboard (`/host`)**: Creates a unique Room ID, joins Socket.io room, and displays dynamic QR Code.
2. **Mobile Sender (`/share?room=[id]`)**: Scans QR code, joins room, prompts user for Screen Capture permission via `navigator.mediaDevices.getDisplayMedia()`.
3. **Signaling Exchange**: Socket.io exchanges WebRTC Offer, Answer, and ICE candidates between host and phone.
4. **Live Stream**: Direct P2P video stream is rendered in real-time on the Host screen.

---

## 🚀 Getting Started

### 1. Run the Development Server
```bash
npm run dev
```
The server will start on `http://localhost:3000` (and on your local Wi-Fi IP e.g., `http://192.168.1.X:3000`).

---

## 📱 How to Test & Demo

### Option A: Testing on the Same Device (Two Browser Tabs)
1. Open `http://localhost:3000/host` in Tab 1 (Host Monitor).
2. Click **"Test Sender Tab in Browser"** or open the generated URL in Tab 2.
3. In Tab 2, click **"Start Sharing Screen"** and select a window/screen.
4. Switch to Tab 1 to see your live stream with recording and snapshot controls!

### Option B: Testing with Real Mobile Phone (Same Wi-Fi Network)
1. Ensure your laptop and phone are connected to the **same Wi-Fi network**.
2. Open `http://localhost:3000/host` on your laptop.
3. The dashboard will automatically detect your Wi-Fi IP (e.g., `http://192.168.1.15:3000`).
4. Scan the QR code with your Android phone camera (Chrome browser).
5. Tap **"Start Sharing Screen"** -> Tap **"Start now"** on Android system prompt.
6. Your mobile screen is now live on your laptop monitor!

### Option C: Remote Testing over the Internet (Ngrok / Cloudflare Tunnel)
Because mobile browsers require HTTPS for `getDisplayMedia`:
```bash
# In a new terminal:
npx ngrok http 3000
```
Copy the `https://xxxx.ngrok-free.app` URL, paste it into the **Network Host Address** box on the `/host` page, and the QR code will instantly update to the HTTPS URL for seamless mobile casting!

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router, React 18)
- **Signaling Server**: Node.js + Express + Socket.io
- **Streaming**: WebRTC (`RTCPeerConnection`, STUN servers)
- **Screen Capture**: HTML5 `navigator.mediaDevices.getDisplayMedia`
- **Styling**: TailwindCSS & Custom Glassmorphism Theme
- **Icons**: Lucide React
- **QR Engine**: `qrcode.react`
