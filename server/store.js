const fs = require("fs");
const path = require("path");
const { seedDB } = require("./logic");

const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const KEEP_BACKUPS = 10;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function loadRaw() {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) {
    const seeded = seedDB();
    fs.writeFileSync(DB_PATH, JSON.stringify(seeded, null, 2));
    return seeded;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch (e) {
    console.error("Failed to parse db.json, reseeding.", e);
    const seeded = seedDB();
    fs.writeFileSync(DB_PATH, JSON.stringify(seeded, null, 2));
    return seeded;
  }
}

function saveRaw(db) {
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// Serialize all mutations through a single promise chain so concurrent
// requests can never read-modify-write over each other.
let queue = Promise.resolve();

function withDB(mutatorFn) {
  const run = queue.then(() => {
    const db = loadRaw();
    const result = mutatorFn(db) || {};
    if (!result.error) saveRaw(db);
    return { db, result };
  });
  // Keep the queue alive even if this particular mutation throws/rejects.
  queue = run.catch(() => {});
  return run;
}

function readDB() {
  return loadRaw();
}

/* ------------------------------- BACKUPS ---------------------------------- */
// A single JSON file with no external backup is a real risk once this is
// live and holding real people's data — if the volume is ever corrupted or
// the project deleted by mistake, everything is gone. Two layers of
// protection: an automatic rolling snapshot history (undo-style protection
// against bugs/corruption), and an admin-triggered on-demand export (an
// off-Railway copy someone actually holds, protecting against losing the
// whole project/volume).

function listBackups() {
  ensureBackupDir();
  return fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort(); // filenames are timestamp-prefixed, so this sorts oldest-first
}

function pruneBackups(keep = KEEP_BACKUPS) {
  const files = listBackups();
  const excess = files.length - keep;
  if (excess <= 0) return;
  for (const f of files.slice(0, excess)) {
    fs.unlinkSync(path.join(BACKUP_DIR, f));
  }
}

function createBackup() {
  ensureDir();
  ensureBackupDir();
  if (!fs.existsSync(DB_PATH)) return null; // nothing to back up yet
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const uniq = Math.random().toString(36).slice(2, 8);
  const dest = path.join(BACKUP_DIR, `db-${stamp}-${uniq}.json`);
  fs.copyFileSync(DB_PATH, dest);
  pruneBackups();
  return dest;
}

function latestBackupInfo() {
  const files = listBackups();
  if (files.length === 0) return { count: 0, latest: null };
  const latest = files[files.length - 1];
  const stats = fs.statSync(path.join(BACKUP_DIR, latest));
  return { count: files.length, latest: stats.mtime.toISOString() };
}

module.exports = { withDB, readDB, createBackup, listBackups, latestBackupInfo, DB_PATH };
