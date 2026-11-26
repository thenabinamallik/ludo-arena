import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown, History, Home, RotateCcw, Trophy } from 'lucide-react';
import { COLOR_PALETTE } from '@ludo-arena/shared-types';
import { AvatarBadge } from '../components/AvatarBadge';
import { LayoutShell } from '../components/LayoutShell';
import { useArena } from '../hooks/useRoomSession';
import { getHostSession, getPlayerSession } from '../services/sessionStorage';
import { emitAck } from '../services/socketClient';

export function MatchResultsPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const { roomState, lastGameFinished } = useArena();
  const hostSession = getHostSession(roomId);
  const playerSession = getPlayerSession(roomId);

  // If host restarts for a rematch, route participants back automatically
  useEffect(() => {
    if (roomState?.match && roomState.match.status === 'playing') {
      if (hostSession) {
        navigate(`/host/${roomId}`);
      } else if (playerSession?.role === 'player') {
        navigate(`/play/${roomId}`);
      } else {
        navigate(`/spectate/${roomId}`);
      }
    }
  }, [roomState?.match?.status, hostSession, playerSession, roomId, navigate]);

  const players = roomState?.players ?? [];
  const rankings = roomState?.match?.rankings ?? lastGameFinished?.rankings ?? [];
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const ordered = rankings
    .map((id) => playerMap.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const winner = ordered[0] ?? null;
  const winnerPal = winner?.color ? COLOR_PALETTE[winner.color] : null;

  const handleRematch = async () => {
    if (!hostSession) return;
    await emitAck('game:restart', {
      roomId: roomId.toUpperCase(),
      hostToken: hostSession.hostToken,
    });
  };

  return (
    <LayoutShell>
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-3xl border border-amber-400/50 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 text-center space-y-4 shadow-2xl"
        >
          <div className="w-20 h-20 rounded-3xl bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center mx-auto">
            <Crown className="w-10 h-10 text-amber-300" />
          </div>
          <div className="text-xs font-bold uppercase tracking-widest text-amber-300">
            Match Complete • Room {roomId.toUpperCase()}
          </div>
          <h1 className="text-4xl font-black text-white">
            {roomState?.match?.winningTeamId !== null && roomState?.match?.winningTeamId !== undefined
              ? `Team ${roomState.match.winningTeamId + 1} Wins!`
              : winner
                ? `${winner.name} Wins!`
                : 'Match Finished!'}
          </h1>
          {winner && winnerPal && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-sm" style={{ backgroundColor: winnerPal.primary, color: winnerPal.textOnPrimary }}>
              <Trophy className="w-4 h-4" /> Champion ({winnerPal.name})
            </div>
          )}
        </motion.div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800 font-bold text-white flex items-center justify-between">
            <span>Final Leaderboard & Statistics</span>
            <span className="text-xs text-slate-400">
              {roomState?.match?.turnCount ?? 0} Turns
            </span>
          </div>
          <div className="divide-y divide-slate-800">
            {ordered.map((p, idx) => (
              <div key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${
                      idx === 0
                        ? 'bg-amber-400 text-slate-950'
                        : idx === 1
                          ? 'bg-slate-300 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <AvatarBadge avatar={p.avatar} color={p.color} size="sm" />
                  <div>
                    <div className="font-bold text-white">{p.name}</div>
                    <div className="text-xs text-slate-400">
                      Rolls: {p.stats.rolls} • Sixes: {p.stats.sixes} • Captures: {p.stats.captures}
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-300">
                  <div className="font-bold">{p.stats.pawnsHome}/4 Home</div>
                  <div className="text-slate-500">Captured {p.stats.capturedCount}×</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {hostSession && (
            <button
              type="button"
              onClick={() => void handleRematch()}
              className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black flex items-center gap-2 transition"
            >
              <RotateCcw className="w-5 h-5" /> Play Rematch
            </button>
          )}
          <Link
            to="/history"
            className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center gap-2"
          >
            <History className="w-5 h-5" /> Game History
          </Link>
          <Link
            to="/"
            className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center gap-2"
          >
            <Home className="w-5 h-5" /> Home
          </Link>
        </div>
      </div>
    </LayoutShell>
  );
}
