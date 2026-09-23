import { createHash } from 'crypto';

const SALT = 'rendimax_salt_2026';

export function hashPassword(password: string): string {
  return createHash('sha256').update(password + SALT).digest('hex');
}
