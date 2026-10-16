// database.js — FIXED: always ensures departments & admin exist
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./dbu_exit_exam.db');

db.serialize(() => {

  // ---------- CREATE TABLES ----------
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    department_id INTEGER,
    payment_method TEXT,
    payment_ref TEXT,
    paid INTEGER DEFAULT 0,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    faculty TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_id INTEGER,
    course_name TEXT NOT NULL,
    course_code TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    question_text TEXT NOT NULL,
    option_a TEXT, option_b TEXT, option_c TEXT, option_d TEXT,
    correct_answer TEXT, explanation TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, course_id INTEGER,
    score INTEGER, total INTEGER,
    taken_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // =========================================================
  // ✅ ALWAYS SEED DEPARTMENTS IF TABLE IS EMPTY
  // =========================================================
  db.get(`SELECT COUNT(*) AS c FROM departments`, (err, row) => {
    if (err) { console.error('Dept check error:', err); return; }

    if (row.c === 0) {
      console.log('📦 Seeding all DBU departments...');

      const departments = [
        // Computing
        ['Computer Science', 'Computing'],
        ['Software Engineering', 'Computing'],
        ['Information Systems', 'Computing'],
        ['Information Technology', 'Computing'],
        ['Data Science', 'Computing'],

        // Business & Economics
        ['Management', 'Business & Economics'],
        ['Accounting and Finance', 'Business & Economics'],
        ['Marketing Management', 'Business & Economics'],
        ['Economics', 'Business & Economics'],
        ['Business Administration', 'Business & Economics'],
        ['Banking and Finance', 'Business & Economics'],
        ['Logistics and Supply Chain Management', 'Business & Economics'],
        ['Agro Economics', 'Business & Economics'],
        ['Public Administration', 'Business & Economics'],

        // Law
        ['Law', 'Law'],

        // Engineering
        ['Civil Engineering', 'Engineering'],
        ['Electrical Engineering', 'Engineering'],
        ['Mechanical Engineering', 'Engineering'],
        ['Industrial Engineering', 'Engineering'],
        ['Chemical Engineering', 'Engineering'],
        ['Food Engineering', 'Engineering'],
        ['Architecture', 'Engineering'],
        ['Urban Planning', 'Engineering'],
        ['Surveying Engineering', 'Engineering'],

        // Agriculture
        ['NORM (Natural Resource Management)', 'Agriculture'],
        ['Plant Science', 'Agriculture'],
        ['Animal Science', 'Agriculture'],
        ['Veterinary Medicine', 'Agriculture'],
        ['Rural Development', 'Agriculture'],

        // Health
        ['Nursing', 'Health'],
        ['Midwifery', 'Health'],
        ['Public Health', 'Health'],

        // Natural Sciences
        ['Biology', 'Natural Science'],
        ['Chemistry', 'Natural Science'],
        ['Physics', 'Natural Science'],
        ['Mathematics', 'Natural Science'],
        ['Statistics', 'Natural Science'],

        // Social Sciences
        ['English Language and Literature', 'Social Science'],
        ['Amharic Language and Literature', 'Social Science'],
        ['Geography', 'Social Science'],
        ['History', 'Social Science'],
        ['Sociology', 'Social Science'],
        ['Psychology', 'Social Science'],
        ['Journalism and Communication', 'Social Science'],
        ['Sport Science', 'Social Science'],
        ['Tourism and Hospitality Management', 'Social Science']
      ];

      const insD = db.prepare(`INSERT INTO departments (name, faculty) VALUES (?, ?)`);
      departments.forEach(d => insD.run(d[0], d[1]));
      insD.finalize();
      console.log(`✅ ${departments.length} departments inserted.`);
    } else {
      console.log(`📂 Departments already exist (${row.c} found).`);
    }
  });

  // =========================================================
  // ✅ ALWAYS SEED COURSES IF EMPTY
  // =========================================================
  db.get(`SELECT COUNT(*) AS c FROM courses`, (err, row) => {
    if (err || row.c > 0) return;

    const courses = [
      [1, 'Data Structures and Algorithms', 'CS201'],
      [1, 'Database Systems', 'CS301'],
      [1, 'Operating Systems', 'CS302'],
      [1, 'Computer Networks', 'CS303'],
      [2, 'Software Design and Architecture', 'SE301'],
      [2, 'Software Testing', 'SE302'],
      [3, 'Systems Analysis and Design', 'IS301'],
      [6, 'Principles of Management', 'MGT101'],
      [6, 'Strategic Management', 'MGT401'],
      [7, 'Financial Accounting', 'ACC201'],
      [7, 'Cost Accounting', 'ACC301'],
      [8, 'Marketing Management', 'MKT301'],
      [8, 'Consumer Behavior', 'MKT302'],
      [15, 'Structural Analysis', 'CE301'],
      [15, 'Reinforced Concrete Design', 'CE302'],
      [16, 'Electrical Circuits', 'EE201'],
      [16, 'Power Systems', 'EE301'],
      [30, 'Fundamentals of Nursing', 'NUR101'],
      [34, 'General Biology', 'BIO101'],
      [37, 'Calculus I', 'MATH101']
    ];
    const insC = db.prepare(`INSERT INTO courses (department_id, course_name, course_code) VALUES (?, ?, ?)`);
    courses.forEach(c => insC.run(c[0], c[1], c[2]));
    insC.finalize();
    console.log(`✅ ${courses.length} sample courses inserted.`);
  });

  // =========================================================
  // ✅ ALWAYS SEED QUESTIONS IF EMPTY
  // =========================================================
  db.get(`SELECT COUNT(*) AS c FROM questions`, (err, row) => {
    if (err || row.c > 0) return;

    const questions = [
      [1, 'What is the time complexity of binary search?',
        'O(n)', 'O(log n)', 'O(n log n)', 'O(1)', 'B',
        'Binary search halves the search space each step → O(log n).'],
      [1, 'Which data structure uses FIFO?',
        'Stack', 'Queue', 'Tree', 'Graph', 'B', 'Queue = First In First Out.'],
      [1, 'A stack follows which principle?',
        'FIFO', 'LIFO', 'Random', 'Priority', 'B', 'Stack = Last In First Out.'],
      [2, 'What does SQL stand for?',
        'Structured Query Language', 'Simple Query Language',
        'Standard Question Language', 'System Query Logic', 'A',
        'SQL = Structured Query Language.'],
      [2, 'Which is a primary key property?',
        'Can be NULL', 'Must be unique', 'Can repeat', 'Always text', 'B',
        'Primary keys must be unique and not NULL.'],
      [8, 'Which is NOT a function of management?',
        'Planning', 'Organizing', 'Coding', 'Controlling', 'C', 'Coding is programming.'],
      [8, 'Who is the father of scientific management?',
        'Peter Drucker', 'Frederick Taylor', 'Henri Fayol', 'Max Weber', 'B',
        'Frederick Winslow Taylor.'],
      [12, 'What are the 4 Ps of marketing?',
        'Product, Price, Place, Promotion', 'People, Process, Product, Price',
        'Plan, Price, Product, Place', 'Product, Profit, Place, People', 'A',
        'Classic marketing mix.'],
      [12, 'What is a target market?',
        'All people', 'A specific group of consumers',
        'Only rich people', 'Government only', 'B', 'Specific consumer group.'],
      [15, 'Which force acts along the axis of a member?',
        'Shear', 'Bending', 'Axial', 'Torsion', 'C', 'Axial force along axis.'],
      [16, 'Ohm\u2019s law states that:',
        'V = IR', 'V = I/R', 'V = R/I', 'V = I\u00B2R', 'A',
        'Voltage = Current × Resistance.'],
      [30, 'Normal adult body temperature is approximately:',
        '32\u00B0C', '37\u00B0C', '40\u00B0C', '35\u00B0C', 'B', '≈ 37°C.'],
      [34, 'The powerhouse of the cell is:',
        'Nucleus', 'Ribosome', 'Mitochondria', 'Golgi', 'C', 'Mitochondria make ATP.'],
      [37, 'The derivative of sin(x) is:',
        'cos(x)', '-cos(x)', 'sin(x)', '-sin(x)', 'A', 'd/dx sin x = cos x.']
    ];
    const insQ = db.prepare(`INSERT INTO questions 
      (course_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    questions.forEach(q => insQ.run(...q));
    insQ.finalize();
    console.log(`✅ ${questions.length} sample questions inserted.`);
  });

  // =========================================================
  // ✅ ALWAYS ENSURE DEFAULT ADMIN EXISTS
  // =========================================================
  db.get(`SELECT * FROM users WHERE username = 'admin'`, (err, row) => {
    if (!row) {
      const hash = bcrypt.hashSync('admin123', 10);
      db.run(`INSERT INTO users (full_name, username, password, is_admin, paid)
              VALUES (?, ?, ?, 1, 1)`,
        ['Administrator', 'admin', hash]);
      console.log('👤 Default admin created: admin / admin123');
    }
  });
});

module.exports = db;