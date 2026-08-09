const Database=require("better-sqlite3");
const config=require("./config");
const db=new Database(config.database);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS demos(
 id TEXT PRIMARY KEY,
 container_id TEXT,
 db_container_id TEXT,
 url TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 last_activity INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 hard_expires_at INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL,
 provision_stage TEXT NOT NULL DEFAULT 'queued',
 status_message TEXT NOT NULL DEFAULT 'Queued',
 error_message TEXT,
 failure_logs TEXT,
 admin_user TEXT NOT NULL,
 admin_password TEXT NOT NULL,
 ip_address TEXT,
 template_version TEXT NOT NULL DEFAULT 'unknown',
 provision_started_at INTEGER,
 provision_finished_at INTEGER,
 database_ms INTEGER DEFAULT 0,
 import_ms INTEGER DEFAULT 0,
 wordpress_ms INTEGER DEFAULT 0,
 finalise_ms INTEGER DEFAULT 0,
 routing_ms INTEGER DEFAULT 0,
 demo_type TEXT NOT NULL DEFAULT 'public',
 platform_version TEXT NOT NULL DEFAULT 'unknown',
 health_status TEXT NOT NULL DEFAULT 'unknown',
 last_health_at INTEGER,
 health_failures INTEGER NOT NULL DEFAULT 0,
 demo_image_id TEXT,
 degraded_logs TEXT
);

CREATE TABLE IF NOT EXISTS settings(
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS launches(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 ip_address TEXT NOT NULL,
 created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots(
 version TEXT PRIMARY KEY,
 created_at INTEGER NOT NULL,
 path TEXT NOT NULL,
 size_bytes INTEGER NOT NULL DEFAULT 0,
 is_current INTEGER NOT NULL DEFAULT 0,
 manifest_json TEXT
);

CREATE TABLE IF NOT EXISTS admin_actions(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 created_at INTEGER NOT NULL,
 action TEXT NOT NULL,
 demo_id TEXT,
 message TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at DESC);

CREATE TABLE IF NOT EXISTS login_tokens(
 token TEXT PRIMARY KEY,
 demo_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS provisioning_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 demo_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 created_at_ms INTEGER,
 stage TEXT NOT NULL,
 level TEXT NOT NULL DEFAULT 'info',
 message TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_provisioning_events_demo
ON provisioning_events(demo_id, created_at, id);
`);

function ensureColumn(table, name, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!columns.includes(name)) {
    console.log(`Database migration: adding ${table}.${name}`);
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

ensureColumn("demos","hard_expires_at","INTEGER NOT NULL DEFAULT 0");
ensureColumn("demos","provision_stage","TEXT NOT NULL DEFAULT 'queued'");
ensureColumn("demos","status_message","TEXT NOT NULL DEFAULT 'Queued'");
ensureColumn("demos","error_message","TEXT");
ensureColumn("demos","failure_logs","TEXT");
ensureColumn("demos","ip_address","TEXT");
ensureColumn("demos","template_version","TEXT NOT NULL DEFAULT 'unknown'");
ensureColumn("demos","provision_started_at","INTEGER");
ensureColumn("demos","provision_finished_at","INTEGER");
ensureColumn("demos","database_ms","INTEGER DEFAULT 0");
ensureColumn("demos","import_ms","INTEGER DEFAULT 0");
ensureColumn("demos","wordpress_ms","INTEGER DEFAULT 0");
ensureColumn("demos","finalise_ms","INTEGER DEFAULT 0");
ensureColumn("demos","routing_ms","INTEGER DEFAULT 0");
ensureColumn("demos","demo_type","TEXT NOT NULL DEFAULT 'public'");
ensureColumn("demos","platform_version","TEXT NOT NULL DEFAULT 'unknown'");
ensureColumn("demos","degraded_logs","TEXT");
ensureColumn("demos","demo_image_id","TEXT");
ensureColumn("demos","health_failures","INTEGER NOT NULL DEFAULT 0");
ensureColumn("demos","last_health_at","INTEGER");
ensureColumn("demos","health_status","TEXT NOT NULL DEFAULT 'unknown'");
ensureColumn("provisioning_events","created_at_ms","INTEGER");

db.prepare(`
 UPDATE demos
 SET hard_expires_at = CASE
   WHEN hard_expires_at IS NULL OR hard_expires_at = 0 THEN expires_at
   ELSE hard_expires_at
 END
`).run();

module.exports=db;
