import { Link, useLocation } from 'react-router-dom';
import { Crown, History, HelpCircle, Settings, Wifi, WifiOff } from 'lucide-react';
import { useArena } from '../hooks/useRoomSession';
import { ThemeAudioControls } from './ThemeAudioControls';

export function LayoutShell({
  children,
  hideNav = false,
}: {
  children: React.ReactNode;
  hideNav?: boolean;
}) {
  const { socketConnected, companionReachable } = useArena();
  const location = useLocation();

  if (hideNav) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80 text-slate-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 font-extrabold tracking-tight text-lg">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-rose-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Crown className="w-5 h-5 text-white" />
            </span>
            <span>
              LUDO <span className="text-amber-400">ARENA</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link
              to="/host/create"
              className={`px-3 py-1.5 rounded-lg transition ${
                location.pathname.startsWith('/host')
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Host Game
            </Link>
            <Link
              to="/join"
              className={`px-3 py-1.5 rounded-lg transition ${
                location.pathname.startsWith('/join')
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Join Room
            </Link>
            <Link
              to="/history"
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                location.pathname === '/history'
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <History className="w-4 h-4" /> History
            </Link>
            <Link
              to="/settings"
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                location.pathname === '/settings'
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Settings className="w-4 h-4" /> Rules & Settings
            </Link>
            <Link
              to="/troubleshoot"
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                location.pathname === '/troubleshoot'
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <HelpCircle className="w-4 h-4" /> LAN Help
            </Link>
          </nav>

          <div className="flex items-center gap-2.5">
            <div
              className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
                socketConnected && companionReachable
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              }`}
            >
              {socketConnected && companionReachable ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">LAN Ready</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Companion Offline</span>
                </>
              )}
            </div>
            <ThemeAudioControls />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
