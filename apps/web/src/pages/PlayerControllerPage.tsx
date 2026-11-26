import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Clock,
  Dices,
  Home,
  LogOut,
  Sparkles,
  Swords,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { getBoardConfig } from '@ludo-arena/board-config';
import { COLOR_PALETTE, type PawnState } from '@ludo-arena/shared-types';
import { AvatarBadge } from '../components/AvatarBadge';
import { DiceGraphic } from '../components/DiceGraphic';
import { ThemeAudioControls } from '../components/ThemeAudioControls';
import { audioEngine } from '../services/audioEngine';
import { useArena } from '../hooks/useRoomSession';
import { clearPlayerSession, getPlayerSession } from '../services/sessionStorage';
import { emitAck } from '../services/socketClient';

function describePawnPosition(pawn: PawnState, mainTrackLength: number): string {
  if (pawn.zone === 'base') return 'In Base';
  if (pawn.zone === 'home') return 'Reached Home';
  if (pawn.zone === 'home_stretch') {
    return `Near Home (${(pawn.homeStretchIndex ?? 0) + 1}/5)`;
  }
  const pct = Math.min(99, Math.round(((pawn.progress + 1) / mainTrackLength) * 100));
  return `On Track (${pct}%)`;
}

export function PlayerControllerPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const { roomState, socketConnected, lastDiceEvent, joinRoom } = useArena();
  const session = getPlayerSession(roomId);

  const [rolling, setRolling] = useState(false);
  const [movingPawnId, setMovingPawnId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Automatic reconnection on mount or socket reconnect
  useEffect(() => {
    if (session && socketConnected && !roomState) {
      void joinRoom({
        roomId: session.roomId,
        name: session.name,
        avatar: session.avatar,
        sessionToken: session.sessionToken,
      });
    }
  }, [session, socketConnected, roomState, joinRoom]);

  // Redirect to lobby if host ended match back to lobby, or results when finished
  useEffect(() => {
    if (!roomState) return;
    if (!roomState.match) {
      navigate(`/lobby/${roomId}`);
    } else if (roomState.match.status === 'finished') {
      navigate(`/results/${roomId}`);
    }
  }, [roomState, roomId, navigate]);

  const match = roomState?.match ?? null;
  const players = roomState?.players ?? [];
  const me = players.find((p) => p.id === session?.participantId) ?? null;
  const activePlayer = players.find((p) => p.id === match?.activePlayerId) ?? null;
  const isMyTurn = Boolean(me && match && match.activePlayerId === me.id && match.status === 'playing');

  // Audio cue when turn lands on me
  useEffect(() => {
    if (isMyTurn && match?.turnPhase === 'waiting_for_roll') {
      audioEngine.playTurnAlert();
    }
  }, [isMyTurn, match?.turnPhase, match?.turnCount]);

  useEffect(() => {
    if (!match) return;
    const update = () => {
      if (match.status === 'paused' && match.pausedRemainingTurnMs) {
        setSecondsLeft(Math.ceil(match.pausedRemainingTurnMs / 1000));
      } else if (match.status === 'playing' && match.turnExpiresAt) {
        setSecondsLeft(Math.max(0, Math.ceil((match.turnExpiresAt - Date.now()) / 1000)));
      }
    };
    update();
    const id = window.setInterval(update, 250);
    return () => clearInterval(id);
  }, [match]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="space-y-4 max-w-sm">
          <h1 className="text-xl font-bold">Session Expired</h1>
          <Link
            to={`/join/${roomId}`}
            className="inline-block px-5 py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold"
          >
            Rejoin Room {roomId}
          </Link>
        </div>
      </div>
    );
  }

  const myColor = me?.color ?? 'blue';
  const pal = COLOR_PALETTE[myColor];
  const board = getBoardConfig(roomState?.playerCountMode ?? 4);

  const myPawns: PawnState[] = match
    ? Object.values(match.pawns)
        .filter((p) => p.playerId === session.participantId)
        .sort((a, b) => a.pawnNumber - b.pawnNumber)
    : [];

  const legalMoves = isMyTurn && match?.turnPhase === 'waiting_for_move' ? match.legalMoves : [];
  const legalMoveMap = new Map(legalMoves.map((m) => [m.pawnId, m]));

  const canRoll = isMyTurn && match?.turnPhase === 'waiting_for_roll' && !rolling;

  const handleRollDice = async () => {
    if (!canRoll || !match) return;
    setError(null);
    setRolling(true);
    const actionId = `roll-${match.version}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const res = await emitAck('dice:roll', {
      roomId: roomId.toUpperCase(),
      playerId: session.participantId,
      sessionToken: session.sessionToken,
      actionId,
      expectedVersion: match.version,
    });
    setRolling(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not roll dice');
    }
  };

  const handleMovePawn = async (pawnId: string) => {
    if (!isMyTurn || !match || match.turnPhase !== 'waiting_for_move' || movingPawnId) return;
    setError(null);
    setMovingPawnId(pawnId);
    const actionId = `move-${match.version}-${pawnId}-${Date.now()}`;
    const res = await emitAck('pawn:move', {
      roomId: roomId.toUpperCase(),
      playerId: session.participantId,
      sessionToken: session.sessionToken,
      pawnId,
      actionId,
      expectedVersion: match.version,
    });
    setMovingPawnId(null);
    if (!res.ok) {
      setError(res.error ?? 'Illegal move');
    }
  };

  const handleLeave = async () => {
    await emitAck('room:leave', {
      roomId: roomId.toUpperCase(),
      participantId: session.participantId,
      sessionToken: session.sessionToken,
    });
    clearPlayerSession();
    navigate('/');
  };

  return (
    <div
      className="min-h-screen flex flex-col justify-between p-4 max-w-md mx-auto gap-4"
      style={{
        background: `radial-gradient(circle at top, ${pal.primary}26 0%, transparent 55%)`,
      }}
    >
      {/* Top Player Identity Bar */}
      <header
        className="rounded-2xl p-3.5 border shadow-lg flex items-center justify-between gap-2"
        style={{
          borderColor: `${pal.primary}66`,
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <AvatarBadge avatar={me?.avatar ?? session.avatar} color={myColor} size="md" />
          <div className="min-w-0">
            <div className="font-black text-white text-base truncate">{me?.name ?? session.name}</div>
            <div className="flex items-center gap-2 text-xs">
              <span
                className="px-2 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: pal.primary, color: pal.textOnPrimary }}
              >
                {pal.name}
              </span>
              <span
                className={`flex items-center gap-1 font-semibold ${
                  socketConnected ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {socketConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {socketConnected ? 'Online' : 'Reconnecting'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <ThemeAudioControls />
          <button
            type="button"
            onClick={() => void handleLeave()}
            className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:text-rose-400"
            title="Leave match"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Turn Status & Dice Card */}
      <section className="rounded-3xl border border-slate-700/70 bg-slate-900/90 p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
              {match?.status === 'paused' ? 'Match Paused by Host' : 'Active Turn'}
            </div>
            <div
              className="text-xl font-black"
              style={{ color: isMyTurn ? pal.ring : '#FFFFFF' }}
            >
              {isMyTurn ? 'YOUR TURN!' : activePlayer ? `${activePlayer.name}’s Turn` : 'Starting...'}
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-sm font-bold text-amber-300">
            <Clock className="w-4 h-4" />
            <span>{secondsLeft}s</span>
          </div>
        </div>

        {/* Turn Progress Timer Bar */}
        <div className="h-2 rounded-full bg-slate-950 overflow-hidden">
          <div
            className="h-full transition-all duration-300 rounded-full"
            style={{
              width: `${Math.min(
                100,
                (secondsLeft / (roomState?.rules.turnTimeoutSeconds ?? 30)) * 100
              )}%`,
              backgroundColor: secondsLeft <= 5 ? '#F43F5E' : pal.primary,
            }}
          />
        </div>

        {/* Dice Display + Big Roll Button */}
        <div className="flex items-center justify-between gap-4 pt-1">
          <DiceGraphic
            value={match?.currentDiceValue ?? lastDiceEvent?.diceValue ?? null}
            rolling={rolling}
            accentColor={activePlayer?.color ?? myColor}
            size={80}
          />

          <motion.button
            whileTap={canRoll ? { scale: 0.95 } : undefined}
            type="button"
            disabled={!canRoll}
            onClick={() => void handleRollDice()}
            className="flex-1 py-5 px-5 rounded-2xl font-black text-xl tracking-wide shadow-xl transition flex items-center justify-center gap-2.5 disabled:opacity-35 disabled:cursor-not-allowed"
            style={{
              backgroundColor: canRoll ? pal.primary : '#1E293B',
              color: canRoll ? pal.textOnPrimary : '#94A3B8',
              boxShadow: canRoll ? `0 8px 25px ${pal.primary}55` : undefined,
            }}
          >
            <Dices className="w-7 h-7" />
            {rolling ? 'ROLLING...' : 'ROLL DICE'}
          </motion.button>
        </div>

        {/* Feedback Banner */}
        {match?.lastEvent && (
          <div className="rounded-xl bg-slate-950/80 border border-slate-800 px-3.5 py-2.5 text-xs font-medium text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{match.lastEvent.message}</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-rose-500/20 border border-rose-500/40 px-3.5 py-2 text-xs text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* Four Dedicated Pawn Controls */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Your Pawns ({pal.name} 1–4)
          </h2>
          {isMyTurn && match?.turnPhase === 'waiting_for_move' && (
            <span className="text-xs font-bold text-amber-300 animate-pulse">
              Tap a glowing pawn to move
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {myPawns.map((pawn) => {
            const moveOpt = legalMoveMap.get(pawn.id);
            const isLegal = Boolean(moveOpt) && !movingPawnId;
            const statusText = describePawnPosition(pawn, board.mainTrackLength);

            return (
              <motion.button
                key={pawn.id}
                whileTap={isLegal ? { scale: 0.96 } : undefined}
                type="button"
                disabled={!isLegal}
                onClick={() => void handleMovePawn(pawn.id)}
                className={`p-4 rounded-2xl border text-left transition relative overflow-hidden ${
                  isLegal
                    ? 'border-amber-300 shadow-lg ring-2 ring-amber-400/60'
                    : pawn.zone === 'home'
                      ? 'border-emerald-500/40 bg-emerald-950/30 opacity-85'
                      : 'border-slate-800 bg-slate-900/70 opacity-50 cursor-not-allowed'
                }`}
                style={{
                  backgroundColor: isLegal ? `${pal.primary}30` : undefined,
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="font-black text-base"
                    style={{ color: isLegal ? '#FFFFFF' : pal.ring }}
                  >
                    {pal.name.toUpperCase()} {pawn.pawnNumber}
                  </span>
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border border-white/40"
                    style={{ backgroundColor: pal.primary, color: pal.textOnPrimary }}
                  >
                    {pawn.pawnNumber}
                  </span>
                </div>

                <div className="text-xs text-slate-300 font-medium">{statusText}</div>

                {moveOpt && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {moveOpt.willCapture && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">
                        <Swords className="w-3 h-3" /> Capture!
                      </span>
                    )}
                    {moveOpt.willReachHome && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                        <Home className="w-3 h-3" /> Home!
                      </span>
                    )}
                    {!moveOpt.willCapture && !moveOpt.willReachHome && (
                      <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                        Legal Move
                      </span>
                    )}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </section>

      <footer className="text-center text-[11px] text-slate-500 pb-2">
        LUDO ARENA • Room {roomId.toUpperCase()} • Turn #{match?.turnCount ?? 1}
      </footer>
    </div>
  );
}
