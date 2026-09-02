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
  Radio,
  Clock,
  Shield,
  ExternalLink,
  Lock,
  Globe,
  Settings,
  Eye,
  EyeOff,
  Sparkles,
  Cast
} from 'lucide-react';

export default function HostDashboard() {
  const [roomId, setRoomId] = useState('');
  const [originUrl, setOriginUrl] = useState('');
  const [customHost, setCustomHost] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Connection & Stream State
  const [connectionState, setConnectionState] = useState('disconnected');
  const [peerRole, setPeerRole] = useState(null);
  const [streamActive, setStreamActive] = useState(false);
  const [streamStats, setStreamStats] = useState({ width: 0, height: 0, fps: 0 });
  const [streamDuration, setStreamDuration] = useState(0);

  // Stream Controls
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [cinemaMode, setCinemaMode] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    const generatedRoom = 'cast_' + Math.random().toString(36).substring(2, 8);
    setRoomId(generatedRoom);

    if (typeof window !== 'undefined') {
      setOriginUrl(window.location.origin);
    }
  }, []);

  const activeBaseUrl = customHost.trim() || originUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const shareableUrl = (roomId && activeBaseUrl) ? `${activeBaseUrl}/share?room=${roomId}` : '';

  useEffect(() => {
    if (!roomId) return;

    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-room', { roomId, role: 'host' });
      setConnectionState('waiting');
    });

    socket.on('peer-joined', ({ peerId, role }) => {
      setPeerRole(role);
      setConnectionState('connected');
    });

    socket.on('peer-left', () => {
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
        const stream = event.streams[0] || new MediaStream([event.track]);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.play().catch((e) => console.warn('[Host] Auto-play warning:', e));

          setStreamActive(true);
          setConnectionState('streaming');

          event.track.onloadedmetadata = () => {
            const settings = event.track.getSettings();
            setStreamStats({
              width: settings.width || 1280,
              height: settings.height || 720,
              fps: settings.frameRate || 30,
            });
          };
        }
      },
      (state) => {
        if (state === 'connected') {
          setConnectionState('streaming');
        } else if (state === 'disconnected' || state === 'failed') {
          setStreamActive(false);
          setConnectionState('waiting');
        }
      }
    );
    pcRef.current = pc;

    socket.on('offer', async ({ offer }) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        while (iceCandidatesQueueRef.current.length > 0) {
          const queuedCandidate = iceCandidatesQueueRef.current.shift();
          try {
            await pc.addIceCandidate(new RTCIceCandidate(queuedCandidate));
          } catch (iceErr) {
            console.warn('[Host] Failed adding queued candidate:', iceErr);
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { roomId, answer });
      } catch (err) {
        console.error('[Host] Error processing offer:', err);
      }
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      try {
        if (!candidate) return;
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          iceCandidatesQueueRef.current.push(candidate);
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
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const image = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = image;
    a.download = `castqr-snapshot-${new Date().toISOString().slice(0, 19)}.png`;
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
        a.download = `castqr-recording-${new Date().toISOString().slice(0, 19)}.webm`;
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
    <div className="flex flex-col h-screen overflow-hidden bg-[#060911] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-3 sm:px-4 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-400 p-0.5 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[6px] flex items-center justify-center">
              <Cast className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-bold text-sm text-white tracking-tight">
              Cast<span className="text-cyan-400">QR</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-300 border border-slate-700 font-mono">
              {roomId || '...'}
            </span>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              streamActive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-500/20'
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
            <span className="text-[10px] sm:text-[11px] font-medium">
              {streamActive
                ? 'LIVE'
                : connectionState === 'connected'
                ? 'Ready'
                : 'Waiting'}
            </span>
          </div>

          {streamActive && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>{formatTime(streamDuration)}</span>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1.5">
          {streamActive && (
            <button
              onClick={() => setCinemaMode(!cinemaMode)}
              title={cinemaMode ? 'Show QR Sidebar' : 'Cinema View'}
              className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
                cinemaMode
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {cinemaMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{cinemaMode ? 'Show QR' : 'Cinema'}</span>
            </button>
          )}

          <a
            href={shareableUrl}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-200 text-xs font-medium flex items-center gap-1 transition-all"
          >
            <span>Sender</span>
            <ExternalLink className="w-3 h-3 text-cyan-400" />
          </a>
        </div>
      </header>

      {/* Main Viewport: Responsive for Mobile, Tablet, and Desktop */}
      <main className="flex-1 p-2 sm:p-4 flex flex-col lg:flex-row gap-3 sm:gap-4 overflow-hidden relative">
        
        {/* Main Center/Left Box (Video or Centered QR on Mobile when inactive) */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          <div
            ref={containerRef}
            className="w-full h-full rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950 flex items-center justify-center relative shadow-2xl group"
          >
            {/* Live Video */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isMuted}
              className={`max-w-full max-h-full w-full h-full object-contain transition-opacity duration-300 ${
                streamActive ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Inactive State: Displays QR Code directly on Mobile & Desktop placeholder */}
            {!streamActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 text-center z-10 select-none overflow-y-auto">
                {/* Mobile / Tablet QR Centered View */}
                <div className="lg:hidden flex flex-col items-center justify-center w-full max-w-xs">
                  <div className="p-3 bg-white rounded-2xl shadow-2xl mb-3">
                    {shareableUrl ? (
                      <QRCodeSVG
                        value={shareableUrl}
                        size={170}
                        level="M"
                        includeMargin={false}
                        className="rounded-lg"
                      />
                    ) : (
                      <div className="w-[170px] h-[170px] flex items-center justify-center text-slate-400 text-xs">
                        Generating QR...
                      </div>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-white mb-1">Scan to Mirror Screen</h3>
                  <p className="text-slate-400 text-[11px] mb-3">
                    Scan with your camera or tap below to copy share link:
                  </p>

                  <div className="flex w-full gap-1.5 mb-2">
                    <input
                      type="text"
                      readOnly
                      value={shareableUrl}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-slate-300 select-all focus:outline-none truncate"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors shrink-0"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Done' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Desktop Waiting Placeholder */}
                <div className="hidden lg:flex flex-col items-center">
                  <div className="relative mb-5">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 animate-pulse shadow-xl shadow-indigo-500/10">
                      <Smartphone className="w-8 h-8" />
                    </div>
                    <div className="absolute -inset-2 rounded-2xl border border-cyan-500/20 animate-ping pointer-events-none"></div>
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5">Awaiting Screen Broadcast</h3>
                  <p className="text-slate-400 text-xs sm:text-sm max-w-sm mb-4 leading-relaxed">
                    Scan the QR code on the right with your phone to begin live screen mirroring.
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 bg-slate-900/60 px-3.5 py-1.5 rounded-full border border-slate-800">
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <Radio className="w-3 h-3 animate-pulse" /> WebRTC P2P
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <Shield className="w-3 h-3" /> End-to-End Direct
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Floating Top Stats on Active Stream */}
            {streamActive && (
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
                <div className="flex items-center gap-2 pointer-events-auto">
                  <span className="px-2 py-0.5 rounded-md bg-rose-600/90 text-white text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 shadow-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                    Live
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md text-slate-200 text-[11px] font-mono border border-slate-800">
                    {formatTime(streamDuration)}
                  </span>
                </div>

                <div className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md text-slate-300 text-[11px] font-mono border border-slate-800 pointer-events-auto">
                  {streamStats.width}x{streamStats.height}
                </div>
              </div>
            )}

            {/* Floating Bottom Control Bar on Active Stream */}
            {streamActive && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-950/90 backdrop-blur-xl border border-slate-800 shadow-2xl pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={takeSnapshot}
                  title="Take PNG Screenshot"
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-cyan-400 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                </button>

                <button
                  onClick={toggleRecording}
                  title={isRecording ? 'Stop Recording' : 'Record Stream to WebM'}
                  className={`p-2 rounded-lg transition-colors ${
                    isRecording
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-rose-400'
                  }`}
                >
                  <Video className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    const nextMuted = !isMuted;
                    setIsMuted(nextMuted);
                    if (videoRef.current) videoRef.current.muted = nextMuted;
                  }}
                  title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-indigo-400 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <div className="w-[1px] h-4 bg-slate-800 mx-1"></div>

                <button
                  onClick={toggleFullscreen}
                  title="Toggle Fullscreen"
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white transition-colors"
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right QR Sidebar (Desktop & Tablets in 2-col) */}
        {!cinemaMode && (
          <aside className="w-80 shrink-0 hidden lg:flex flex-col h-full rounded-2xl border border-slate-800/80 bg-slate-950/70 backdrop-blur-xl p-4 justify-between overflow-y-auto">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-cyan-400" />
                    Mobile QR Connect
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                    Auto-Sync
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Scan with iPhone / Android camera to cast.
                </p>
              </div>

              {/* QR Box */}
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-lg">
                {shareableUrl ? (
                  <QRCodeSVG
                    value={shareableUrl}
                    size={160}
                    level="M"
                    includeMargin={false}
                    className="rounded-md"
                  />
                ) : (
                  <div className="w-[160px] h-[160px] flex items-center justify-center text-slate-400 text-xs">
                    Generating QR...
                  </div>
                )}
                <div className="mt-2 text-center">
                  <p className="text-[10px] font-mono text-slate-600 font-semibold truncate max-w-[180px]">
                    Room: {roomId}
                  </p>
                </div>
              </div>

              {/* Copy Direct URL */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-300 font-medium flex items-center justify-between">
                  <span>Direct Share URL:</span>
                  <span className="text-[10px] text-cyan-400 font-mono font-semibold">
                    {activeBaseUrl.startsWith('https') ? '🔒 HTTPS' : 'HTTP'}
                  </span>
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={shareableUrl}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-300 select-all focus:outline-none"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Done' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Custom Domain Override */}
              <div className="space-y-1 pt-2 border-t border-slate-800/80">
                <label className="text-[11px] text-slate-400 font-medium">Domain Override (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. https://your-domain.app"
                  value={customHost}
                  onChange={(e) => setCustomHost(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-start gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Encrypted peer-to-peer WebRTC stream. Video does not go through third-party servers.
              </span>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
