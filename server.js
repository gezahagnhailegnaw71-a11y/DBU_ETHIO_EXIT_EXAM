// server.js — Express backend with payment validation
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;
const SECRET = 'dbu-exit-exam-secret-key-change-in-production';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// ---------- AUTH MIDDLEWARE ----------
function auth(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ---------- PAYMENT VALIDATION ----------
function validatePayment(method, ref) {
  if (!ref || !method) return { ok: false, error: 'Payment method and reference required.' };
  ref = ref.trim();

  if (method === 'telebirr') {
    // Telebirr (Ethio Telecom): must be 10–12 digits
    if (!/^\d{10,12}$/.test(ref)) {
      return { ok: false, error: '❌ Telebirr reference must be 10–12 digits (e.g. 0911234567).' };
    }
    return { ok: true };
  }

  if (method === 'cbe') {
    // CBE Birr: exactly 13 digits and must start with 1000
    if (!/^1000\d{9}$/.test(ref)) {
      return { ok: false, error: '❌ CBE reference must be 13 digits starting with 1000 (e.g. 1000123456789).' };
    }
    return { ok: true };
  }

  return { ok: false, error: '❌ Invalid payment method. Choose Telebirr or CBE.' };
}

// ---------- REGISTER + PAYMENT ----------
app.post('/api/register', (req, res) => {
  const { full_name, username, password, department_id, payment_method, payment_ref } = req.body;

  // --- validation ---
  if (!full_name || !username || !password || !department_id || !payment_method || !payment_ref) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: '❌ Password must be at least 8 characters.' });
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: '❌ Username must be 3–20 characters (letters, numbers, _).' });
  }

  const payCheck = validatePayment(payment_method, payment_ref);
  if (!payCheck.ok) {
    return res.status(400).json({ error: payCheck.error });
  }

  const hash = bcrypt.hashSync(password, 10);
  const paid = 1; // payment verified

  db.run(`INSERT INTO users 
          (full_name, username, password, department_id, payment_method, payment_ref, paid)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [full_name, username, hash, department_id, payment_method, payment_ref, paid],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: '❌ Username already taken. Choose another.' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({
        success: true,
        message: '✅ Payment verified (100 Birr). Account created! Please log in.',
        user_id: this.lastID
      });
    });
});

// ---------- LOGIN ----------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err || !user) return res.status(401).json({ error: '❌ Invalid username or password.' });
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: '❌ Invalid username or password.' });
    }
    if (!user.paid && !user.is_admin) {
      return res.status(403).json({ error: '❌ Payment not completed.' });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, is_admin: user.is_admin },
      SECRET, { expiresIn: '7d' }
    );
    res.json({
      success: true, token,
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        department_id: user.department_id,
        is_admin: user.is_admin
      }
    });
  });
});

// ---------- GET ALL DEPARTMENTS ----------
app.get('/api/departments', (req, res) => {
  db.all(`SELECT * FROM departments ORDER BY faculty, name`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ---------- GET COURSES BY DEPARTMENT ----------
app.get('/api/departments/:id/courses', (req, res) => {
  db.all(`SELECT * FROM courses WHERE department_id = ? ORDER BY course_name`,
    [req.params.id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
});

// ---------- GET QUESTIONS FOR A COURSE ----------
app.get('/api/courses/:id/questions', auth, (req, res) => {
  db.all(`SELECT * FROM questions WHERE course_id = ?`, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ---------- SUBMIT RESULT ----------
app.post('/api/results', auth, (req, res) => {
  const { course_id, score, total } = req.body;
  db.run(`INSERT INTO results (user_id, course_id, score, total) VALUES (?, ?, ?, ?)`,
    [req.user.id, course_id, score, total],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, result_id: this.lastID });
    });
});

// ---------- MY RESULTS ----------
app.get('/api/my-results', auth, (req, res) => {
  db.all(`SELECT r.*, c.course_name FROM results r
          JOIN courses c ON c.id = r.course_id
          WHERE r.user_id = ? ORDER BY r.taken_at DESC`,
    [req.user.id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
});

// ---------- SERVE FRONTEND ----------
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

app.listen(PORT, () => {
  console.log(`\n🎓 DBU Exit Exam Server running at http://localhost:${PORT}\n`);
});