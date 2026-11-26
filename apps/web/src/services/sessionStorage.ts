import type { PlayerAvatar } from '@ludo-arena/shared-types';

export interface HostSessionRecord {
  roomId: string;
  hostToken: string;
  createdAt: number;
}

export interface PlayerSessionRecord {
  roomId: string;
  participantId: string;
  sessionToken: string;
  role: 'player' | 'spectator';
  name: string;
  avatar: PlayerAvatar;
}

export interface AppPreferences {
  theme: 'dark' | 'light';
  soundEnabled: boolean;
  musicEnabled: boolean;
}

const HOST_KEY = 'ludo_arena_host_session';
const PLAYER_KEY = 'ludo_arena_player_session';
const PREF_KEY = 'ludo_arena_preferences';

export function saveHostSession(record: HostSessionRecord): void {
  localStorage.setItem(HOST_KEY, JSON.stringify(record));
}

export function getHostSession(roomId?: string): HostSessionRecord | null {
  try {
    const raw = localStorage.getItem(HOST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HostSessionRecord;
    if (roomId && parsed.roomId.toUpperCase() !== roomId.toUpperCase()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearHostSession(): void {
  localStorage.removeItem(HOST_KEY);
}

export function savePlayerSession(record: PlayerSessionRecord): void {
  localStorage.setItem(PLAYER_KEY, JSON.stringify(record));
}

export function getPlayerSession(roomId?: string): PlayerSessionRecord | null {
  try {
    const raw = localStorage.getItem(PLAYER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerSessionRecord;
    if (roomId && parsed.roomId.toUpperCase() !== roomId.toUpperCase()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPlayerSession(): void {
  localStorage.removeItem(PLAYER_KEY);
}

export function getPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return { theme: 'dark', soundEnabled: true, musicEnabled: false };
    return {
      theme: 'dark',
      soundEnabled: true,
      musicEnabled: false,
      ...(JSON.parse(raw) as Partial<AppPreferences>),
    };
  } catch {
    return { theme: 'dark', soundEnabled: true, musicEnabled: false };
  }
}

export function savePreferences(prefs: AppPreferences): void {
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
}
