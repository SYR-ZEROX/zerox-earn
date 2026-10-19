import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, sessionsTable, usersTable, type User } from "@workspace/db";

const SESSION_COOKIE = "zx_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_KEY_LENGTH = 64;

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      PASSWORD_KEY_LENGTH,
      { N: 16384, r: 8, p: 1 },
      (error, key) => {
        if (error) reject(error);
        else resolve(key as Buffer);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derivePasswordKey(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [algorithm, saltHex, keyHex] = storedHash.split("$");
  if (algorithm !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await derivePasswordKey(password, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashSessionId(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex");
}

export function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    signed: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

export async function createSession(userId: string): Promise<string> {
  const sessionId = randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    id: hashSessionId(sessionId),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return sessionId;
}

export async function deleteCurrentSession(req: Request): Promise<void> {
  const sessionId = req.signedCookies?.[SESSION_COOKIE];
  if (typeof sessionId !== "string") return;
  await db.delete(sessionsTable).where(eq(sessionsTable.id, hashSessionId(sessionId)));
}

export async function getSessionUser(req: Request): Promise<User | null> {
  const sessionId = req.signedCookies?.[SESSION_COOKIE];
  if (typeof sessionId !== "string") return null;

  const [record] = await db
    .select({ user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(
      and(
        eq(sessionsTable.id, hashSessionId(sessionId)),
        gt(sessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return record?.user ?? null;
}

export function publicUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    balance: Number(user.balance),
    xp: user.xp,
    level: user.level,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
