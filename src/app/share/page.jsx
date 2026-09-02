'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { io } from 'socket.io-client';
import Navbar from '../../components/Navbar';
import { createPeerConnection } from '../../lib/webrtc';
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
  Camera,
  Info,
  Layers,
  HelpCircle
} from 'lucide-react';

function ShareContent() {
  const searchParams = useSearchParams();
  const roomQuery = searchParams.get('room') || '';

  const [roomId, setRoomId] = useState(roomQuery);
  const [joined, setJoined] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [streamType, setStreamType] = useState('screen'); // 'screen' or 'camera'
  const [cameraFacing, setCameraFacing] = useState('environment'); // 'user' or 'environment'
  const [errorMsg, setErrorMsg] = useState('');
  const [includeAudio, setIncludeAudio] = useState(false);
  const [streamDuration, setStreamDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [hasScreenApi, setHasScreenApi] = useState(true);
  const [browserInfo, setBrowserInfo] = useState('');

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent;
      const isIOS = /iPhone|iPad|iPod/i.test(ua);
      setIsIOSDevice(isIOS);
      setBrowserInfo(ua);

      const hasDisplayMedia = !!(navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function');
      setHasScreenApi(hasDisplayMedia);
      
      if (!hasDisplayMedia && isIOS) {
        setStreamType('camera');
      }
    }
  }, []);

  useEffect(() => {
    if (roomQuery) {
      setRoomId(roomQuery);
    }
  }, [roomQuery]);

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

    const pc = createPeerConnection(
      (candidate) => {
        socket.emit('ice-candidate', { roomId, candidate });
      },
      null,
      (state) => {
        console.log('[Sender] Connection state:', state);
      }
    );
    pcRef.current = pc;

    socket.on('answer', async ({ answer }) => {
      try {
        console.log('[Sender] Received Answer from Host');
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error('[Sender] Failed to set remote answer:', err);
      }
    });

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
      stopStream();
      socket.disconnect();
      pc.close();
    };
  }, [roomId]);

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

  // Start Stream (Screen or Camera)
  const startStream = async (type = streamType) => {
    setErrorMsg('');
    try {
      let stream = null;

      if (type === 'screen') {
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
          throw new Error(
            'getDisplayMedia is not available on this mobile browser. Try Android Chrome or switch to Live Camera mode below!'
          );
        }

        // Mobile-safe clean constraints (avoids OverconstrainedError on portrait screens)
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: includeAudio,
          });
        } catch (constraintErr) {
          console.warn('[Sender] Retrying with basic video constraint...', constraintErr);
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        }
      } else {
        // Camera streaming mode (Works on all Android & iOS devices)
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: cameraFacing,
          },
          audio: includeAudio,
        });
      }

      if (!stream) {
        throw new Error('No media stream returned from device.');
      }

      streamRef.current = stream;
      const pc = pcRef.current;
      const socket = socketRef.current;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        track.onended = () => {
          stopStream();
        };
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('offer', { roomId, offer });
      socket.emit('stream-status', { roomId, status: 'started' });

      setIsSharing(true);
      setConnectionStatus('sharing');
    } catch (err) {
      console.error('[Sender] Error starting stream:', err);
      if (err.name === 'NotAllowedError') {
        setErrorMsg('Screen/Camera permission was cancelled by user.');
      } else if (err.name === 'OverconstrainedError') {
        setErrorMsg('Device display constraints mismatch. Retrying in basic mode...');
      } else {
        setErrorMsg(`${err.name || 'Error'}: ${err.message || 'Failed to start stream'}`);
      }
    }
  };

  const stopStream = () => {
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

          <h1 className="text-2xl font-bold text-white mb-1">Mobile Presenter</h1>
          <p className="text-xs text-slate-400">
            Broadcast live from your phone to the Host Monitor in real-time.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Room: {roomId || 'None'}</span>
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 mb-6 text-xs text-rose-200 flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">Broadcast Notice</p>
                <p className="leading-relaxed">{errorMsg}</p>
              </div>
            </div>

            {streamType === 'screen' && (
              <button
                type="button"
                onClick={() => {
                  setStreamType('camera');
                  startStream('camera');
                }}
                className="mt-2 py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-center transition-colors"
              >
                Switch to Live Camera Stream (100% Supported)
              </button>
            )}
          </div>
        )}

        {/* Room Code Input */}
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
                <div className="w-full mb-6 space-y-4">
                  {/* Stream Mode Switcher */}
                  <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 text-left text-xs">
                    <span className="text-slate-400 font-medium block mb-2">Choose Broadcast Mode:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStreamType('screen');
                          setErrorMsg('');
                        }}
                        className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-2 font-medium transition-all ${
                          streamType === 'screen'
                            ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md shadow-indigo-500/20'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <Cast className="w-4 h-4 text-cyan-400" />
                        <span>Screen Mirror</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setStreamType('camera');
                          setErrorMsg('');
                        }}
                        className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-2 font-medium transition-all ${
                          streamType === 'camera'
                            ? 'bg-cyan-600/30 border-cyan-500 text-white shadow-md shadow-cyan-500/20'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <Camera className="w-4 h-4 text-emerald-400" />
                        <span>Live Camera</span>
                      </button>
                    </div>

                    {streamType === 'camera' && (
                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-300 pt-2 border-t border-slate-800/80">
                        <span>Select Camera:</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setCameraFacing('environment')}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                              cameraFacing === 'environment'
                                ? 'bg-cyan-600 text-white border-cyan-500'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            Back Lens
                          </button>
                          <button
                            type="button"
                            onClick={() => setCameraFacing('user')}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                              cameraFacing === 'user'
                                ? 'bg-cyan-600 text-white border-cyan-500'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            Front Lens
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Audio Toggle */}
                  <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 text-left text-xs">
                    <label className="flex items-center gap-2.5 cursor-pointer text-slate-300 select-none">
                      <input
                        type="checkbox"
                        checked={includeAudio}
                        onChange={(e) => setIncludeAudio(e.target.checked)}
                        className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <span>Include Audio Stream (Microphone / System)</span>
                    </label>
                  </div>
                </div>

                {/* Main Action Button */}
                <button
                  onClick={() => startStream(streamType)}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-indigo-500 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-lg flex items-center justify-center gap-3 shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 active:scale-95 transition-all duration-200"
                >
                  {streamType === 'screen' ? (
                    <>
                      <Cast className="w-6 h-6 animate-pulse" />
                      <span>Start Screen Mirroring</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-6 h-6 animate-pulse" />
                      <span>Start Camera Broadcast</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
                  {streamType === 'screen'
                    ? 'Android will show a system dialog: Tap "Start now" to mirror full screen.'
                    : 'Your browser will prompt for camera access.'}
                </p>
              </>
            ) : (
              /* Active Broadcast View */
              <div className="w-full py-4 flex flex-col items-center">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-pulse">
                    {streamType === 'screen' ? <Cast className="w-10 h-10" /> : <Camera className="w-10 h-10" />}
                  </div>
                  <div className="absolute -inset-2 rounded-full border border-emerald-500/30 animate-ping"></div>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>LIVE ({streamType === 'screen' ? 'SCREEN MIRROR' : 'CAMERA'})</span>
                </div>

                <div className="flex items-center gap-1.5 text-2xl font-mono font-bold text-white mb-6">
                  <Clock className="w-5 h-5 text-cyan-400" />
                  <span>{formatTime(streamDuration)}</span>
                </div>

                <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 text-xs text-slate-300 mb-6 text-left w-full space-y-2">
                  <p className="flex items-center gap-2 font-medium text-emerald-400">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    Stream is actively playing on Host Monitor!
                  </p>
                </div>

                <button
                  onClick={stopStream}
                  className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
                >
                  <StopCircle className="w-5 h-5" />
                  <span>Stop Stream</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Security / Help Notice */}
        <div className="glass-panel p-4 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            <strong>P2P Direct WebRTC:</strong> Peer-to-peer encrypted media streaming directly to host display.
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
