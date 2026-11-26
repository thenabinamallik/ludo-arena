import { useEffect, useState } from 'react';
import { Clock, Crown, History, Trash2 } from 'lucide-react';
import { COLOR_PALETTE, type MatchHistoryRecord } from '@ludo-arena/shared-types';
import { LayoutShell } from '../components/LayoutShell';
import { clearMatchHistoryApi, fetchMatchHistory } from '../services/socketClient';

export function GameHistoryPage() {
  const [records, setRecords] = useState<MatchHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await fetchMatchHistory();
    setRecords(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleClear = async () => {
    await clearMatchHistoryApi();
    setRecords([]);
  };

  return (
    <LayoutShell>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <History className="w-7 h-7 text-indigo-400" />
            <div>
              <h1 className="text-3xl font-black text-white">Local Match History</h1>
              <p className="text-sm text-slate-400">
                Completed LAN matches persisted in local SQLite storage.
              </p>
            </div>
          </div>
          {records.length > 0 && (
            <button
              type="button"
              onClick={() => void handleClear()}
              className="px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 hover:bg-rose-500/25"
            >
              <Trash2 className="w-4 h-4" /> Clear History
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-slate-400 py-10 text-center">Loading history...</div>
        ) : records.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center text-slate-400">
            No completed matches recorded yet. Finish a match to see leaderboards and stats here!
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((rec) => {
              const winPal = rec.winnerColor ? COLOR_PALETTE[rec.winnerColor] : null;
              const mins = Math.max(1, Math.round(rec.durationMs / 60000));
              return (
                <div
                  key={rec.id}
                  className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Crown className="w-6 h-6 text-amber-400" />
                      <div>
                        <div className="font-black text-white text-lg">
                          {rec.teamMode && rec.winningTeamId !== null
                            ? `Team ${rec.winningTeamId + 1} Won`
                            : `${rec.winnerName ?? 'Unknown'} Won`}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <span>Room {rec.roomId}</span>
                          <span>•</span>
                          <span>{rec.playerCountMode}P Board</span>
                          <span>•</span>
                          <span>{rec.turnCount} Turns</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {mins}m
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {winPal && (
                        <span
                          className="text-xs font-bold px-3 py-1 rounded-full"
                          style={{ backgroundColor: winPal.primary, color: winPal.textOnPrimary }}
                        >
                          {winPal.name}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {new Date(rec.finishedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {rec.rankings.map((r) => (
                      <div
                        key={r.playerId}
                        className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-white">
                            #{r.rank} {r.name}
                          </div>
                          <div className="text-slate-400">
                            {r.stats.pawnsHome}/4 Home • {r.stats.captures} Cap
                          </div>
                        </div>
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLOR_PALETTE[r.color].primary }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
