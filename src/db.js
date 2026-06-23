import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'aquilles.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    phone TEXT,
    website TEXT,
    street TEXT,
    city TEXT,
    state TEXT,
    country_code TEXT,
    categories TEXT,
    category_name TEXT,
    total_score REAL,
    reviews_count INTEGER,
    google_maps_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    warmth TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    direction TEXT NOT NULL CHECK (direction IN ('sent', 'received')),
    body TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_leads_warmth ON leads(warmth);
  CREATE INDEX IF NOT EXISTS idx_leads_website ON leads(website);
  CREATE INDEX IF NOT EXISTS idx_leads_has_real_website ON leads(has_real_website);
  CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
`);

export default db;
