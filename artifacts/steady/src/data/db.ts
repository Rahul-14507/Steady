import Dexie, { type Table } from "dexie";
import type { Profile, Session } from "../core/types";

export class SteadyDatabase extends Dexie {
  sessions!: Table<Session, string>;
  profiles!: Table<Profile, "me">;

  constructor() {
    super("steady-local");
    this.version(1).stores({
      sessions: "id, task, startedAt, medState, valid, isDemo",
      profiles: "id",
    });
  }
}

export const db = new SteadyDatabase();

export async function getProfile() {
  return db.profiles.get("me");
}

export async function saveProfile(profile: Profile) {
  await db.profiles.put(profile);
  return profile;
}

export async function saveSession(session: Session) {
  await db.sessions.put(session);
  return session;
}

export async function validSessions(task?: Session["task"]) {
  return db.sessions
    .where("valid")
    .equals(1)
    .and((session) => !task || session.task === task)
    .sortBy("startedAt");
}

export async function exportLocalData() {
  return {
    profile: await db.profiles.toArray(),
    sessions: await db.sessions.toArray(),
    exportedAt: new Date().toISOString(),
  };
}

export async function deleteAllLocalData() {
  await db.transaction("rw", db.profiles, db.sessions, async () => {
    await db.profiles.clear();
    await db.sessions.clear();
  });
}