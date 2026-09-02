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

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent;
      const isIOS = /iPhone|iPad|iPod/i.test(ua);
      setIsIOSDevice(isIOS);

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
        if (state === 'connected') {
          setConnectionStatus('sharing');
        }
      }
    );
    pcRef.current = pc;

    socket.on('answer', async ({ answer }) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        while (iceCandidatesQueueRef.current.length > 0) {
          const queuedCandidate = iceCandidatesQueueRef.current.shift();
          try {
            await pc.addIceCandidate(new RTCIceCandidate(queuedCandidate));
          } catch (iceErr) {
            console.warn('[Sender] Failed adding queued candidate:', iceErr);
          }
        }
      } catch (err) {
        console.error('[Sender] Failed setting remote answer:', err);
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
        console.error('[Sender] Failed adding candidate:', err);
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

  const startStream = async (type = streamType) => {
    setErrorMsg('');
    try {
      let stream = null;

      if (type === 'screen') {
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
          throw new Error('getDisplayMedia is not available on this browser.');
        }

        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: 'always' },
            audio: includeAudio,
          });
        } catch (constraintErr) {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraFacing },
          audio: includeAudio,
        });
      }

      if (!stream) {
        throw new Error('No media stream available.');
      }

      streamRef.current = stream;
      const pc = pcRef.current;
      const socket = socketRef.current;

      const senders = pc.getSenders();
      senders.forEach((sender) => pc.removeTrack(sender));

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
        setErrorMsg('Permission was cancelled by user.');
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
    <div className="flex flex-col min-h-screen bg-[#060911] text-slate-100 selection:bg-indigo-500 selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto px-4 py-6 w-full flex flex-col justify-center">
        {/* Compact Presenter Header */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800/80 mb-4 text-center relative overflow-hidden">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h1 className="text-base font-bold text-white leading-tight">Mobile Presenter</h1>
              <p className="text-[11px] text-slate-400">Broadcasting to Host Screen</p>
            </div>
            <div className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-[11px] font-mono text-slate-300">
              <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
              <span>{roomId ? roomId : 'None'}</span>
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 mb-4 text-xs text-rose-200 flex flex-col gap-1.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[11px]">Notice</p>
                <p className="leading-tight text-[11px]">{errorMsg}</p>
              </div>
            </div>

            {streamType === 'screen' && (
              <button
                type="button"
                onClick={() => {
                  setStreamType('camera');
                  startStream('camera');
                }}
                className="mt-1 py-1.5 px-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-center text-xs transition-colors"
              >
                Switch to Live Camera Stream (100% Supported)
              </button>
            )}
          </div>
        )}

        {/* Room Code Input (if needed) */}
        {!roomId && (
          <div className="glass-panel rounded-2xl p-4 border border-slate-800 mb-4">
            <label className="block text-xs text-slate-300 font-medium mb-1.5">
              Enter Room ID from Host Screen:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="e.g. cast_abc123"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        )}

        {/* Main Action Box */}
        {roomId && (
          <div className="glass-panel-glow rounded-2xl p-5 border border-slate-800 mb-4 flex flex-col items-center text-center shadow-xl">
            {!isSharing ? (
              <>
                <div className="w-full mb-4 space-y-3">
                  {/* Mode Switcher */}
                  <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-800 text-left text-xs">
                    <span className="text-slate-400 text-[11px] font-medium block mb-1.5">Broadcast Source:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setStreamType('screen');
                          setErrorMsg('');
                        }}
                        className={`py-2 px-2.5 rounded-lg border flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
                          streamType === 'screen'
                            ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <Cast className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Screen Share</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setStreamType('camera');
                          setErrorMsg('');
                        }}
                        className={`py-2 px-2.5 rounded-lg border flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
                          streamType === 'camera'
                            ? 'bg-cyan-600/30 border-cyan-500 text-white shadow-sm shadow-cyan-500/20'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Live Camera</span>
                      </button>
                    </div>

                    {streamType === 'camera' && (
                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-300 pt-2 border-t border-slate-800">
                        <span>Camera Lens:</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setCameraFacing('environment')}
                            className={`px-2 py-0.5 rounded-md border text-[10px] font-medium ${
                              cameraFacing === 'environment'
                                ? 'bg-cyan-600 text-white border-cyan-500'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            onClick={() => setCameraFacing('user')}
                            className={`px-2 py-0.5 rounded-md border text-[10px] font-medium ${
                              cameraFacing === 'user'
                                ? 'bg-cyan-600 text-white border-cyan-500'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            Front
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Audio Toggle */}
                  <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-800 text-left text-xs">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-[11px] select-none">
                      <input
                        type="checkbox"
                        checked={includeAudio}
                        onChange={(e) => setIncludeAudio(e.target.checked)}
                        className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <span>Include Audio Stream (Mic / System Audio)</span>
                    </label>
                  </div>
                </div>

                {/* Main Action Button */}
                <button
                  onClick={() => startStream(streamType)}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-indigo-500 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-base flex items-center justify-center gap-2.5 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 active:scale-95 transition-all duration-200"
                >
                  {streamType === 'screen' ? (
                    <>
                      <Cast className="w-5 h-5 animate-pulse" />
                      <span>Start Screen Share</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-5 h-5 animate-pulse" />
                      <span>Start Camera Broadcast</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              /* Active Broadcast View */
              <div className="w-full py-2 flex flex-col items-center">
                <div className="relative mb-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-pulse">
                    {streamType === 'screen' ? <Cast className="w-8 h-8" /> : <Camera className="w-8 h-8" />}
                  </div>
                  <div className="absolute -inset-1.5 rounded-full border border-emerald-500/30 animate-ping"></div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>BROADCASTING LIVE</span>
                </div>

                <div className="flex items-center gap-1.5 text-xl font-mono font-bold text-white mb-4">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>{formatTime(streamDuration)}</span>
                </div>

                <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800 text-xs text-slate-300 mb-4 text-left w-full">
                  <p className="flex items-center gap-1.5 font-medium text-emerald-400 text-[11px]">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                    Stream is active on Host Display!
                  </p>
                </div>

                <button
                  onClick={stopStream}
                  className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-rose-600/30 active:scale-95 transition-all"
                >
                  <StopCircle className="w-4 h-4" />
                  <span>Stop Broadcast</span>
                </button>
              </div>
            )}
          </div>
        )}

        <div className="glass-panel p-3 rounded-xl border border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-center gap-1.5 text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Encrypted WebRTC P2P direct media stream.</span>
        </div>
      </main>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400 text-xs">Loading Presenter...</div>}>
      <ShareContent />
    </Suspense>
  );
}
