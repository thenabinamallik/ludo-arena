import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Eye, Trophy } from 'lucide-react';
import { COLOR_PALETTE } from '@ludo-arena/shared-types';
import { LudoBoard } from '../boards/LudoBoard';
import { AvatarBadge } from '../components/AvatarBadge';
import { DiceGraphic } from '../components/DiceGraphic';
import { LayoutShell } from '../components/LayoutShell';
import { useArena } from '../hooks/useRoomSession';
import { getPlayerSession } from '../services/sessionStorage';

export function SpectatorPage() {
  const { roomId = '' } = useParams();
  const { roomState, lastDiceEvent, joinRoom } = useArena();

  useEffect(() => {
    if (!roomState) {
      const existing = getPlayerSession(roomId);
      void joinRoom({
        roomId: roomId.toUpperCase(),
        name: existing?.name ?? 'Spectator',
        spectator: true,
        sessionToken: existing?.role === 'spectator' ? existing.sessionToken : undefined,
      });
    }
  }, [roomId, roomState, joinRoom]);

  const match = roomState?.match ?? null;
  const players = roomState?.players ?? [];
  const activePlayer = players.find((p) => p.id === match?.activePlayerId) ?? null;

  const sortedLeaderboard = [...players].sort(
    (a, b) => b.stats.pawnsHome - a.stats.pawnsHome || b.stats.captures - a.stats.captures
  );

  return (
    <LayoutShell>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/70 bg-slate-900/80 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center gap-1.5">
              <Eye className="w-4 h-4" /> SPECTATOR MODE
            </span>
            <span className="font-mono font-bold text-amber-300">ROOM {roomId.toUpperCase()}</span>
          </div>
          {match?.status === 'finished' && (
            <Link
              to={`/results/${roomId}`}
              className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5"
            >
              <Trophy className="w-4 h-4" /> Match Results
            </Link>
          )}
        </div>

        <div className="grid lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 rounded-3xl border border-slate-700/60 bg-slate-900/60 p-4 sm:p-6 flex flex-col items-center">
            {match && (
              <div className="w-full max-w-[780px] mb-4 flex items-center justify-between rounded-2xl bg-slate-950/80 border border-slate-800 px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  {activePlayer && (
                    <AvatarBadge avatar={activePlayer.avatar} color={activePlayer.color} size="sm" />
                  )}
                  <span className="font-bold text-white">
                    {activePlayer ? `${activePlayer.name}’s Turn` : 'Match Finished'}
                  </span>
                </div>
                <DiceGraphic
                  value={match.currentDiceValue ?? lastDiceEvent?.diceValue ?? null}
                  accentColor={activePlayer?.color ?? null}
                  size={48}
                />
              </div>
            )}
            <LudoBoard
              mode={roomState?.playerCountMode ?? 4}
              players={players}
              match={match}
              safeZoneMode={roomState?.rules.safeZoneMode ?? 'standard'}
            />
          </div>

          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-5 space-y-3">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" /> Live Leaderboard
              </h2>
              <div className="space-y-2">
                {sortedLeaderboard.map((p, idx) => {
                  const pal = p.color ? COLOR_PALETTE[p.color] : null;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs text-slate-400 w-4">#{idx + 1}</span>
                        <AvatarBadge avatar={p.avatar} color={p.color} size="sm" />
                        <div>
                          <div className="font-bold text-sm text-white">{p.name}</div>
                          <div className="text-xs text-slate-400">
                            {p.stats.pawnsHome}/4 Home • {p.stats.captures} Captures
                          </div>
                        </div>
                      </div>
                      {pal && (
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: pal.primary, color: pal.textOnPrimary }}
                        >
                          {pal.name}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-5 space-y-2">
              <h3 className="text-xs font-bold uppercase text-slate-400">Match Events</h3>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {(roomState?.notifications ?? []).slice(0, 12).map((n) => (
                  <div
                    key={n.id}
                    className="text-xs rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-2 text-slate-300"
                  >
                    {n.message}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </LayoutShell>
  );
}
