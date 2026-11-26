import { randomBytes, randomInt } from 'node:crypto';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomId(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ROOM_ALPHABET[randomInt(0, ROOM_ALPHABET.length)];
  }
  return out;
}

export function generateSecureToken(bytes = 24): string {
  return randomBytes(bytes).toString('hex');
}

export function generateParticipantId(prefix = 'p'): string {
  return `${prefix}-${randomBytes(6).toString('hex')}`;
}
