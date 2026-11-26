import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Maximize2, Minimize2 } from 'lucide-react';
import { LudoBoard } from '../boards/LudoBoard';
import { AvatarBadge } from '../components/AvatarBadge';
import { DiceGraphic } from '../components/DiceGraphic';
import { LayoutShell } from '../components/LayoutShell';
import { useArena } from '../hooks/useRoomSession';
import { getHostSession } from '../services/sessionStorage';

export function MainBoardPage() {
  const { roomId = '' } = useParams();
  const { roomState, lastDiceEvent, recoverHost, joinRoom } = useArena();
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!roomState) {
      const host = getHostSession(roomId);
      if (host) {
        void recoverHost(roomId, host.hostToken);
      } else {
        void joinRoom({ roomId, name: 'Board Display', spectator: true });
      }
    }
  }, [roomId, roomState, recoverHost, joinRoom]);

  useEffect(() => {
    const match = roomState?.match;
    if (!match) return;
    const tick = () => {
      if (match.status === 'playing' && match.turnExpiresAt) {
        setSecondsLeft(Math.max(0, Math.ceil((match.turnExpiresAt - Date.now()) / 1000)));
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => clearInterval(id);
  }, [roomState?.match]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const match = roomState?.match ?? null;
  const players = roomState?.players ?? [];
  const activePlayer = players.find((p) => p.id === match?.activePlayerId) ?? null;

  return (
    <LayoutShell hideNav>
      <div className="min-h-screen bg-slate-950 text-white p-4 flex flex-col items-center justify-between gap-4">
        <div className="w-full max-w-6xl flex items-center justify-between gap-4">
          <Link
            to={`/host/${roomId}`}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> Host Panel
          </Link>

          <div className="flex items-center gap-4">
            {activePlayer && (
              <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl">
                <AvatarBadge avatar={activePlayer.avatar} color={activePlayer.color} size="sm" />
                <div>
                  <div className="text-[10px] uppercase text-slate-400 font-bold">Active Turn</div>
                  <div className="font-black text-sm">{activePlayer.name}</div>
                </div>
                <div className="ml-2 flex items-center gap-1 text-xs font-mono text-amber-300">
                  <Clock className="w-3.5 h-3.5" /> {secondsLeft}s
                </div>
              </div>
            )}
            <DiceGraphic
              value={match?.currentDiceValue ?? lastDiceEvent?.diceValue ?? null}
              accentColor={activePlayer?.color ?? null}
              size={56}
            />
          </div>

          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-200 flex items-center gap-1.5"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            Fullscreen
          </button>
        </div>

        <div className="w-full max-w-[820px] flex-1 flex items-center justify-center">
          <LudoBoard
            mode={roomState?.playerCountMode ?? 4}
            players={players}
            match={match}
            safeZoneMode={roomState?.rules.safeZoneMode ?? 'standard'}
          />
        </div>

        {match?.lastEvent && (
          <div className="px-5 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-sm text-slate-200 font-medium">
            {match.lastEvent.message}
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
