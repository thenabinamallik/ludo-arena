import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, UserPlus } from 'lucide-react';
import {
  COLOR_PALETTE,
  PLAYER_AVATARS,
  type PlayerAvatar,
  type PlayerColor,
} from '@ludo-arena/shared-types';
import { AvatarBadge } from '../components/AvatarBadge';
import { LayoutShell } from '../components/LayoutShell';
import { useArena } from '../hooks/useRoomSession';
import { savePlayerSession } from '../services/sessionStorage';
import { fetchRoomSummary } from '../services/socketClient';

export function PlayerRegisterPage() {
  const { roomId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { joinRoom } = useArena();

  const isSpectator = searchParams.get('spectator') === '1';
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<PlayerAvatar>('crown');
  const [preferredColor, setPreferredColor] = useState<PlayerColor | undefined>(undefined);
  const [availableColors, setAvailableColors] = useState<PlayerColor[]>([]);
  const [takenColors, setTakenColors] = useState<string[]>([]);
  const [colorMode, setColorMode] = useState<'auto' | 'manual'>('auto');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetchRoomSummary(roomId).then((res) => {
      if (res.ok && res.room) {
        setAvailableColors(res.room.availableColors as PlayerColor[]);
        setTakenColors(res.room.takenColors);
        setColorMode(res.room.colorMode);
      }
    });
  }, [roomId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your display name.');
      return;
    }

    setSubmitting(true);
    setError(null);
    const res = await joinRoom({
      roomId: roomId.toUpperCase(),
      name: name.trim(),
      avatar,
      preferredColor: isSpectator ? undefined : preferredColor,
      spectator: isSpectator,
    });
    setSubmitting(false);

    if (!res.ok || !res.data) {
      setError(res.error ?? 'Failed to join room.');
      return;
    }

    savePlayerSession({
      roomId: res.data.roomId,
      participantId: res.data.participantId,
      sessionToken: res.data.sessionToken,
      role: res.data.role,
      name: name.trim(),
      avatar,
    });

    if (res.data.role === 'spectator') {
      navigate(`/spectate/${res.data.roomId}`);
    } else if (res.data.roomState.match && res.data.roomState.match.status !== 'lobby') {
      navigate(`/play/${res.data.roomId}`);
    } else {
      navigate(`/lobby/${res.data.roomId}`);
    }
  };

  return (
    <LayoutShell>
      <div className="max-w-md mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="text-center space-y-1">
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-slate-800 text-amber-300 font-bold">
              ROOM {roomId.toUpperCase()}
            </span>
            <h1 className="text-2xl font-black text-white pt-2">
              {isSpectator ? 'Spectator Registration' : 'Player Registration'}
            </h1>
            <p className="text-sm text-slate-400">
              {isSpectator
                ? 'Watch the live match without taking a seat.'
                : 'Choose your display name, avatar, and colour.'}
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-5 space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                placeholder="e.g. Alex"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-white font-semibold focus:outline-none focus:border-emerald-400"
              />
            </div>

            {!isSpectator && (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                    Select Avatar
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {PLAYER_AVATARS.map((av) => (
                      <button
                        key={av}
                        type="button"
                        onClick={() => setAvatar(av)}
                        className={`p-1.5 rounded-xl border flex items-center justify-center transition ${
                          avatar === av
                            ? 'border-amber-400 bg-amber-500/15 scale-105'
                            : 'border-slate-800 bg-slate-950/60 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <AvatarBadge
                          avatar={av}
                          color={preferredColor ?? 'blue'}
                          size="sm"
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {colorMode === 'manual' && availableColors.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                      Select Colour (Manual Mode)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableColors.map((c) => {
                        const taken = takenColors.includes(c);
                        const selected = preferredColor === c;
                        const pal = COLOR_PALETTE[c];
                        return (
                          <button
                            key={c}
                            type="button"
                            disabled={taken}
                            onClick={() => setPreferredColor(c)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                              taken
                                ? 'opacity-30 cursor-not-allowed border-slate-800'
                                : selected
                                  ? 'border-white ring-2 ring-white/60 scale-105'
                                  : 'border-white/20 opacity-85 hover:opacity-100'
                            }`}
                            style={{
                              backgroundColor: pal.primary,
                              color: pal.textOnPrimary,
                            }}
                          >
                            {selected && <Check className="w-3.5 h-3.5" />}
                            {pal.name}
                            {taken ? ' (Taken)' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black flex items-center justify-center gap-2 transition"
            >
              <UserPlus className="w-5 h-5" />
              {submitting ? 'Joining...' : isSpectator ? 'Enter Spectator View' : 'Enter Waiting Lobby'}
            </button>
          </div>
        </form>
      </div>
    </LayoutShell>
  );
}
