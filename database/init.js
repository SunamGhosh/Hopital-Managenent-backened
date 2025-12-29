const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Define the safe database path in the "Hospital Data" folder
const DATA_FOLDER = 'D:/Hospital Management System/Hospital Data';
const DB_PATH = path.join(DATA_FOLDER, 'hospital.db');

// Ensure the data folder exists
if (!fs.existsSync(DATA_FOLDER)) {
  try {
    fs.mkdirSync(DATA_FOLDER, { recursive: true });
    console.log(`Created data folder: ${DATA_FOLDER}`);
  } catch (err) {
    console.error('Failed to create data folder:', err);
    process.exit(1);
  }
}

function initDatabase() {
  return new Promise((resolve, reject) => {
    console.log(`Connecting to database at: ${DB_PATH}`);

    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database successfully');
    });

    db.serialize(() => {
      // Users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer',
        patient_id INTEGER,
        doctor_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (doctor_id) REFERENCES doctors(id)
      )`);

      // Patients table
      db.run(`CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        date_of_birth DATE NOT NULL,
        gender TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        blood_group TEXT,
        allergies TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Doctors table
      db.run(`CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doctor_id TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        specialization TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        qualification TEXT,
        experience_years INTEGER,
        consultation_fee REAL,
        available_days TEXT,
        available_time_start TEXT,
        available_time_end TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Appointments table
      db.run(`CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id TEXT UNIQUE NOT NULL,
        patient_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL,
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        status TEXT DEFAULT 'scheduled',
        reason TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (doctor_id) REFERENCES doctors(id)
      )`);

      // Medical Records table
      db.run(`CREATE TABLE IF NOT EXISTS medical_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id TEXT UNIQUE NOT NULL,
        patient_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL,
        appointment_id INTEGER,
        diagnosis TEXT,
        symptoms TEXT,
        prescription TEXT,
        test_results TEXT,
        notes TEXT,
        visit_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (doctor_id) REFERENCES doctors(id),
        FOREIGN KEY (appointment_id) REFERENCES appointments(id)
      )`);

      // Indexes for performance
      db.run(`CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON patients(patient_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_doctors_doctor_id ON doctors(doctor_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records(patient_id)`);

      // Safely add columns if they don't exist (ALTER TABLE is ignored if column exists)
      db.run(`ALTER TABLE users ADD COLUMN patient_id INTEGER`, () => {});
      db.run(`ALTER TABLE users ADD COLUMN doctor_id INTEGER`, () => {});

      // Create default admin user
      const adminEmail = 'admin@hospital.com';
      const adminPassword = 'admin123';
      const adminUsername = 'admin';
      const adminRole = 'admin';

      bcrypt.hash(adminPassword, 10, (err, hash) => {
        if (err) {
          console.error('Error hashing password:', err);
          db.close();
          reject(err);
          return;
        }

        db.run(
          `INSERT OR IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`,
          [adminUsername, adminEmail, hash, adminRole],
          function (err) {
            if (err) {
              console.error('Error creating default admin user:', err.message);
            } else if (this.changes === 0) {
              console.log('Default admin user already exists');
            } else {
              console.log('Default admin user created successfully');
            }

            console.log('Database initialized successfully');
            console.log('Default admin credentials:');
            console.log('  Email: admin@hospital.com');
            console.log('  Password: admin123');

            db.close((err) => {
              if (err) {
                console.error('Error closing database:', err.message);
                reject(err);
              } else {
                resolve();
              }
            });
          }
        );
      });
    });
  });
}

module.exports = { initDatabase, DB_PATH };