import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(process.cwd(), '.data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'schoolos.db');
export const db = new Database(dbPath);

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS schools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    support_phone TEXT,
    support_email TEXT,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL,
    status TEXT DEFAULT 'Actif',
    created_at TEXT,
    last_login TEXT,
    qualification TEXT,
    salary REAL
  );

  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    matricule TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    level TEXT NOT NULL,
    class_name TEXT NOT NULL,
    guardian_id TEXT,
    guardian_name TEXT,
    phone TEXT,
    status TEXT DEFAULT 'Actif',
    payment_status TEXT DEFAULT 'À jour',
    school_id TEXT NOT NULL,
    admission_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS guardians (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    relation TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    linked_students TEXT,
    address TEXT,
    portal_access INTEGER DEFAULT 1,
    school_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Seed Initial Data if Empty
const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
if (userCount === 0) {
  const insertSchool = db.prepare('INSERT INTO schools (id, name, address, support_phone, support_email) VALUES (?, ?, ?, ?, ?)');
  insertSchool.run('SCH-01', 'Groupe Scolaire Atlas', '123, Bd Abdelmoumen, Casablanca', '+212 522 123456', 'contact@atlas.ma');

  const insertUser = db.prepare('INSERT INTO users (id, school_id, full_name, email, phone, role, status, created_at, last_login, qualification, salary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insertUser.run('USR-001', 'SCH-01', 'Yassine El Amrani', 'y.elamrani@atlas.ma', '+212 6 12-345678', 'Admin', 'Actif', '15 Jan 2024', "Aujourd'hui, 09:12", null, null);
  insertUser.run('USR-002', 'SCH-01', 'Fatima Zahra Idrissi', 'fz.idrissi@atlas.ma', '+212 6 61-234567', 'Enseignant', 'Actif', '10 Sep 2021', "Aujourd'hui, 08:30", 'Master Mathématiques', 8500);
  insertUser.run('USR-003', 'SCH-01', 'Karim El Amrani', 'karim.amrani@email.com', '+212 6 12-345678', 'Tuteur', 'Actif', '01 Sep 2023', 'Hier, 18:45', null, null);

  const insertStudent = db.prepare('INSERT INTO students (id, matricule, full_name, level, class_name, guardian_name, phone, status, payment_status, school_id, admission_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insertStudent.run('STU-001', 'AAM-2425-0001', 'Yassine El Amrani', 'Collège', '2nd A', 'M. Karim El Amrani', '+212 6 12-345678', 'Actif', 'À jour', 'SCH-01', '2024-09-01');
  insertStudent.run('STU-002', 'AAM-2425-0002', 'Salma Bennani', 'Primaire', '1ère B', 'Mme Salma Bennani', '+212 6 54-987654', 'Actif', 'En retard', 'SCH-01', '2024-09-01');
  insertStudent.run('STU-003', 'AAM-2425-0003', 'Omar Tazi', 'Collège', '2nd C', 'M. Ahmed Tazi', '+212 6 61-112233', 'Actif', 'À jour', 'SCH-01', '2024-09-01');
}

export function query<T>(sql: string, params: any[] = []): T[] {
  return db.prepare(sql).all(params) as T[];
}

export function execute(sql: string, params: any[] = []) {
  return db.prepare(sql).run(params);
}
