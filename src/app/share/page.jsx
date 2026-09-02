'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { io } from 'socket.io-client';
import Navbar from '../../components/Navbar';
import { createPeerConnection, STREAM_PRESETS } from '../../lib/webrtc';
import {
  Smartphone,
  Cast,
  ShieldCheck,
  Zap,
  Radio,
  StopCircle,
  Play,
  Settings2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Sliders,
  Volume2,
  Lock,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

function ShareContent() {
  const searchParams = useSearchParams();
  const roomQuery = searchParams.get('room') || '';

  const [roomId, setRoomId] = useState(roomQuery);
  const [joined, setJoined] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [qualityPreset, setQualityPreset] = useState('medium'); // high, medium, batterySaver
  const [includeAudio, setIncludeAudio] = useState(false);
  const [streamDuration, setStreamDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // connecting, ready, sharing, error
  const [isSecure, setIsSecure] = useState(true);

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSecure(window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    }
  }, []);

  // Update room from query param
  useEffect(() => {
    if (roomQuery) {
      setRoomId(roomQuery);
    }
  }, [roomQuery]);

  // Connect to Signaling Server & Join Room
  useEffect(() => {
    if (!roomId) return;

    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Sender] Connected with ID:', socket.id);
      socket.emit('join-room', { roomId, role: 'sender' });
      setJoined(true);
      setConnectionStatus('ready');
    });

    // Create RTCPeerConnection
    const pc = createPeerConnection(
      (candidate) => {
        socket.emit('ice-candidate', { roomId, candidate });
      },
      null, // Sender doesn't need to receive remote video
      (state) => {
        console.log('[Sender] Connection state:', state);
      }
    );
    pcRef.current = pc;

    // Receive Answer from Host
    socket.on('answer', async ({ answer }) => {
      try {
        console.log('[Sender] Received Answer from Host');
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error('[Sender] Failed to set remote answer:', err);
      }
    });

    // Receive ICE candidate from Host
    socket.on('ice-candidate', async ({ candidate }) => {
      try {
        if (candidate && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('[Sender] Failed to add ICE candidate:', err);
      }
    });

    return () => {
      stopScreenShare();
      socket.disconnect();
      pc.close();
    };
  }, [roomId]);

  // Timer logic for active streaming
  useEffect(() => {
    if (isSharing) {
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
  }, [isSharing]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start Screen Share action
  const startScreenShare = async () => {
    setErrorMsg('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error(
          'Screen Capture API is not supported on this browser or requires an HTTPS connection.'
        );
      }

      const preset = STREAM_PRESETS[qualityPreset] || STREAM_PRESETS.medium;
      const constraints = {
        video: preset.video,
        audio: includeAudio,
      };

      console.log('[Sender] Requesting display media with constraints:', constraints);
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      streamRef.current = stream;

      const pc = pcRef.current;
      const socket = socketRef.current;

      // Add media tracks to WebRTC PeerConnection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);

        // When user stops sharing from OS notification bar
        track.onended = () => {
          stopScreenShare();
        };
      });

      // Create WebRTC Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('offer', { roomId, offer });
      socket.emit('stream-status', { roomId, status: 'started' });

      setIsSharing(true);
      setConnectionStatus('sharing');
    } catch (err) {
      console.error('[Sender] Error starting screen share:', err);
      if (err.name === 'NotAllowedError') {
        setErrorMsg('Screen share permission was declined by user.');
      } else {
        setErrorMsg(err.message || 'Failed to initialize screen sharing.');
      }
    }
  };

  // Stop Screen Share action
  const stopScreenShare = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (socketRef.current && roomId) {
      socketRef.current.emit('stream-status', { roomId, status: 'stopped' });
    }
    setIsSharing(false);
    setConnectionStatus('ready');
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 max-w-lg mx-auto px-4 py-8 w-full flex flex-col justify-center">
        {/* Mobile Header Card */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 mb-6 text-center relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-cyan-500/20">
            <Smartphone className="w-7 h-7" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">Mobile Screen Presenter</h1>
          <p className="text-xs text-slate-400">
            Broadcast your phone screen to the Host Monitor live in HD.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Room: {roomId || 'None'}</span>
          </div>
        </div>

        {/* Insecure Context Warning (if not HTTPS / localhost) */}
        {!isSecure && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 text-xs text-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">HTTPS Security Requirement</p>
              <p className="leading-relaxed text-amber-300/90">
                Mobile browsers require an <strong>HTTPS connection</strong> (e.g. ngrok tunnel) or localhost to allow screen capture permissions.
              </p>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 mb-6 text-xs text-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Stream Error</p>
              <p className="leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Room Code Input (if not joined from QR) */}
        {!roomId && (
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 mb-6">
            <label className="block text-xs text-slate-300 font-medium mb-2">
              Enter Room ID from Host Monitor:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="e.g. cast_abc123"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        )}

        {/* Main Action Box */}
        {roomId && (
          <div className="glass-panel-glow rounded-2xl p-6 border border-slate-800 mb-6 flex flex-col items-center text-center">
            {!isSharing ? (
              <>
                <div className="w-full mb-6">
                  {/* Quality Settings Accordion */}
                  <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-800 text-left text-xs mb-4">
                    <div className="flex items-center justify-between text-slate-300 font-semibold mb-2">
                      <span className="flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                        Quality Preset
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase">{qualityPreset}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setQualityPreset('batterySaver')}
                        className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-all ${
                          qualityPreset === 'batterySaver'
                            ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        480p (Fast)
                      </button>
                      <button
                        type="button"
                        onClick={() => setQualityPreset('medium')}
                        className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-all ${
                          qualityPreset === 'medium'
                            ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        720p HD
                      </button>
                      <button
                        type="button"
                        onClick={() => setQualityPreset('high')}
                        className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-all ${
                          qualityPreset === 'high'
                            ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        1080p FHD
                      </button>
                    </div>

                    <label className="flex items-center gap-2 mt-3 cursor-pointer text-slate-300 select-none">
                      <input
                        type="checkbox"
                        checked={includeAudio}
                        onChange={(e) => setIncludeAudio(e.target.checked)}
                        className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <span>Include Device / System Audio (if supported)</span>
                    </label>
                  </div>
                </div>

                {/* Big Glowing Start Button */}
                <button
                  onClick={startScreenShare}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-indigo-500 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-lg flex items-center justify-center gap-3 shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 active:scale-95 transition-all duration-200"
                >
                  <Cast className="w-6 h-6 animate-pulse" />
                  <span>Start Sharing Screen</span>
                </button>

                <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
                  Your browser will ask for confirmation before capturing your screen. You can stop sharing at any time.
                </p>
              </>
            ) : (
              /* Active Broadcast View */
              <div className="w-full py-4 flex flex-col items-center">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-pulse">
                    <Cast className="w-10 h-10" />
                  </div>
                  <div className="absolute -inset-2 rounded-full border border-emerald-500/30 animate-ping"></div>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>BROADCASTING LIVE</span>
                </div>

                <div className="flex items-center gap-1.5 text-2xl font-mono font-bold text-white mb-6">
                  <Clock className="w-5 h-5 text-cyan-400" />
                  <span>{formatTime(streamDuration)}</span>
                </div>

                <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 text-xs text-slate-300 mb-6 text-left w-full space-y-2">
                  <p className="flex items-center gap-2 font-medium text-emerald-400">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    Screen is mirroring to Host Monitor!
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    💡 <strong>Tip:</strong> You can minimize this browser tab or switch to any other app on your phone. Your screen remains visible on the host screen.
                  </p>
                </div>

                <button
                  onClick={stopScreenShare}
                  className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
                >
                  <StopCircle className="w-5 h-5" />
                  <span>Stop Screen Sharing</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Security & Privacy Notice */}
        <div className="glass-panel p-4 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            <strong>Peer-to-Peer Encryption:</strong> All video streams flow directly between your phone and the host computer via WebRTC DTLS/SRTP encryption. No video data is recorded or stored on any intermediate server.
          </span>
        </div>
      </main>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Loading Presenter...</div>}>
      <ShareContent />
    </Suspense>
  );
}
