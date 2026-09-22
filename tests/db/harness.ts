/**
 * Test harness: boots a real Postgres (PGlite, in-process) and applies the
 * project's migrations, after first creating the small bits of Supabase that
 * the migrations rely on (the `auth` schema, auth.uid(), and the API roles).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../supabase/migrations");

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
`;

export type Db = PGlite & {
  /** Create a Supabase auth user (fires the new-user trigger). */
  createUser(email?: string): Promise<string>;
  /** Run fn as a signed-in user, with RLS enforced. */
  asUser<T>(userId: string, fn: () => Promise<T>): Promise<T>;
};

export async function createDb(): Promise<Db> {
  const pg = new PGlite();
  await pg.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }

  const db = pg as Db;
  db.createUser = async (email = `${crypto.randomUUID()}@example.com`) => {
    const id = crypto.randomUUID();
    await pg.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
    return id;
  };
  db.asUser = async (userId, fn) => {
    await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
    try {
      return await fn();
    } finally {
      await pg.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
    }
  };
  return db;
}
