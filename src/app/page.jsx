'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import { 
  Monitor, 
  Smartphone, 
  QrCode, 
  ShieldCheck, 
  Zap, 
  Radio, 
  Lock, 
  ArrowRight,
  Sparkles,
  Wifi,
  Video,
  CheckCircle2
} from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [manualRoomCode, setManualRoomCode] = useState('');

  const handleJoinByCode = (e) => {
    e.preventDefault();
    if (manualRoomCode.trim()) {
      router.push(`/share?room=${manualRoomCode.trim()}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col justify-center">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-6 animate-pulse-slow">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Next-Gen WebRTC Screen Mirroring</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
            Stream Mobile Screen to <br />
            <span className="gradient-text">Any Browser in Seconds</span>
          </h1>

          <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-8">
            Scan a dynamic QR code from your phone and mirror your screen in ultra-low latency. 
            No third-party apps, no plugins, completely peer-to-peer and encrypted.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/host"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-semibold flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all duration-300 group"
            >
              <Monitor className="w-5 h-5 text-cyan-200" />
              <span>Host a Session (Get QR Code)</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/share"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/80 hover:border-cyan-500/50 text-slate-200 font-semibold flex items-center justify-center gap-3 transition-all duration-300"
            >
              <Smartphone className="w-5 h-5 text-cyan-400" />
              <span>Open Mobile Sender</span>
            </Link>
          </div>
        </div>

        {/* 2 Main Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20 max-w-5xl mx-auto w-full">
          {/* Host Card */}
          <div className="glass-panel-glow rounded-2xl p-8 flex flex-col justify-between relative overflow-hidden group hover:border-indigo-500/60 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mb-6">
                <Monitor className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Desktop Host Monitor</h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Generate an instant QR code on your computer, view live mobile stream, take screenshots, and record mirror sessions directly in WebM.
              </p>

              <ul className="space-y-2.5 mb-8 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Dynamic QR Code with Auto-Detected Local Network IP</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Sub-second low latency WebRTC P2P streaming</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Built-in Stream Recording & Snapshot tools</span>
                </li>
              </ul>
            </div>

            <Link
              href="/host"
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-center flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 transition-all"
            >
              <QrCode className="w-4 h-4" />
              <span>Launch Host Display</span>
            </Link>
          </div>

          {/* Sender / Join Card */}
          <div className="glass-panel-glow rounded-2xl p-8 flex flex-col justify-between relative overflow-hidden group hover:border-cyan-500/60 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
            <div>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-6">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Mobile Sender / Presenter</h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Scan the QR code with your mobile camera or enter a room code manually to start casting your phone screen instantly.
              </p>

              <form onSubmit={handleJoinByCode} className="space-y-3 mb-6">
                <label className="text-xs text-slate-300 font-medium">Join with Room Code:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualRoomCode}
                    onChange={(e) => setManualRoomCode(e.target.value)}
                    placeholder="e.g. room_abc123"
                    className="flex-1 bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!manualRoomCode.trim()}
                    className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    Join
                  </button>
                </div>
              </form>
            </div>

            <Link
              href="/share"
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium text-center flex items-center justify-center gap-2 transition-all"
            >
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <span>Go to Sender Page</span>
            </Link>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="border-t border-slate-800/80 pt-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-12">
            How It Works (System Architecture)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-panel p-6 rounded-xl border border-slate-800 relative">
              <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Step 1</div>
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center mb-4">
                <QrCode className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-white text-base mb-1">Generate QR Code</h4>
              <p className="text-xs text-slate-400">
                Host opens dashboard. System creates a unique room and displays a high-res QR code with LAN/Public IP.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-xl border border-slate-800 relative">
              <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">Step 2</div>
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center mb-4">
                <Smartphone className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-white text-base mb-1">Scan & Connect</h4>
              <p className="text-xs text-slate-400">
                Mobile user scans the QR code. Mobile browser opens the link and connects to the Socket.io signaling server.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-xl border border-slate-800 relative">
              <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Step 3</div>
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-white text-base mb-1">User Consent</h4>
              <p className="text-xs text-slate-400">
                User taps "Start Share". Operating System prompts permission dialog to protect user security.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-xl border border-slate-800 relative">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Step 4</div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center mb-4">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-white text-base mb-1">Live WebRTC Stream</h4>
              <p className="text-xs text-slate-400">
                Direct P2P video stream is rendered on the Host monitor with ultra-low latency and crystal-clear quality.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        CastQR • Built with Next.js, Socket.io, WebRTC & Screen Capture API
      </footer>
    </div>
  );
}
