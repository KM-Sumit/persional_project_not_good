import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isLocal =
  !process.env.DATABASE_URL?.includes("sslmode=require") &&
  (process.env.DATABASE_URL?.includes("localhost") ||
    process.env.DATABASE_URL?.includes("127.0.0.1"));

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  // Force IPv4 — prevents EHOSTUNREACH/ETIMEDOUT when DNS returns an IPv6 address
  family: 4,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
  max: 10,
} as any);
export const db = drizzle(pool, { schema });

export * from "./schema";
