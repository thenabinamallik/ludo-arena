import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  LanNetworkInfo,
  MatchHistoryRecord,
  ServerToClientEvents,
  SocketAck,
} from '@ludo-arena/shared-types';

export type LudoSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL_KEY = 'ludo_arena_server_url';
let socketInstance: LudoSocket | null = null;

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

export function getServerBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const queryUrl = new URLSearchParams(window.location.search).get('server');
    if (queryUrl && /^https?:\/\//i.test(queryUrl)) {
      const normalized = normalizeBaseUrl(queryUrl);
      localStorage.setItem(SERVER_URL_KEY, normalized);
      return normalized;
    }
    const stored = localStorage.getItem(SERVER_URL_KEY);
    if (stored) {
      return normalizeBaseUrl(stored);
    }
  }
  const envUrl = import.meta.env.VITE_SERVER_URL as string | undefined;
  return envUrl ? normalizeBaseUrl(envUrl) : '';
}

export function setServerBaseUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = normalizeBaseUrl(url);
  if (trimmed) {
    localStorage.setItem(SERVER_URL_KEY, trimmed);
  } else {
    localStorage.removeItem(SERVER_URL_KEY);
  }
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

function apiUrl(path: string): string {
  const base = getServerBaseUrl();
  return base ? `${base}${path}` : path;
}

export function getSocket(): LudoSocket {
  if (!socketInstance) {
    const base = getServerBaseUrl();
    socketInstance = io(base || undefined, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      transports: ['websocket', 'polling'],
    });
  }
  return socketInstance;
}

export function emitAck<TRes = unknown>(
  event: keyof ClientToServerEvents,
  payload: unknown
): Promise<SocketAck<TRes>> {
  const socket = getSocket();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({
        ok: false,
        code: 'TIMEOUT',
        error: 'Request timed out. Check your LAN connection to the host.',
      });
    }, 8000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).emit(event, payload, (res: SocketAck<TRes>) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

export async function fetchCompanionHealth(): Promise<{
  ok: boolean;
  activeRooms?: number;
  uptimeSeconds?: number;
}> {
  try {
    const res = await fetch(apiUrl('/api/health'), { cache: 'no-store' });
    if (!res.ok) return { ok: false };
    return (await res.json()) as {
      ok: boolean;
      activeRooms?: number;
      uptimeSeconds?: number;
    };
  } catch {
    return { ok: false };
  }
}

export async function fetchLanInfo(): Promise<LanNetworkInfo | null> {
  try {
    const res = await fetch(apiUrl('/api/lan-info'), { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as LanNetworkInfo;
  } catch {
    return null;
  }
}

export async function fetchRoomSummary(roomId: string): Promise<{
  ok: boolean;
  room?: {
    roomId: string;
    playerCountMode: 2 | 4 | 6 | 8;
    maxPlayers: number;
    colorMode: 'auto' | 'manual';
    availableColors: string[];
    takenColors: string[];
    playerCount: number;
    spectatorCount: number;
    status: string;
    teamMode: boolean;
  };
  error?: string;
}> {
  try {
    const res = await fetch(apiUrl(`/api/rooms/${encodeURIComponent(roomId)}`), {
      cache: 'no-store',
    });
    return await res.json();
  } catch {
    return { ok: false, error: 'Cannot reach companion server' };
  }
}

export async function fetchQrInfo(roomId: string, ip?: string): Promise<{
  ok: boolean;
  joinUrl?: string;
  qrDataUrl?: string;
  lanInfo?: LanNetworkInfo;
}> {
  try {
    const params = new URLSearchParams();
    if (ip) params.set('ip', ip);
    const base = getServerBaseUrl();
    const isRemoteCoordinator =
      Boolean(base) &&
      !/localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\./i.test(base);
    if (isRemoteCoordinator) {
      params.set('origin', window.location.origin);
    } else if (!base && window.location.port && window.location.port !== '3001') {
      params.set('webPort', window.location.port);
    }
    const res = await fetch(
      apiUrl(`/api/qr/${encodeURIComponent(roomId)}?${params.toString()}`),
      { cache: 'no-store' }
    );
    return await res.json();
  } catch {
    return { ok: false };
  }
}

export async function fetchMatchHistory(): Promise<MatchHistoryRecord[]> {
  try {
    const res = await fetch(apiUrl('/api/history'), { cache: 'no-store' });
    const data = (await res.json()) as { ok: boolean; records?: MatchHistoryRecord[] };
    return data.records ?? [];
  } catch {
    return [];
  }
}

export async function clearMatchHistoryApi(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/api/history'), { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}
