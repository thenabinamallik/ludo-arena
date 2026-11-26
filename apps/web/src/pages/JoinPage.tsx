import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, Gamepad2, QrCode, Users } from 'lucide-react';
import { LayoutShell } from '../components/LayoutShell';
import { fetchRoomSummary } from '../services/socketClient';

export function JoinPage() {
  const { roomId: paramRoomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [roomInput, setRoomInput] = useState((paramRoomId ?? '').toUpperCase());
  const [preview, setPreview] = useState<{
    roomId: string;
    playerCountMode: number;
    maxPlayers: number;
    playerCount: number;
    spectatorCount: number;
    status: string;
    teamMode: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const preferSpectator = searchParams.get('spectator') === '1';

  const lookupRoom = async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) return;
    setLoading(true);
    setError(null);
    const res = await fetchRoomSummary(clean);
    setLoading(false);
    if (!res.ok || !res.room) {
      setPreview(null);
      setError(res.error ?? 'Room not found on this LAN host.');
      return;
    }
    setPreview(res.room);
  };

  useEffect(() => {
    if (paramRoomId) {
      setRoomInput(paramRoomId.toUpperCase());
      void lookupRoom(paramRoomId);
    }
  }, [paramRoomId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void lookupRoom(roomInput);
  };

  return (
    <LayoutShell>
      <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mx-auto">
            <QrCode className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-black text-white">Join LUDO ARENA</h1>
          <p className="text-sm text-slate-400">
            Enter the 6-character Room ID shown on the host screen or scan the QR code.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
              placeholder="ROOM ID (e.g. ABC123)"
              maxLength={8}
              className="flex-1 rounded-2xl bg-slate-900 border border-slate-700 px-4 py-3.5 text-center font-mono text-xl font-black tracking-widest text-white uppercase focus:outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              disabled={loading || roomInput.trim().length < 4}
              className="px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black transition"
            >
              {loading ? '...' : 'Find'}
            </button>
          </div>
        </form>

        {error && (
          <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 px-4 py-3 text-sm text-rose-200 text-center">
            {error}
          </div>
        )}

        {preview && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase font-bold text-slate-400">Room Found</div>
                <div className="text-2xl font-black font-mono text-amber-300">
                  {preview.roomId}
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300">
                {preview.playerCountMode}-Player Mode
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>
                  {preview.playerCount}/{preview.maxPlayers} Players
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>{preview.spectatorCount} Spectators</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {preview.status === 'lobby' && preview.playerCount < preview.maxPlayers && !preferSpectator && (
                <button
                  type="button"
                  onClick={() => navigate(`/join/${preview.roomId}/register`)}
                  className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black flex items-center justify-center gap-2 transition"
                >
                  <Gamepad2 className="w-5 h-5" /> Join as Player <ArrowRight className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => navigate(`/join/${preview.roomId}/register?spectator=1`)}
                className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center gap-2 border border-slate-700 transition"
              >
                <Eye className="w-4 h-4" /> Join as Spectator
              </button>
            </div>
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
