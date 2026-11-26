import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  DiceResultEvent,
  GameFinishedEvent,
  JoinRoomPayload,
  JoinRoomResponse,
  PawnMovedEvent,
  RoomState,
  SocketAck,
} from '@ludo-arena/shared-types';
import { audioEngine } from '../services/audioEngine';
import {
  getPreferences,
  savePreferences,
  type AppPreferences,
} from '../services/sessionStorage';
import {
  emitAck,
  fetchCompanionHealth,
  getSocket,
} from '../services/socketClient';

interface ArenaContextValue {
  socketConnected: boolean;
  companionReachable: boolean;
  roomState: RoomState | null;
  setRoomState: React.Dispatch<React.SetStateAction<RoomState | null>>;
  lastDiceEvent: DiceResultEvent | null;
  lastPawnMoved: PawnMovedEvent | null;
  lastGameFinished: GameFinishedEvent | null;
  preferences: AppPreferences;
  toggleTheme: () => void;
  toggleSound: () => void;
  toggleMusic: () => void;
  recoverHost: (roomId: string, hostToken: string) => Promise<SocketAck<{ roomState: RoomState }>>;
  joinRoom: (payload: JoinRoomPayload) => Promise<SocketAck<JoinRoomResponse>>;
  refreshHealth: () => Promise<boolean>;
}

const ArenaContext = createContext<ArenaContextValue | null>(null);

export function ArenaProvider({ children }: { children: React.ReactNode }) {
  const [socketConnected, setSocketConnected] = useState(false);
  const [companionReachable, setCompanionReachable] = useState(true);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [lastDiceEvent, setLastDiceEvent] = useState<DiceResultEvent | null>(null);
  const [lastPawnMoved, setLastPawnMoved] = useState<PawnMovedEvent | null>(null);
  const [lastGameFinished, setLastGameFinished] = useState<GameFinishedEvent | null>(null);
  const [preferences, setPreferences] = useState<AppPreferences>(() => getPreferences());
  const diceClearRef = useRef<number | null>(null);

  useEffect(() => {
    audioEngine.setSoundEnabled(preferences.soundEnabled);
    audioEngine.setMusicEnabled(preferences.musicEnabled);
    savePreferences(preferences);
    if (preferences.theme === 'light') {
      document.documentElement.classList.add('theme-light');
    } else {
      document.documentElement.classList.remove('theme-light');
    }
  }, [preferences]);

  const refreshHealth = useCallback(async () => {
    const res = await fetchCompanionHealth();
    setCompanionReachable(res.ok);
    return res.ok;
  }, []);

  useEffect(() => {
    void refreshHealth();
    const healthTimer = window.setInterval(() => {
      void refreshHealth();
    }, 10000);
    return () => clearInterval(healthTimer);
  }, [refreshHealth]);

  useEffect(() => {
    const socket = getSocket();
    setSocketConnected(socket.connected);

    const onConnect = () => {
      setSocketConnected(true);
      setCompanionReachable(true);
    };
    const onDisconnect = () => {
      setSocketConnected(false);
    };
    const onRoomState = (next: RoomState) => {
      setRoomState(next);
    };
    const onDiceResult = (evt: DiceResultEvent) => {
      setLastDiceEvent(evt);
      audioEngine.playDiceRoll();
      if (diceClearRef.current) clearTimeout(diceClearRef.current);
      diceClearRef.current = window.setTimeout(() => {
        setLastDiceEvent((prev) => (prev?.version === evt.version ? evt : prev));
      }, 2500);
    };
    const onPawnMoved = (evt: PawnMovedEvent) => {
      setLastPawnMoved(evt);
      if (evt.capturedPawnIds.length > 0) {
        audioEngine.playCapture();
      } else if (evt.reachedHome) {
        audioEngine.playHomeArrival();
      } else {
        audioEngine.playPawnMove();
      }
      if (evt.grantsExtraTurn) {
        setTimeout(() => audioEngine.playExtraTurn(), 180);
      }
    };
    const onGameFinished = (evt: GameFinishedEvent) => {
      setLastGameFinished(evt);
      audioEngine.playVictoryFanfare();
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onRoomState);
    socket.on('dice:result', onDiceResult);
    socket.on('pawn:moved', onPawnMoved);
    socket.on('game:finished', onGameFinished);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onRoomState);
      socket.off('dice:result', onDiceResult);
      socket.off('pawn:moved', onPawnMoved);
      socket.off('game:finished', onGameFinished);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setPreferences((p) => ({ ...p, theme: p.theme === 'dark' ? 'light' : 'dark' }));
  }, []);

  const toggleSound = useCallback(() => {
    setPreferences((p) => ({ ...p, soundEnabled: !p.soundEnabled }));
  }, []);

  const toggleMusic = useCallback(() => {
    setPreferences((p) => ({ ...p, musicEnabled: !p.musicEnabled }));
  }, []);

  const recoverHost = useCallback(async (roomId: string, hostToken: string) => {
    const res = await emitAck<{ roomState: RoomState }>('host:recover', {
      roomId,
      hostToken,
    });
    if (res.ok && res.data?.roomState) {
      setRoomState(res.data.roomState);
    }
    return res;
  }, []);

  const joinRoom = useCallback(async (payload: JoinRoomPayload) => {
    const res = await emitAck<JoinRoomResponse>('room:join', payload);
    if (res.ok && res.data?.roomState) {
      setRoomState(res.data.roomState);
    }
    return res;
  }, []);

  return (
    <ArenaContext.Provider
      value={{
        socketConnected,
        companionReachable,
        roomState,
        setRoomState,
        lastDiceEvent,
        lastPawnMoved,
        lastGameFinished,
        preferences,
        toggleTheme,
        toggleSound,
        toggleMusic,
        recoverHost,
        joinRoom,
        refreshHealth,
      }}
    >
      {children}
    </ArenaContext.Provider>
  );
}

export function useArena() {
  const ctx = useContext(ArenaContext);
  if (!ctx) throw new Error('useArena must be used inside ArenaProvider');
  return ctx;
}
