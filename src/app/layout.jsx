import './globals.css';

export const metadata = {
  title: 'CastQR - Realtime Mobile Screen Mirroring',
  description: 'Instantly mirror mobile screens to desktop via QR code and WebRTC',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#080c14] text-slate-100 min-h-screen flex flex-col selection:bg-indigo-500 selection:text-white antialiased">
        <div className="fixed inset-0 pointer-events-none -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.18),rgba(255,255,255,0))]"></div>
        <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-slow"></div>
        <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-slow"></div>
        {children}
      </body>
    </html>
  );
}
