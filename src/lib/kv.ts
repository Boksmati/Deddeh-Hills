/**
 * Unified KV adapter.
 *
 * - When KV_REST_API_URL is set (Vercel production), uses @vercel/kv.
 * - Otherwise falls back to local file-system JSON (local dev / no-KV deploys).
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");

function fsRead<T>(file: string, fallback: T): T {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    return JSON.parse(readFileSync(join(DATA_DIR, file), "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function fsWrite(file: string, value: unknown): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, file), JSON.stringify(value, null, 2));
}

async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const { kv } = await import("@vercel/kv");
  const val = await kv.get<T>(key);
  return val ?? fallback;
}

async function kvSet(key: string, value: unknown): Promise<void> {
  const { kv } = await import("@vercel/kv");
  await kv.set(key, value);
}

const useKV = Boolean(process.env.KV_REST_API_URL);

export async function dbGet<T>(key: string, fallback: T): Promise<T> {
  if (useKV) return kvGet(key, fallback);
  return fsRead(`${key}.json`, fallback);
}

export async function dbSet(key: string, value: unknown): Promise<void> {
  if (useKV) return kvSet(key, value);
  fsWrite(`${key}.json`, value);
}
