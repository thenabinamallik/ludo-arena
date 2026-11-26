import { Music, Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import { useArena } from '../hooks/useRoomSession';

export function ThemeAudioControls() {
  const { preferences, toggleTheme, toggleSound, toggleMusic } = useArena();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleSound}
        title={preferences.soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
        className="p-2 rounded-xl border border-slate-500/25 bg-slate-800/40 hover:bg-slate-700/50 transition text-sm flex items-center gap-1.5"
      >
        {preferences.soundEnabled ? (
          <Volume2 className="w-4 h-4 text-emerald-400" />
        ) : (
          <VolumeX className="w-4 h-4 text-slate-400" />
        )}
      </button>
      <button
        type="button"
        onClick={toggleMusic}
        title={preferences.musicEnabled ? 'Mute background music' : 'Play background music'}
        className={`p-2 rounded-xl border border-slate-500/25 transition text-sm flex items-center gap-1.5 ${
          preferences.musicEnabled
            ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
            : 'bg-slate-800/40 text-slate-400 hover:bg-slate-700/50'
        }`}
      >
        <Music className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={toggleTheme}
        title="Toggle light/dark theme"
        className="p-2 rounded-xl border border-slate-500/25 bg-slate-800/40 hover:bg-slate-700/50 transition"
      >
        {preferences.theme === 'dark' ? (
          <Sun className="w-4 h-4 text-amber-300" />
        ) : (
          <Moon className="w-4 h-4 text-indigo-600" />
        )}
      </button>
    </div>
  );
}
