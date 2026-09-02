'use client';
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import Navbar from '../../components/Navbar';
import { createPeerConnection } from '../../lib/webrtc';
import {
  Monitor,
  Smartphone,
  QrCode,
  Copy,
  Check,
  Maximize,
  Minimize,
  Camera,
  Video,
  Volume2,
  VolumeX,
  Wifi,
  Radio,
  Clock,
  Shield,
  ExternalLink,
  Lock,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

export default function HostDashboard() {
  const [roomId, setRoomId] = useState('');
  const [lanHttpUrl, setLanHttpUrl] = useState('');
  const [lanHttpsUrl, setLanHttpsUrl] = useState('');
  const [selectedBaseUrl, setSelectedBaseUrl] = useState('');
  const [customHost, setCustomHost] = useState('');
  const [availableIps, setAvailableIps] = useState([]);
  const [copied, setCopied] = useState(false);
  
  // Connection & Stream State
  const [connectionState, setConnectionState] = useState('disconnected'); // disconnected, waiting, connected, streaming
  const [peerRole, setPeerRole] = useState(null);
  const [streamActive, setStreamActive] = useState(false);
  const [streamStats, setStreamStats] = useState({ width: 0, height: 0, fps: 0 });
  const [streamDuration, setStreamDuration] = useState(0);

  // Stream Controls
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const timerRef = useRef(null);

  // Generate Room ID and Fetch Network IP
  useEffect(() => {
    const generatedRoom = 'cast_' + Math.random().toString(36).substring(2, 8);
    setRoomId(generatedRoom);

    // Fetch server LAN IP
    fetch('/api/network-ip')
      .then((res) => res.json())
      .then((data) => {
        if (data.lanHttpsUrl) {
          setLanHttpsUrl(data.lanHttpsUrl);
          setSelectedBaseUrl(data.lanHttpsUrl); // Default to HTTPS for mobile
        }
        if (data.lanHttpUrl) {
          setLanHttpUrl(data.lanHttpUrl);
        }
        if (data.allIps) {
          setAvailableIps(data.allIps);
        }
      })
      .catch(() => {
        const origin = window.location.origin;
        setLanHttpUrl(origin);
        setSelectedBaseUrl(origin);
      });
  }, []);

  // Compute the exact link to encode in QR code
  const currentBaseUrl = customHost.trim() || selectedBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const shareableUrl = roomId ? `${currentBaseUrl}/share?room=${roomId}` : '';

  // Initialize Socket.io and WebRTC setup
  useEffect(() => {
    if (!roomId) return;

    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Host] Connected to signaling server with ID:', socket.id);
      socket.emit('join-room', { roomId, role: 'host' });
      setConnectionState('waiting');
    });

    socket.on('peer-joined', ({ peerId, role }) => {
      console.log('[Host] Peer joined:', peerId, role);
      setPeerRole(role);
      setConnectionState('connected');
    });

    socket.on('peer-left', () => {
      console.log('[Host] Peer disconnected');
      setConnectionState('waiting');
      setStreamActive(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    });

    const pc = createPeerConnection(
      (candidate) => {
        socket.emit('ice-candidate', { roomId, candidate });
      },
      (event) => {
        console.log('[Host] Remote track received:', event.track.kind);
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setStreamActive(true);
          setConnectionState('streaming');

          event.track.onloadedmetadata = () => {
            const settings = event.track.getSettings();
            setStreamStats({
              width: settings.width || 1080,
              height: settings.height || 1920,
              fps: settings.frameRate || 30,
            });
          };
        }
      },
      (state) => {
        console.log('[Host] PeerConnection state:', state);
        if (state === 'disconnected' || state === 'failed') {
          setStreamActive(false);
          setConnectionState('waiting');
        }
      }
    );
    pcRef.current = pc;

    socket.on('offer', async ({ offer }) => {
      try {
        console.log('[Host] Received Offer, creating Answer...');
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { roomId, answer });
      } catch (err) {
        console.error('[Host] Error processing offer:', err);
      }
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      try {
        if (candidate && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('[Host] Error adding ICE candidate:', err);
      }
    });

    socket.on('stream-status', ({ status }) => {
      if (status === 'stopped') {
        setStreamActive(false);
        setConnectionState('connected');
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }
    });

    return () => {
      socket.disconnect();
      pc.close();
    };
  }, [roomId]);

  useEffect(() => {
    if (streamActive) {
      setStreamDuration(0);
      timerRef.current = setInterval(() => {
        setStreamDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [streamActive]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = () => {
    if (!shareableUrl) return;
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  };

  const takeSnapshot = () => {
    if (!videoRef.current || !streamActive) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1920;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const image = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = image;
    a.download = `screen-snapshot-${new Date().toISOString().slice(0, 19)}.png`;
    a.click();
  };

  const toggleRecording = () => {
    if (!streamActive || !videoRef.current || !videoRef.current.srcObject) return;

    if (!isRecording) {
      recordedChunksRef.current = [];
      const stream = videoRef.current.srcObject;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp8,opus' });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `screen-recording-${new Date().toISOString().slice(0, 19)}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Monitor className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                Host Monitor Dashboard
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  Room: {roomId || '...'}
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Scan QR code below from your phone to mirror screen here in real-time.
              </p>
            </div>
          </div>

          {/* Connection Status Pill */}
          <div className="flex items-center gap-2.5">
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border ${
                streamActive
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : connectionState === 'connected'
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  streamActive
                    ? 'bg-emerald-400 animate-ping'
                    : connectionState === 'connected'
                    ? 'bg-cyan-400'
                    : 'bg-amber-400 animate-pulse'
                }`}
              ></span>
              <span>
                {streamActive
                  ? 'LIVE STREAMING'
                  : connectionState === 'connected'
                  ? 'Phone Connected (Ready to share)'
                  : 'Waiting for Phone to Scan QR'}
              </span>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Main Video Viewport */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div
              ref={containerRef}
              className="glass-panel rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950/90 relative aspect-video flex items-center justify-center shadow-2xl group min-h-[400px] lg:min-h-[500px]"
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isMuted}
                className={`w-full h-full object-contain transition-opacity duration-300 ${
                  streamActive ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {!streamActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
                  <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 animate-pulse">
                      <Smartphone className="w-10 h-10" />
                    </div>
                    <div className="absolute -inset-3 rounded-full border border-cyan-500/20 animate-ping pointer-events-none"></div>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">No Active Screen Stream</h3>
                  <p className="text-slate-400 text-sm max-w-md mb-6 leading-relaxed">
                    Scan the QR code on the right with your phone to begin mirroring your mobile screen.
                  </p>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Radio className="w-3.5 h-3.5 text-cyan-400" /> WebRTC Signaling Ready
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" /> End-to-End P2P
                    </span>
                  </div>
                </div>
              )}

              {streamActive && (
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-20">
                  <div className="flex items-center gap-2 pointer-events-auto">
                    <span className="px-2.5 py-1 rounded-md bg-rose-600/90 text-white text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5 shadow-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                      Live
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-slate-900/80 backdrop-blur-md text-slate-200 text-xs font-mono border border-slate-700/60 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      {formatTime(streamDuration)}
                    </span>
                  </div>

                  <div className="px-2.5 py-1 rounded-md bg-slate-900/80 backdrop-blur-md text-slate-300 text-xs font-mono border border-slate-700/60 pointer-events-auto">
                    {streamStats.width}x{streamStats.height} @ {streamStats.fps}fps
                  </div>
                </div>
              )}

              {streamActive && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 rounded-xl bg-slate-950/85 backdrop-blur-xl border border-slate-800 shadow-2xl pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    onClick={takeSnapshot}
                    title="Take Screenshot"
                    className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-cyan-400 transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                  </button>

                  <button
                    onClick={toggleRecording}
                    title={isRecording ? 'Stop Recording' : 'Record Stream'}
                    className={`p-2.5 rounded-lg transition-colors ${
                      isRecording
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-rose-400'
                    }`}
                  >
                    <Video className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                    className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-indigo-400 transition-colors"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  <div className="w-[1px] h-5 bg-slate-800 mx-1"></div>

                  <button
                    onClick={toggleFullscreen}
                    title="Toggle Fullscreen"
                    className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white transition-colors"
                  >
                    {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>

            <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-4 text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  Instant PNG Snapshots
                </span>
                <span className="flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-rose-400" />
                  Local WebM Recording
                </span>
                <span className="flex items-center gap-1.5">
                  <Maximize className="w-3.5 h-3.5 text-indigo-400" />
                  Fullscreen Mode
                </span>
              </div>

              {streamActive && (
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  P2P Direct Video Stream Connected
                </div>
              )}
            </div>
          </div>

          {/* Right Side: QR Code & Connection Settings Card */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 flex flex-col gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-cyan-400" />
                  Mobile Connection QR
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> HTTPS Ready
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Scan this with your mobile phone camera or barcode scanner.
              </p>
            </div>

            {/* QR Code Canvas Box */}
            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-xl">
              {shareableUrl ? (
                <QRCodeSVG
                  value={shareableUrl}
                  size={200}
                  level="H"
                  includeMargin={false}
                  className="rounded-lg"
                />
              ) : (
                <div className="w-[200px] h-[200px] flex items-center justify-center text-slate-400">
                  Generating QR...
                </div>
              )}
              <div className="mt-4 text-center">
                <p className="text-[11px] font-mono text-slate-700 font-semibold truncate max-w-[220px]">
                  Room: {roomId}
                </p>
              </div>
            </div>

            {/* Direct Link Share & Copy */}
            <div className="space-y-2">
              <label className="text-xs text-slate-300 font-medium flex items-center justify-between">
                <span>Direct Share URL:</span>
                <span className="text-[10px] text-cyan-400 font-mono font-semibold">
                  {selectedBaseUrl.startsWith('https') ? '🔒 HTTPS Secure' : 'HTTP'}
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareableUrl}
                  className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 select-all focus:outline-none"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Network Protocol / URL Selector */}
            <div className="space-y-2 border-t border-slate-800/80 pt-4">
              <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-indigo-400" />
                Connection Protocol / Host URL:
              </label>
              
              <div className="space-y-2">
                <select
                  value={selectedBaseUrl}
                  onChange={(e) => {
                    setSelectedBaseUrl(e.target.value);
                    setCustomHost('');
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {lanHttpsUrl && (
                    <option value={lanHttpsUrl}>
                      🔒 HTTPS (Recommended for Mobile) - {lanHttpsUrl}
                    </option>
                  )}
                  {lanHttpUrl && (
                    <option value={lanHttpUrl}>
                      🌐 HTTP (Local Network) - {lanHttpUrl}
                    </option>
                  )}
                  <option value="http://localhost:3000">Localhost (http://localhost:3000)</option>
                </select>

                <input
                  type="text"
                  placeholder="Or custom Tunnel URL (e.g. https://xyz.ngrok-free.app)"
                  value={customHost}
                  onChange={(e) => setCustomHost(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Mobile HTTPS tip */}
              <div className="flex flex-col gap-1.5 mt-2 text-[11px] text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 font-semibold text-cyan-300">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  Mobile Browser HTTPS Tip:
                </div>
                <p className="leading-relaxed text-slate-300">
                  Jab aap phone se HTTPS QR code scan karenge, toh browser <em>&quot;Your connection is not private&quot;</em> dikhayega. 
                  Bas <strong>Advanced &rarr; Proceed to {lanHttpsUrl.replace('https://', '')} (unsafe)</strong> tap karein. Is se mobile screen sharing 100% unlock ho jayegi!
                </p>
              </div>
            </div>

            {/* Test Link Button */}
            <div className="pt-1">
              <a
                href={shareableUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-all"
              >
                <span>Test Sender Tab in Browser</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
