import { randomInt } from "node:crypto";
import type { Pool, PoolClient } from "pg";

const CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 characters, no ambiguous chars (0, O, 1, I)

/**
 * Generate a cryptographically secure random access password
 */
export function generateAccessPassword(length = 8): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARSET[randomInt(0, CHARSET.length)];
  }
  return result;
}

/**
 * Format a date/time in Asia/Kolkata timezone (IST)
 */
export function formatKolkataTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d) + " IST";
}

export type ScheduledTestState = "draft" | "scheduled" | "live" | "completed" | "cancelled";

/**
 * Compute the authoritative live status of a scheduled test
 */
export function computeScheduledStatus(test: {
  status: string;
  published?: boolean;
  scheduledStartAt?: Date | string | null;
  scheduledEndAt?: Date | string | null;
}): ScheduledTestState {
  if (test.status === "cancelled") return "cancelled";
  if (test.status === "draft" || !test.published) return "draft";
  if (!test.scheduledStartAt) return "draft";

  const now = Date.now();
  const start = new Date(test.scheduledStartAt).getTime();
  const end = test.scheduledEndAt ? new Date(test.scheduledEndAt).getTime() : start;

  if (now < start) return "scheduled";
  if (now >= start && now < end) return "live";
  return "completed";
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * Check if the student or IP is locked out due to excessive failed attempts
 */
export async function checkPasswordRateLimit(
  client: Pool | PoolClient,
  userId: number,
  testId: number,
  ip: string,
): Promise<{ allowed: boolean; message?: string; lockedUntil?: Date }> {
  const result = await client.query<{
    failed_count: number;
    locked_until: string | null;
  }>(
    `SELECT failed_count, locked_until
     FROM test_access_attempts
     WHERE (user_id = $1 OR ip = $2) AND test_id = $3
     ORDER BY locked_until DESC NULLS LAST
     LIMIT 1`,
    [userId, ip, testId],
  );

  const row = result.rows[0];
  if (!row) return { allowed: true };

  if (row.locked_until) {
    const lockTime = new Date(row.locked_until).getTime();
    if (lockTime > Date.now()) {
      const remainingMinutes = Math.ceil((lockTime - Date.now()) / 60_000);
      return {
        allowed: false,
        message: `Too many incorrect password attempts. Please wait ${remainingMinutes} minute(s) before trying again.`,
        lockedUntil: new Date(row.locked_until),
      };
    }
  }

  return { allowed: true };
}

/**
 * Record a failed password attempt and apply lockout if threshold exceeded
 */
export async function recordFailedPasswordAttempt(
  client: Pool | PoolClient,
  userId: number,
  testId: number,
  ip: string,
): Promise<{ attemptsLeft: number; locked: boolean; lockedUntil?: Date }> {
  const existing = await client.query<{
    id: number;
    failed_count: number;
    locked_until: string | null;
  }>(
    `SELECT id, failed_count, locked_until
     FROM test_access_attempts
     WHERE user_id = $1 AND test_id = $2
     LIMIT 1`,
    [userId, testId],
  );

  let newCount = 1;
  let lockedUntil: Date | null = null;
  let isLocked = false;

  if (existing.rows[0]) {
    newCount = existing.rows[0].failed_count + 1;
    if (newCount >= MAX_FAILED_ATTEMPTS) {
      isLocked = true;
      lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
    }
    await client.query(
      `UPDATE test_access_attempts
       SET failed_count = $1, locked_until = $2, ip = $3, updated_at = NOW()
       WHERE id = $4`,
      [newCount, lockedUntil, ip, existing.rows[0].id],
    );
  } else {
    await client.query(
      `INSERT INTO test_access_attempts (user_id, test_id, ip, failed_count, locked_until, updated_at)
       VALUES ($1, $2, $3, 1, NULL, NOW())`,
      [userId, testId, ip],
    );
  }

  const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - newCount);
  return { attemptsLeft, locked: isLocked, lockedUntil: lockedUntil ?? undefined };
}

/**
 * Reset failed attempts upon successful password verification
 */
export async function resetPasswordRateLimit(
  client: Pool | PoolClient,
  userId: number,
  testId: number,
): Promise<void> {
  await client.query(
    `DELETE FROM test_access_attempts WHERE user_id = $1 AND test_id = $2`,
    [userId, testId],
  );
}
