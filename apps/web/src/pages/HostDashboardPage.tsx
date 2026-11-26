import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  QrCode,
  RotateCcw,
  Settings,
  Square,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import {
  COLOR_PALETTE,
  type LanNetworkInfo,
  type PlayerColor,
} from '@ludo-arena/shared-types';
import { LudoBoard } from '../boards/LudoBoard';
import { AvatarBadge } from '../components/AvatarBadge';
import { DiceGraphic } from '../components/DiceGraphic';
import { LayoutShell } from '../components/LayoutShell';
import { useArena } from '../hooks/useRoomSession';
import { getHostSession } from '../services/sessionStorage';
import { emitAck, fetchQrInfo } from '../services/socketClient';

export function HostDashboardPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const { roomState, lastDiceEvent, recoverHost } = useArena();
  const hostSession = getHostSession(roomId);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [joinUrl, setJoinUrl] = useState<string>('');
  const [lanInfo, setLanInfo] = useState<LanNetworkInfo | null>(null);
  const [selectedIp, setSelectedIp] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const boardContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (hostSession && (!roomState || roomState.roomId !== roomId.toUpperCase())) {
      void recoverHost(roomId, hostSession.hostToken);
    }
  }, [roomId, hostSession, roomState, recoverHost]);

  useEffect(() => {
    void fetchQrInfo(roomId, selectedIp || undefined).then((res) => {
      if (res.ok) {
        if (res.qrDataUrl) setQrDataUrl(res.qrDataUrl);
        if (res.joinUrl) setJoinUrl(res.joinUrl);
        if (res.lanInfo) {
          setLanInfo(res.lanInfo);
          if (!selectedIp && res.lanInfo.primaryIp) {
            setSelectedIp(res.lanInfo.primaryIp);
          }
        }
      }
    });
  }, [roomId, selectedIp]);

  // Turn countdown ticker
  useEffect(() => {
    const match = roomState?.match;
    if (!match) {
      setSecondsLeft(0);
      return;
    }
    const update = () => {
      if (match.status === 'paused' && match.pausedRemainingTurnMs) {
        setSecondsLeft(Math.ceil(match.pausedRemainingTurnMs / 1000));
      } else if (match.status === 'playing' && match.turnExpiresAt) {
        setSecondsLeft(Math.max(0, Math.ceil((match.turnExpiresAt - Date.now()) / 1000)));
      } else {
        setSecondsLeft(0);
      }
    };
    update();
    const id = window.setInterval(update, 250);
    return () => clearInterval(id);
  }, [roomState?.match]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  if (!hostSession) {
    return (
      <LayoutShell>
        <div className="max-w-lg mx-auto p-10 text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Host Session Not Found</h1>
          <p className="text-slate-400 text-sm">
            No host token was found on this browser for room {roomId}.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to="/host/create"
              className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold text-sm"
            >
              Create New Room
            </Link>
            <Link
              to={`/board/${roomId}`}
              className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-sm"
            >
              View Public Board
            </Link>
          </div>
        </div>
      </LayoutShell>
    );
  }

  const hostToken = hostSession.hostToken;
  const match = roomState?.match ?? null;
  const players = roomState?.players ?? [];
  const activePlayer = players.find((p) => p.id === match?.activePlayerId) ?? null;

  const canStart =
    players.length >= 2 &&
    players.every((p) => p.color !== null && p.ready);

  const startDisabledReason =
    players.length < 2
      ? 'Need at least 2 players to start'
      : players.some((p) => !p.color)
        ? 'All players need an assigned colour'
        : players.some((p) => !p.ready)
          ? 'Waiting for all players to mark Ready'
          : '';

  const runHostAction = async (event: 'game:start' | 'game:pause' | 'game:resume' | 'game:restart' | 'game:end') => {
    setActionError(null);
    const res = await emitAck(event, { roomId, hostToken });
    if (!res.ok) {
      setActionError(res.error ?? 'Host action failed');
    }
  };

  const handleAssignColor = async (targetPlayerId: string, color: PlayerColor) => {
    setActionError(null);
    const res = await emitAck('player:assign_color', {
      roomId,
      hostToken,
      targetPlayerId,
      color,
    });
    if (!res.ok) setActionError(res.error ?? 'Could not assign colour');
  };

  const handleKick = async (targetPlayerId: string) => {
    setActionError(null);
    const res = await emitAck('player:kick', { roomId, hostToken, targetPlayerId });
    if (!res.ok) setActionError(res.error ?? 'Could not remove player');
  };

  const toggleColorMode = async () => {
    if (!roomState) return;
    const nextMode = roomState.colorMode === 'auto' ? 'manual' : 'auto';
    const res = await emitAck('room:update_rules', {
      roomId,
      hostToken,
      rules: {},
      colorMode: nextMode,
    });
    if (!res.ok) setActionError(res.error ?? 'Could not toggle colour mode');
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement && boardContainerRef.current) {
      await boardContainerRef.current.requestFullscreen();
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  };

  const copyJoinUrl = async () => {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <LayoutShell>
      <div className="max-w-[1440px] mx-auto px-4 py-5 space-y-5">
        {/* Top Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/70 bg-slate-900/80 px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-black tracking-widest text-sm">
              ROOM {roomId.toUpperCase()}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 font-semibold">
              {roomState?.playerCountMode ?? 4}-Player Board
            </span>
            {roomState?.rules.teamMode && (
              <span className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold">
                Team Mode
              </span>
            )}
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> {roomState?.spectators.length ?? 0} spectators
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!match ? (
              <>
                <Link
                  to={`/host/${roomId}/config`}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5"
                >
                  <Settings className="w-4 h-4" /> Rules
                </Link>
                <button
                  type="button"
                  disabled={!canStart}
                  onClick={() => void runHostAction('game:start')}
                  title={startDisabledReason}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-black flex items-center gap-1.5 transition"
                >
                  <Play className="w-4 h-4 fill-current" /> Start Match
                </button>
              </>
            ) : (
              <>
                {match.status === 'playing' ? (
                  <button
                    type="button"
                    onClick={() => void runHostAction('game:pause')}
                    className="px-3.5 py-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Pause className="w-4 h-4" /> Pause
                  </button>
                ) : match.status === 'paused' ? (
                  <button
                    type="button"
                    onClick={() => void runHostAction('game:resume')}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black flex items-center gap-1.5"
                  >
                    <Play className="w-4 h-4 fill-current" /> Resume
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate(`/results/${roomId}`)}
                    className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5"
                  >
                    <Trophy className="w-4 h-4" /> View Results
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void runHostAction('game:restart')}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" /> Restart
                </button>
                <button
                  type="button"
                  onClick={() => void runHostAction('game:end')}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-1.5"
                >
                  <Square className="w-4 h-4" /> End Match
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
            </button>
            <Link
              to={`/board/${roomId}`}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
            >
              TV Board
            </Link>
            <Link
              to={`/spectate/${roomId}`}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
            >
              Spectate View
            </Link>
          </div>
        </div>

        {actionError && (
          <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 px-4 py-2.5 text-sm text-rose-200">
            {actionError}
          </div>
        )}

        {/* Main Grid: Board Left/Center + Controls/QR/Players Right */}
        <div
          ref={boardContainerRef}
          className={`grid lg:grid-cols-12 gap-5 ${
            isFullscreen ? 'bg-slate-950 p-6 overflow-auto' : ''
          }`}
        >
          {/* Central Game Board */}
          <div className="lg:col-span-8 flex flex-col items-center justify-center rounded-3xl border border-slate-700/60 bg-slate-900/60 p-4 sm:p-6">
            {/* Active Turn Banner */}
            {match && (
              <div className="w-full max-w-[780px] mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-950/80 border border-slate-800 px-4 py-3">
                <div className="flex items-center gap-3">
                  {activePlayer ? (
                    <>
                      <AvatarBadge
                        avatar={activePlayer.avatar}
                        color={activePlayer.color}
                        size="sm"
                      />
                      <div>
                        <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                          {match.status === 'paused'
                            ? 'Match Paused'
                            : match.status === 'finished'
                              ? 'Match Complete'
                              : match.turnPhase === 'waiting_for_roll'
                                ? 'Waiting for Dice Roll'
                                : 'Select a Pawn'}
                        </div>
                        <div className="font-black text-white text-lg leading-tight">
                          {activePlayer.name}’s Turn
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="font-bold text-amber-300">Match Finished!</div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm font-mono font-bold text-slate-200 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>{secondsLeft}s</span>
                  </div>
                  <DiceGraphic
                    value={match.currentDiceValue ?? lastDiceEvent?.diceValue ?? null}
                    accentColor={activePlayer?.color ?? null}
                    size={54}
                  />
                </div>
              </div>
            )}

            <LudoBoard
              mode={roomState?.playerCountMode ?? 4}
              players={players}
              match={match}
              safeZoneMode={roomState?.rules.safeZoneMode ?? 'standard'}
            />
          </div>

          {/* Right Sidebar: QR Joining, Players & Feed */}
          <div className="lg:col-span-4 space-y-5">
            {/* QR Code & LAN Join Card */}
            {!match && (
              <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <QrCode className="w-5 h-5 text-amber-400" />
                    <h2>Scan to Join on Phone</h2>
                  </div>
                  {lanInfo && lanInfo.addresses.length > 1 && (
                    <select
                      value={selectedIp}
                      onChange={(e) => setSelectedIp(e.target.value)}
                      className="text-xs rounded-lg bg-slate-950 border border-slate-700 px-2 py-1 text-slate-200"
                    >
                      {lanInfo.addresses.map((a) => (
                        <option key={a.address} value={a.address}>
                          {a.name}: {a.address}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex flex-col items-center gap-3">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`Join room ${roomId}`}
                      className="w-48 h-48 rounded-2xl bg-white p-2 shadow-lg"
                    />
                  ) : (
                    <div className="w-48 h-48 rounded-2xl bg-slate-800 animate-pulse" />
                  )}

                  <div className="w-full flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2">
                    <span className="text-xs font-mono text-cyan-300 truncate flex-1 px-1">
                      {joinUrl || `Room: ${roomId}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyJoinUrl()}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white flex items-center gap-1 shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Player Management Panel */}
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-white">
                  <Users className="w-5 h-5 text-emerald-400" />
                  <h2>
                    Players ({players.length}/{roomState?.maxPlayers ?? 4})
                  </h2>
                </div>
                {!match && (
                  <button
                    type="button"
                    onClick={() => void toggleColorMode()}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                  >
                    Colour: {roomState?.colorMode === 'manual' ? 'Manual' : 'Auto'}
                  </button>
                )}
              </div>

              {!match && !canStart && (
                <div className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                  {startDisabledReason}
                </div>
              )}

              <div className="space-y-2.5">
                {players.length === 0 ? (
                  <div className="text-sm text-slate-400 py-4 text-center">
                    Waiting for players to scan the QR code or enter Room ID{' '}
                    <span className="font-mono font-bold text-amber-300">{roomId}</span>...
                  </div>
                ) : (
                  players.map((p) => {
                    const isTurn = match?.activePlayerId === p.id;
                    const pal = p.color ? COLOR_PALETTE[p.color] : null;
                    return (
                      <div
                        key={p.id}
                        className={`p-3 rounded-xl border transition flex items-center justify-between gap-2 ${
                          isTurn
                            ? 'bg-slate-800/90 border-amber-400 shadow-md'
                            : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AvatarBadge avatar={p.avatar} color={p.color} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  p.connected ? 'bg-emerald-400' : 'bg-rose-500'
                                }`}
                                title={p.connected ? 'Connected' : 'Disconnected'}
                              />
                              <span className="font-bold text-white text-sm truncate">
                                {p.name}
                              </span>
                              {roomState?.rules.teamMode && p.teamId !== null && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                                  T{p.teamId + 1}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-2">
                              {match ? (
                                <span>
                                  Home: {p.stats.pawnsHome}/4 • Captures: {p.stats.captures}
                                </span>
                              ) : p.ready ? (
                                <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                                  <CheckCircle2 className="w-3 h-3" /> Ready
                                </span>
                              ) : (
                                <span className="text-slate-400">In Lobby</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!match ? (
                            <select
                              value={p.color ?? ''}
                              onChange={(e) =>
                                void handleAssignColor(p.id, e.target.value as PlayerColor)
                              }
                              className="text-xs rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-white"
                            >
                              {!p.color && <option value="">Pick...</option>}
                              {(roomState?.availableColors ?? []).map((c) => {
                                const takenByOther = players.some(
                                  (other) => other.id !== p.id && other.color === c
                                );
                                return (
                                  <option key={c} value={c} disabled={takenByOther}>
                                    {COLOR_PALETTE[c].name}
                                    {takenByOther ? ' (Taken)' : ''}
                                  </option>
                                );
                              })}
                            </select>
                          ) : (
                            pal && (
                              <span
                                className="text-[11px] px-2 py-0.5 rounded-full font-bold"
                                style={{
                                  backgroundColor: pal.primary,
                                  color: pal.textOnPrimary,
                                }}
                              >
                                {pal.name}
                              </span>
                            )
                          )}
                          <button
                            type="button"
                            onClick={() => void handleKick(p.id)}
                            title="Remove player"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Live Match Notifications */}
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-5 space-y-3">
              <h2 className="font-bold text-white text-sm uppercase tracking-wider">
                Live Match Feed
              </h2>
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {(roomState?.notifications ?? []).slice(0, 12).map((n) => (
                  <div
                    key={n.id}
                    className="text-xs rounded-xl bg-slate-950/70 border border-slate-800/80 px-3 py-2 text-slate-300"
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
