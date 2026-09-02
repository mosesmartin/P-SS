'use client';
import Link from 'next/link';
import { Cast, Smartphone, Monitor, ShieldCheck, Zap } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="w-full border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition-all duration-300 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Cast className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform duration-300" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight flex items-center gap-1.5 text-white">
              Cast<span className="text-cyan-400">QR</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                P2P Live
              </span>
            </span>
            <span className="text-[11px] text-slate-400 -mt-0.5">Real-time Mobile Screen Mirror</span>
          </div>
        </Link>

        <nav className="flex items-center gap-3">
          <Link
            href="/host"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700/60 hover:border-indigo-500/50 transition-all duration-200"
          >
            <Monitor className="w-4 h-4 text-indigo-400" />
            <span>Host Monitor</span>
          </Link>
          <Link
            href="/share"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white shadow-md shadow-indigo-600/20 transition-all duration-200"
          >
            <Smartphone className="w-4 h-4" />
            <span>Mobile Cast</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
