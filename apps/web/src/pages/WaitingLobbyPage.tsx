import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, LogOut } from 'lucide-react';
import { COLOR_PALETTE, type PlayerColor } from '@ludo-arena/shared-types';
import { AvatarBadge } from '../components/AvatarBadge';
import { LayoutShell } from '../components/LayoutShell';
import { useArena } from '../hooks/useRoomSession';
import { clearPlayerSession, getPlayerSession } from '../services/sessionStorage';
import { emitAck } from '../services/socketClient';

export function WaitingLobbyPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const { roomState, joinRoom } = useArena();
  const session = getPlayerSession(roomId);
  const [error, setError] = useState<string | null>(null);

  // Reconnect if page refreshed
  useEffect(() => {
    if (session && !roomState) {
      void joinRoom({
        roomId: session.roomId,
        name: session.name,
        avatar: session.avatar,
        sessionToken: session.sessionToken,
      });
    }
  }, [session, roomState, joinRoom]);

  // Auto-transition to Player Controller when host starts match
  useEffect(() => {
    if (roomState?.match && roomState.match.status !== 'lobby') {
      navigate(`/play/${roomId}`);
    }
  }, [roomState?.match, roomId, navigate]);

  if (!session) {
    return (
      <LayoutShell>
        <div className="max-w-md mx-auto p-8 text-center space-y-4">
          <h1 className="text-xl font-bold text-white">No Active Player Session</h1>
          <Link
            to={`/join/${roomId}`}
            className="inline-block px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold"
          >
            Join Room {roomId}
          </Link>
        </div>
      </LayoutShell>
    );
  }

  const me = roomState?.players.find((p) => p.id === session.participantId);
  const myColorPal = me?.color ? COLOR_PALETTE[me.color] : null;

  const handleSelectColor = async (color: PlayerColor) => {
    setError(null);
    const res = await emitAck('player:assign_color', {
      roomId,
      sessionToken: session.sessionToken,
      targetPlayerId: session.participantId,
      color,
    });
    if (!res.ok) setError(res.error ?? 'Could not select colour');
  };

  const handleToggleReady = async () => {
    if (!me) return;
    setError(null);
    const res = await emitAck('player:ready', {
      roomId,
      playerId: me.id,
      sessionToken: session.sessionToken,
      ready: !me.ready,
    });
    if (!res.ok) setError(res.error ?? 'Could not update readiness');
  };

  const handleLeave = async () => {
    await emitAck('room:leave', {
      roomId,
      participantId: session.participantId,
      sessionToken: session.sessionToken,
    });
    clearPlayerSession();
    navigate('/');
  };

  return (
    <LayoutShell>
      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
        <div
          className="rounded-3xl p-6 border shadow-xl space-y-4"
          style={{
            borderColor: myColorPal ? `${myColorPal.primary}80` : '#334155',
            background: myColorPal
              ? `linear-gradient(145deg, ${myColorPal.dark}55, #0F172A)`
              : '#0F172A',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AvatarBadge avatar={me?.avatar ?? session.avatar} color={me?.color ?? null} size="lg" />
              <div>
                <div className="text-xs font-mono text-amber-300 font-bold">
                  ROOM {roomId.toUpperCase()}
                </div>
                <h1 className="text-2xl font-black text-white">{me?.name ?? session.name}</h1>
                <div className="text-xs text-slate-300">
                  {myColorPal ? `Colour: ${myColorPal.name}` : 'No colour selected yet'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleLeave()}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 transition"
              title="Leave room"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-500/20 border border-rose-400/40 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}

          {roomState?.colorMode === 'manual' && (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase text-slate-300">
                Choose Your Colour
              </div>
              <div className="flex flex-wrap gap-2">
                {roomState.availableColors.map((c) => {
                  const takenByOther = roomState.players.some(
                    (p) => p.id !== me?.id && p.color === c
                  );
                  const isMine = me?.color === c;
                  const pal = COLOR_PALETTE[c];
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={takenByOther}
                      onClick={() => void handleSelectColor(c)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                        takenByOther
                          ? 'opacity-30 cursor-not-allowed border-slate-700'
                          : isMine
                            ? 'border-white ring-2 ring-white/70'
                            : 'border-white/25'
                      }`}
                      style={{
                        backgroundColor: pal.primary,
                        color: pal.textOnPrimary,
                      }}
                    >
                      {pal.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleToggleReady()}
            className={`w-full py-4 rounded-2xl font-black text-lg transition flex items-center justify-center gap-2 ${
              me?.ready
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25'
                : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            {me?.ready ? 'READY! Waiting for Host...' : 'TAP TO READY UP'}
          </button>
        </div>

        {/* Lobby Players List */}
        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-5 space-y-3">
          <div className="flex items-center justify-between text-sm font-bold text-white">
            <span>
              Players in Lobby ({roomState?.players.length ?? 0}/{roomState?.maxPlayers ?? 4})
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Host starts match
            </span>
          </div>
          <div className="space-y-2">
            {(roomState?.players ?? []).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800"
              >
                <div className="flex items-center gap-2.5">
                  <AvatarBadge avatar={p.avatar} color={p.color} size="sm" />
                  <span className="font-bold text-sm text-white">{p.name}</span>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    p.ready
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {p.ready ? 'Ready' : 'Waiting'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </LayoutShell>
  );
}
