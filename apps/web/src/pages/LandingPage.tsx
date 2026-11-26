import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Crown,
  Eye,
  Gamepad2,
  History,
  Monitor,
  QrCode,
  Settings,
  Smartphone,
  Terminal,
  Wifi,
} from 'lucide-react';
import { LayoutShell } from '../components/LayoutShell';
import { useArena } from '../hooks/useRoomSession';
import { getHostSession, getPlayerSession } from '../services/sessionStorage';
import { fetchLanInfo } from '../services/socketClient';
import type { LanNetworkInfo } from '@ludo-arena/shared-types';

export function LandingPage() {
  const { companionReachable, socketConnected } = useArena();
  const [lanInfo, setLanInfo] = useState<LanNetworkInfo | null>(null);
  const hostSession = getHostSession();
  const playerSession = getPlayerSession();

  useEffect(() => {
    void fetchLanInfo().then(setLanInfo);
  }, [companionReachable]);

  return (
    <LayoutShell>
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        {!companionReachable && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-bold text-amber-200">
                  Local Companion Service Not Detected
                </h2>
                <p className="text-sm text-amber-100/80 mt-1">
                  Browser JavaScript cannot open a raw LAN WebSocket server on its own. Start the
                  local companion coordinator on the host machine using{' '}
                  <code className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300">
                    npm run dev
                  </code>{' '}
                  or{' '}
                  <code className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300">
                    start-host.bat
                  </code>
                  .
                </p>
              </div>
            </div>
            <Link
              to="/troubleshoot"
              className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-semibold text-sm shrink-0 hover:bg-amber-300 transition"
            >
              Setup Guide
            </Link>
          </div>
        )}

        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-700/60 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-8 md:p-12 shadow-2xl">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
                <Wifi className="w-3.5 h-3.5" /> Offline Wi-Fi • Zero Internet Required
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
                Classic Ludo,{' '}
                <span className="bg-gradient-to-r from-amber-300 via-rose-400 to-cyan-300 bg-clip-text text-transparent">
                  Reinvented for Couch & LAN
                </span>
              </h1>
              <p className="text-slate-300 text-lg leading-relaxed">
                Put the main board on your laptop or TV. Up to <strong>8 players</strong> scan the
                QR code on their phones to roll their own dice and command their pawns in real time.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  to="/host/create"
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-extrabold shadow-lg shadow-amber-500/20 hover:brightness-105 transition flex items-center gap-2"
                >
                  <Monitor className="w-5 h-5" /> Host a Game
                </Link>
                <Link
                  to="/join"
                  className="px-6 py-3.5 rounded-2xl bg-emerald-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition flex items-center gap-2"
                >
                  <QrCode className="w-5 h-5" /> Join Room
                </Link>
                <Link
                  to="/join?spectator=1"
                  className="px-5 py-3.5 rounded-2xl bg-slate-800 text-slate-100 font-bold border border-slate-700 hover:bg-slate-700 transition flex items-center gap-2"
                >
                  <Eye className="w-5 h-5" /> Spectate
                </Link>
              </div>

              {(hostSession || playerSession) && (
                <div className="pt-2 flex flex-wrap gap-3">
                  {hostSession && (
                    <Link
                      to={`/host/${hostSession.roomId}`}
                      className="text-sm px-4 py-2 rounded-xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 hover:bg-indigo-500/30 transition font-semibold"
                    >
                      Resume Host Room ({hostSession.roomId}) →
                    </Link>
                  )}
                  {playerSession && (
                    <Link
                      to={
                        playerSession.role === 'spectator'
                          ? `/spectate/${playerSession.roomId}`
                          : `/play/${playerSession.roomId}`
                      }
                      className="text-sm px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/30 transition font-semibold"
                    >
                      Rejoin as {playerSession.name} ({playerSession.roomId}) →
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Companion & Architecture Card */}
            <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-white">Local Companion Coordinator</h3>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                    socketConnected && companionReachable
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {socketConnected && companionReachable ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>

              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Primary LAN IP</span>
                  <span className="font-mono font-semibold text-amber-300">
                    {lanInfo?.primaryIp ?? 'Detecting...'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Coordinator Port</span>
                  <span className="font-mono font-semibold text-white">
                    {lanInfo?.port ?? 3001}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Supported Modes</span>
                  <span className="font-semibold text-emerald-300">2, 4, 6 & 8 Players</span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 text-xs text-slate-300 space-y-1.5">
                <div className="font-semibold text-slate-200">How LAN Hosting Works:</div>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>Host device runs the companion coordinator on local Wi-Fi.</li>
                  <li>Host creates a 2, 4, 6, or 8-player room & displays the QR code.</li>
                  <li>Phones scan the QR code & control their own dice and pawns.</li>
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 space-y-2">
            <Crown className="w-6 h-6 text-amber-400" />
            <h3 className="font-bold text-white">2 / 4 / 6 / 8 Boards</h3>
            <p className="text-sm text-slate-400">
              Authentic 15×15 classic board for 2 & 4 players, plus custom symmetrical hexagonal &
              octagonal boards for 6 & 8 players.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 space-y-2">
            <Smartphone className="w-6 h-6 text-emerald-400" />
            <h3 className="font-bold text-white">Mobile Controllers</h3>
            <p className="text-sm text-slate-400">
              One-handed mobile interface with dedicated ROLL DICE button and 4 color-coded pawn
              selectors.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 space-y-2">
            <Gamepad2 className="w-6 h-6 text-cyan-400" />
            <h3 className="font-bold text-white">Server-Authoritative</h3>
            <p className="text-sm text-slate-400">
              Cryptographic server dice rolls, turn validation, duplicate protection, and SQLite
              match recovery.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 space-y-2">
            <div className="flex items-center gap-3">
              <Link to="/history" className="text-indigo-400 hover:underline flex items-center gap-1.5 font-bold text-sm">
                <History className="w-5 h-5" /> Match History
              </Link>
              <Link to="/settings" className="text-rose-400 hover:underline flex items-center gap-1.5 font-bold text-sm">
                <Settings className="w-5 h-5" /> Rules
              </Link>
            </div>
            <p className="text-sm text-slate-400 pt-1">
              Review past match leaderboards, configure custom rule presets, or test LAN
              diagnostics.
            </p>
          </div>
        </section>
      </div>
    </LayoutShell>
  );
}
