/* ==========================================================================
   UniAI — cache for AI answers (store.js)

   FileStore      simplest; fine locally. On Render's free tier the disk is wiped on
                  every deploy, so you would pay for the same answers again.
   SupabaseStore  recommended in production (run university_ai_fill.sql first).
                  Uses the SERVICE ROLE client you already have in supabase.js (server only).
   MemoryStore    for tests.

   All three: get(id), getMany(ids) -> Map(id -> entry), set(id, entry)
   ========================================================================== */

"use strict";

const fs = require("fs");
const path = require("path");

class MemoryStore {
  constructor() {
    this.map = new Map();
  }
  async get(id) {
    return this.map.get(id) || null;
  }
  async getMany(ids) {
    return new Map(ids.filter((id) => this.map.has(id)).map((id) => [id, this.map.get(id)]));
  }
  async set(id, entry) {
    this.map.set(id, entry);
  }
}

class FileStore extends MemoryStore {
  constructor(file) {
    super();
    this.file = file;
    this.timer = null;
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      Object.entries(data).forEach(([id, entry]) => this.map.set(id, entry));
    } catch (err) {
      /* first run: no file yet */
    }
  }
  async set(id, entry) {
    await super.set(id, entry);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 500);
  }
  flush() {
    clearTimeout(this.timer);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.map)));
    fs.renameSync(tmp, this.file); // atomic: never leaves a half-written cache
  }
}

class SupabaseStore {
  // Pass your existing client ({ client: require("../supabase") }) or { url, key }.
  constructor({ client, url, key, table = "university_ai_fill" }) {
    if (client) {
      this.db = client;
    } else {
      const { createClient } = require("@supabase/supabase-js");
      this.db = createClient(url, key, { auth: { persistSession: false } });
    }
    this.table = table;
  }
  static fromRow(row) {
    return { fields: row.fields || {}, model: row.model, filledAt: row.filled_at, asked: row.asked || [] };
  }
  async get(id) {
    const { data, error } = await this.db.from(this.table).select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? SupabaseStore.fromRow(data) : null;
  }
  async getMany(ids) {
    if (!ids.length) return new Map();
    const { data, error } = await this.db.from(this.table).select("*").in("id", ids);
    if (error) throw error;
    return new Map((data || []).map((row) => [row.id, SupabaseStore.fromRow(row)]));
  }
  async set(id, entry) {
    const { error } = await this.db
      .from(this.table)
      .upsert({ id, fields: entry.fields, model: entry.model, filled_at: entry.filledAt, asked: entry.asked });
    if (error) throw error;
  }
}

module.exports = { MemoryStore, FileStore, SupabaseStore };