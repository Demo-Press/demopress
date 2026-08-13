const Database=require("better-sqlite3");
const fs=require("fs");
const path=require("path");
const config=require("./config");

fs.mkdirSync(path.dirname(config.database),{recursive:true});
const db=new Database(config.database);
db.pragma("journal_mode=WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS snapshots(version TEXT PRIMARY KEY,created_at INTEGER,path TEXT,size_bytes INTEGER,is_current INTEGER DEFAULT 0,manifest_json TEXT,validation_status TEXT DEFAULT 'untested',validated_at INTEGER,validation_demo_id TEXT,validation_error TEXT);
CREATE TABLE IF NOT EXISTS presets(slug TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT DEFAULT '',snapshot_version TEXT,required_plugins_json TEXT DEFAULT '[]',required_theme TEXT DEFAULT '',start_path TEXT DEFAULT '/wp-admin/',idle_lifetime INTEGER,max_lifetime INTEGER,is_enabled INTEGER DEFAULT 1,is_default INTEGER DEFAULT 0,created_at INTEGER,updated_at INTEGER);
CREATE TABLE IF NOT EXISTS demos(id TEXT PRIMARY KEY,container_id TEXT DEFAULT '',db_container_id TEXT DEFAULT '',url TEXT,created_at INTEGER,last_activity INTEGER,expires_at INTEGER,hard_expires_at INTEGER,status TEXT,provision_stage TEXT,status_message TEXT,error_message TEXT,failure_logs TEXT,admin_user TEXT,admin_password TEXT,ip_address TEXT,visitor_name TEXT,visitor_email TEXT,visitor_company TEXT,visitor_website TEXT,email_sent_at INTEGER,email_error TEXT,template_version TEXT,preset_slug TEXT DEFAULT 'default',provision_started_at INTEGER,provision_finished_at INTEGER,demo_type TEXT,platform_version TEXT,database_ms INTEGER DEFAULT 0,import_ms INTEGER DEFAULT 0,wordpress_ms INTEGER DEFAULT 0,finalise_ms INTEGER DEFAULT 0,routing_ms INTEGER DEFAULT 0,health_status TEXT DEFAULT 'unknown',last_health_at INTEGER,public_route_status TEXT DEFAULT 'unknown',public_route_last_error TEXT,archived_wp_logs TEXT,archived_db_logs TEXT,deleted_at INTEGER,delete_reason TEXT);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,demo_id TEXT,created_at_ms INTEGER,stage TEXT,level TEXT,message TEXT);
CREATE TABLE IF NOT EXISTS admin_actions(id INTEGER PRIMARY KEY AUTOINCREMENT,created_at INTEGER NOT NULL,action TEXT NOT NULL,demo_id TEXT,message TEXT);
CREATE TABLE IF NOT EXISTS launches(id INTEGER PRIMARY KEY AUTOINCREMENT,ip_address TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_launches_ip_created ON launches(ip_address,created_at);
CREATE INDEX IF NOT EXISTS idx_demos_ip_status ON demos(ip_address,status);
`);

for(const [table,name,type] of [["demos","visitor_name","TEXT"],["demos","visitor_email","TEXT"],["demos","visitor_company","TEXT"],["demos","visitor_website","TEXT"],["demos","email_sent_at","INTEGER"],["demos","email_error","TEXT"],["demos","preset_slug","TEXT DEFAULT 'default'"],["snapshots","validation_status","TEXT DEFAULT 'untested'"],["snapshots","validated_at","INTEGER"],["snapshots","validation_demo_id","TEXT"],["snapshots","validation_error","TEXT"]]){try{db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`)}catch(e){if(!/duplicate column name/i.test(String(e.message)))throw e}}

const now=Math.floor(Date.now()/1000);
try{db.prepare(`INSERT OR IGNORE INTO presets(slug,name,description,start_path,is_enabled,is_default,created_at,updated_at) VALUES('default','Default','Existing DemoPress golden-template configuration.','/wp-admin/',1,1,?,?)`).run(now,now)}catch(e){console.warn("Unable to initialise default preset:",e.message)}
try{db.exec(`CREATE VIEW IF NOT EXISTS provisioning_events AS SELECT id,demo_id,CAST(created_at_ms / 1000 AS INTEGER) AS created_at,created_at_ms,stage,level,message FROM events;`)}catch(e){console.warn("Unable to create provisioning_events compatibility view:",e.message)}
module.exports=db;
