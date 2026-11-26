import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { MatchHistoryRecord, RoomState } from '@ludo-arena/shared-types';

export interface PersistedRoomRecord {
  roomId: string;
  hostToken: string;
  roomState: RoomState;
  participantTokens: Record<string, { role: 'player' | 'spectator'; participantId: string }>;
  updatedAt: number;
}

export class LudoDatabase {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS active_rooms (
        room_id TEXT PRIMARY KEY,
        host_token TEXT NOT NULL,
        state_json TEXT NOT NULL,
        participant_tokens_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS match_history (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        player_count_mode INTEGER NOT NULL,
        team_mode INTEGER NOT NULL,
        winner_name TEXT,
        record_json TEXT NOT NULL,
        finished_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  saveRoom(record: PersistedRoomRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO active_rooms (room_id, host_token, state_json, participant_tokens_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(room_id) DO UPDATE SET
        host_token = excluded.host_token,
        state_json = excluded.state_json,
        participant_tokens_json = excluded.participant_tokens_json,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      record.roomId,
      record.hostToken,
      JSON.stringify(record.roomState),
      JSON.stringify(record.participantTokens),
      record.updatedAt
    );
  }

  loadAllActiveRooms(): PersistedRoomRecord[] {
    const stmt = this.db.prepare(
      `SELECT room_id, host_token, state_json, participant_tokens_json, updated_at FROM active_rooms`
    );
    const rows = stmt.all() as Array<{
      room_id: string;
      host_token: string;
      state_json: string;
      participant_tokens_json: string;
      updated_at: number;
    }>;

    return rows.map((row) => ({
      roomId: row.room_id,
      hostToken: row.host_token,
      roomState: JSON.parse(row.state_json) as RoomState,
      participantTokens: JSON.parse(row.participant_tokens_json) as PersistedRoomRecord['participantTokens'],
      updatedAt: row.updated_at,
    }));
  }

  deleteRoom(roomId: string): void {
    const stmt = this.db.prepare(`DELETE FROM active_rooms WHERE room_id = ?`);
    stmt.run(roomId);
  }

  saveMatchHistory(record: MatchHistoryRecord): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO match_history (
        id, room_id, player_count_mode, team_mode, winner_name, record_json, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      record.id,
      record.roomId,
      record.playerCountMode,
      record.teamMode ? 1 : 0,
      record.winnerName,
      JSON.stringify(record),
      record.finishedAt
    );
  }

  listMatchHistory(limit = 50): MatchHistoryRecord[] {
    const stmt = this.db.prepare(
      `SELECT record_json FROM match_history ORDER BY finished_at DESC LIMIT ?`
    );
    const rows = stmt.all(limit) as Array<{ record_json: string }>;
    return rows.map((r) => JSON.parse(r.record_json) as MatchHistoryRecord);
  }

  clearMatchHistory(): void {
    this.db.exec(`DELETE FROM match_history`);
  }

  getSetting<T>(key: string, fallback: T): T {
    const stmt = this.db.prepare(`SELECT value_json FROM settings WHERE key = ?`);
    const row = stmt.get(key) as { value_json: string } | undefined;
    if (!row) return fallback;
    try {
      return JSON.parse(row.value_json) as T;
    } catch {
      return fallback;
    }
  }

  setSetting(key: string, value: unknown): void {
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    `);
    stmt.run(key, JSON.stringify(value), Date.now());
  }

  close(): void {
    this.db.close();
  }
}
