import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { randomToken, sha256 } from "./crypto";
import type { Role } from "../generated/prisma/client";

const COOKIE = "wb_session";
const TTL_DAYS = 14;

export async function createSession(userId: string) {
  const token = randomToken();
  await db.session.create({ data: { id: sha256(token), userId, expiresAt: new Date(Date.now() + TTL_DAYS * 86_400_000) } });
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: TTL_DAYS * 86_400 });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(COOKIE);
}

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return s.user;
}

/** Role-based access for WEBSTER OS. FOUNDER > PRODUCER > ANALYST. */
const RANK: Record<Role, number> = { FOUNDER: 3, PRODUCER: 2, ANALYST: 1, VIEWER: 0 };

export async function requireRole(min: Role = "ANALYST") {
  const user = await currentUser();
  if (!user) redirect("/os/login");
  if (RANK[user.role] < RANK[min]) throw new Error(`This action needs the ${min.toLowerCase()} role.`);
  return user;
}

export const actorOf = (u: { id: string; email: string }) => `user:${u.email}`;
