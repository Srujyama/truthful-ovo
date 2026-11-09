import {createHash} from 'node:crypto';

const migrations=[{version:1,name:'finance-ledger-baseline',sql:'CREATE TABLE IF NOT EXISTS backend_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT;'}];
export function migrateFinance(db){
 db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,checksum TEXT NOT NULL,applied_at TEXT NOT NULL) STRICT');
 const current=db.prepare('PRAGMA user_version').get().user_version;
 if(current>migrations.length)throw new Error('Database schema is newer than this backend. Upgrade the application before opening it.');
 for(const entry of db.prepare('SELECT * FROM schema_migrations ORDER BY version').all()){
  const known=migrations.find(m=>m.version===entry.version);
  if(!known||entry.checksum!==checksum(known)||entry.name!==known.name)throw new Error('Migration history differs from this application.');
 }
 for(const migration of migrations){
  if(db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get(migration.version))continue;
  db.exec('BEGIN IMMEDIATE');try{
   db.exec(migration.sql);
   db.prepare('INSERT INTO schema_migrations VALUES(?,?,?,?)').run(migration.version,migration.name,checksum(migration),new Date().toISOString());
   db.exec(`PRAGMA user_version=${migration.version}`);db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
}
const checksum=m=>createHash('sha256').update(`${m.version}\n${m.name}\n${m.sql}`).digest('hex');
export const financeSchemaVersion=migrations.length;
