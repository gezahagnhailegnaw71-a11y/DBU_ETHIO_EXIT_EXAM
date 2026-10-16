// app.js — frontend logic with validation
let token = localStorage.getItem('dbu_token') || null;
let currentUser = JSON.parse(localStorage.getItem('dbu_user') || 'null');
let currentQuestions = [];
let currentIndex = 0;
let currentScore = 0;
let currentCourseId = null;

// ---------- PAGE NAVIGATION ----------
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ---------- LOAD DEPARTMENTS + EVENT LISTENERS ----------
window.addEventListener('DOMContentLoaded', async () => {

  // Load all departments into dropdown
  const sel = document.getElementById('regDepartment');
  try {
    const res = await fetch('/api/departments');
    const depts = await res.json();
    sel.innerHTML = '<option value="">-- Select your department --</option>' +
      depts.map(d => `<option value="${d.id}">${d.name} (${d.faculty})</option>`).join('');
  } catch (e) {
    sel.innerHTML = '<option value="">❌ Could not load departments</option>';
  }

  // Password live hint
  const pwInput = document.getElementById('regPassword');
  const pwHint  = document.getElementById('pwHint');
  pwInput.addEventListener('input', () => {
    if (pwInput.value.length === 0) { pwHint.textContent = ''; return; }
    if (pwInput.value.length < 8) {
      pwHint.textContent = `❌ Too short (${pwInput.value.length}/8 characters)`;
      pwHint.style.color = 'red';
    } else {
      pwHint.textContent = `✅ Good (${pwInput.value.length} characters)`;
      pwHint.style.color = 'green';
    }
  });

  // Payment method toggle
  const paySel = document.getElementById('regPayMethod');
  paySel.addEventListener('change', () => {
    const t = document.getElementById('telebirrInfo');
    const c = document.getElementById('cbeInfo');
    const refInput = document.getElementById('regPaymentRef');
    if (paySel.value === 'telebirr') {
      t.style.display = 'block'; c.style.display = 'none';
      refInput.placeholder = 'e.g. 0911234567 (10–12 digits)';
    } else if (paySel.value === 'cbe') {
      t.style.display = 'none'; c.style.display = 'block';
      refInput.placeholder = 'e.g. 1000123456789 (13 digits, starts with 1000)';
    } else {
      t.style.display = 'none'; c.style.display = 'none';
      refInput.placeholder = 'Enter payment reference number';
    }
  });

  // Auto-login
  if (token && currentUser) {
    document.getElementById('welcomeUser').textContent = `Welcome, ${currentUser.full_name}`;
    loadCourses(currentUser.department_id);
    loadMyResults();
    showPage('dashboardPage');
  }
});

// ---------- REGISTER ----------
async function registerUser() {
  const full_name      = document.getElementById('regFullName').value.trim();
  const username       = document.getElementById('regUsername').value.trim();
  const password       = document.getElementById('regPassword').value;
  const department_id  = document.getElementById('regDepartment').value;
  const payment_method = document.getElementById('regPayMethod').value;
  const payment_ref    = document.getElementById('regPaymentRef').value.trim();

  const msg = document.getElementById('regMsg');

  // Frontend validation
  if (!full_name) return showMsg(msg, '❌ Please enter your full name.', 'red');
  if (!username)  return showMsg(msg, '❌ Please enter a username.', 'red');
  if (password.length < 8) return showMsg(msg, '❌ Password must be at least 8 characters.', 'red');
  if (!department_id) return showMsg(msg, '❌ Please select your department.', 'red');
  if (!payment_method) return showMsg(msg, '❌ Please choose a payment method.', 'red');
  if (!payment_ref) return showMsg(msg, '❌ Please enter the payment reference.', 'red');

  // Payment format validation (client-side)
  if (payment_method === 'telebirr' && !/^\d{10,12}$/.test(payment_ref)) {
    return showMsg(msg, '❌ Telebirr reference must be 10–12 digits.', 'red');
  }
  if (payment_method === 'cbe' && !/^1000\d{9}$/.test(payment_ref)) {
    return showMsg(msg, '❌ CBE reference must be 13 digits starting with 1000.', 'red');
  }

  showMsg(msg, '⏳ Registering...', '#2563eb');

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name, username, password, department_id, payment_method, payment_ref
      })
    });
    const data = await res.json();

    if (data.success) {
      showMsg(msg, data.message, 'green');
      setTimeout(() => {
        showPage('loginPage');
        document.getElementById('loginUsername').value = username;
      }, 1800);
    } else {
      showMsg(msg, '❌ ' + data.error, 'red');
    }
  } catch (e) {
    showMsg(msg, '❌ Network error. Is the server running?', 'red');
  }
}

function showMsg(el, text, color) {
  el.textContent = text;
  el.style.color = color;
}

// ---------- LOGIN ----------
async function loginUser() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const msg = document.getElementById('loginMsg');

  if (!username || !password) return showMsg(msg, '❌ Enter username and password.', 'red');

  showMsg(msg, '⏳ Logging in...', '#2563eb');

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success) {
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('dbu_token', token);
      localStorage.setItem('dbu_user', JSON.stringify(currentUser));

      document.getElementById('welcomeUser').textContent = `Welcome, ${currentUser.full_name}`;
      loadCourses(currentUser.department_id);
      loadMyResults();
      showPage('dashboardPage');
    } else {
      showMsg(msg, '❌ ' + data.error, 'red');
    }
  } catch (e) {
    showMsg(msg, '❌ Network error.', 'red');
  }
}

// ---------- LOGOUT ----------
function logout() {
  token = null; currentUser = null;
  localStorage.removeItem('dbu_token');
  localStorage.removeItem('dbu_user');
  showPage('homePage');
}

// ---------- LOAD COURSES ----------
async function loadCourses(deptId) {
  const res = await fetch(`/api/departments/${deptId}/courses`);
  const courses = await res.json();
  const list = document.getElementById('coursesList');

  if (!courses.length) {
    list.innerHTML = '<p>No courses available for your department yet. Admin can add them later.</p>';
    return;
  }

  list.innerHTML = courses.map(c => `
    <div class="course-card" onclick="startExam(${c.id}, '${c.course_name.replace(/'/g, "\\'")}')">
      <h4>${c.course_name}</h4>
      <small>${c.course_code || ''}</small>
    </div>
  `).join('');
}

// ---------- START EXAM ----------
async function startExam(courseId, courseName) {
  currentCourseId = courseId;
  currentIndex = 0;
  currentScore = 0;

  const res = await fetch(`/api/courses/${courseId}/questions`, {
    headers: { 'authorization': token }
  });
  currentQuestions = await res.json();

  if (!currentQuestions.length) {
    alert('No questions in this course yet.');
    return;
  }

  document.getElementById('examTitle').textContent = `📝 ${courseName}`;
  showPage('examPage');
  renderQuestion();
}

// ---------- RENDER QUESTION ----------
function renderQuestion() {
  const q = currentQuestions[currentIndex];
  document.getElementById('examProgress').textContent =
    `Question ${currentIndex + 1} of ${currentQuestions.length}`;

  document.getElementById('questionBox').innerHTML = `
    <h3>${currentIndex + 1}. ${q.question_text}</h3>
    <button class="option" onclick="answer('A', this)">A) ${q.option_a}</button>
    <button class="option" onclick="answer('B', this)">B) ${q.option_b}</button>
    <button class="option" onclick="answer('C', this)">C) ${q.option_c}</button>
    <button class="option" onclick="answer('D', this)">D) ${q.option_d}</button>
    <p id="feedback" style="margin-top:14px;font-weight:600"></p>
    <button class="btn primary" id="nextBtn" style="display:none;margin-top:16px" onclick="nextQuestion()">Next →</button>
  `;
}

// ---------- ANSWER ----------
function answer(choice, el) {
  document.querySelectorAll('.option').forEach(o => o.disabled = true);
  const q = currentQuestions[currentIndex];
  const feedback = document.getElementById('feedback');

  if (choice === q.correct_answer) {
    currentScore++;
    el.style.background = '#dcfce7';
    el.style.borderColor = 'green';
    feedback.textContent = '✅ Correct!';
    feedback.style.color = 'green';
  } else {
    el.style.background = '#fee2e2';
    el.style.borderColor = 'red';
    feedback.textContent = `❌ Wrong. Correct answer: ${q.correct_answer}. ${q.explanation || ''}`;
    feedback.style.color = 'red';
  }

  document.getElementById('nextBtn').style.display = 'inline-block';
}

// ---------- NEXT ----------
function nextQuestion() {
  currentIndex++;
  if (currentIndex < currentQuestions.length) {
    renderQuestion();
  } else {
    finishExam();
  }
}

// ---------- FINISH ----------
async function finishExam() {
  await fetch('/api/results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'authorization': token },
    body: JSON.stringify({
      course_id: currentCourseId,
      score: currentScore,
      total: currentQuestions.length
    })
  });

  const pct = (currentScore * 100 / currentQuestions.length).toFixed(1);
  document.getElementById('resultScore').textContent =
    `Score: ${currentScore} / ${currentQuestions.length} (${pct}%)`;
  document.getElementById('resultMsg').textContent =
    pct >= 75 ? '🎉 PASS — Great job!' : '⚠️ Keep practicing. Target: 75%';
  showPage('resultPage');
  loadMyResults();
}

// ---------- MY RESULTS ----------
async function loadMyResults() {
  const res = await fetch('/api/my-results', { headers: { 'authorization': token } });
  const rows = await res.json();
  const box = document.getElementById('myResults');
  if (!rows.length) { box.innerHTML = '<p>No practice results yet.</p>'; return; }
  box.innerHTML = `<table style="width:100%;background:white;border-radius:8px;padding:10px">
    <tr style="text-align:left"><th>Course</th><th>Score</th><th>Date</th></tr>
    ${rows.map(r => `<tr>
      <td>${r.course_name}</td>
      <td>${r.score}/${r.total}</td>
      <td>${(r.taken_at || '').split(' ')[0]}</td>
    </tr>`).join('')}
  </table>`;
}