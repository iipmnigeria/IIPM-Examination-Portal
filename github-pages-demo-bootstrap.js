(function () {
  'use strict';

  if (!window.location.hostname.endsWith('github.io')) return;
  if (window.__AURA_DEMO_BOOTSTRAP_ACTIVE__) return;
  window.__AURA_DEMO_BOOTSTRAP_ACTIVE__ = true;

  var nativeFetch = window.fetch.bind(window);
  var USERS_KEY = 'aura_demo_users_v2';
  var ATTEMPTS_KEY = 'aura_demo_attempts_v2';

  var defaultUsers = [
    {
      id: 'admin_default',
      name: 'Administrator',
      email: 'admin@iipm.org',
      role: 'admin',
      username: 'admin',
      password: 'iipmadmin'
    },
    {
      id: 'student_demo',
      name: 'Obinna Nwosu',
      email: 'obinna@iipm.org',
      role: 'student',
      password: 'password123',
      pin: 'STU-2026'
    }
  ];

  var tests = [
    {
      id: 'hrmfc-101',
      title: 'Human Resource Management Foundation Certified (HRMFC)',
      course: 'HRMFC',
      durationMinutes: 10,
      questionCount: 5,
      description: 'Foundation assessment covering employee lifecycle, onboarding, job analysis, compliance and compensation.',
      questions: [
        {
          id: 'hrmfc-q1',
          text: 'What is the primary strategic objective of Human Resource Management?',
          options: [
            'To manage physical office facilities only.',
            'To align and optimize workforce capabilities to achieve organizational goals.',
            'To maintain computer networks.',
            'To produce advertising materials.'
          ],
          correctOptionIndex: 1
        },
        {
          id: 'hrmfc-q2',
          text: 'Which employee lifecycle stage integrates a new hire into culture, compliance and performance expectations?',
          options: ['Sourcing', 'Structured onboarding', 'Annual appraisal', 'Offboarding'],
          correctOptionIndex: 1
        },
        {
          id: 'hrmfc-q3',
          text: 'What is the main purpose of formal job analysis?',
          options: [
            'To evaluate competitors.',
            'To identify duties, responsibilities, skills and working conditions of a role.',
            'To schedule social events.',
            'To configure database servers.'
          ],
          correctOptionIndex: 1
        },
        {
          id: 'hrmfc-q4',
          text: 'Which compensation component is linked directly to performance achievements?',
          options: ['Fixed base salary', 'Variable incentive compensation', 'Pension contribution', 'Hourly attendance record'],
          correctOptionIndex: 1
        },
        {
          id: 'hrmfc-q5',
          text: 'Which approach provides a documented roadmap to help an underperforming employee meet expectations?',
          options: ['Immediate dismissal', 'Performance Improvement Plan', 'Salary reduction', 'Role abandonment'],
          correctOptionIndex: 1
        }
      ]
    },
    {
      id: 'ai-ml-101',
      title: 'Advanced AI & Machine Learning Foundations',
      course: 'AI-ML',
      durationMinutes: 10,
      questionCount: 5,
      description: 'Assessment covering neural networks, transformers, model evaluation and responsible AI.',
      questions: [
        {
          id: 'ai-q1',
          text: 'What does self-attention do in a Transformer model?',
          options: [
            'Processes tokens only one at a time.',
            'Weights how strongly each token relates to other tokens in the sequence.',
            'Compresses all embeddings into one number.',
            'Replaces the training dataset.'
          ],
          correctOptionIndex: 1
        },
        {
          id: 'ai-q2',
          text: 'Which loss function is commonly used for mutually exclusive multi-class classification?',
          options: ['Mean squared error', 'Categorical cross-entropy', 'Absolute error', 'Cosine similarity'],
          correctOptionIndex: 1
        },
        {
          id: 'ai-q3',
          text: 'A model scores very high on training data but poorly on validation data. What is this called?',
          options: ['Underfitting', 'Overfitting', 'Encryption', 'Tokenization'],
          correctOptionIndex: 1
        },
        {
          id: 'ai-q4',
          text: 'What does temperature control during language model generation?',
          options: ['GPU heat', 'Randomness of token selection', 'Context-window size', 'Network bandwidth'],
          correctOptionIndex: 1
        },
        {
          id: 'ai-q5',
          text: 'Which practice best supports responsible AI deployment?',
          options: ['Ignoring bias tests', 'Monitoring outcomes and documenting model limitations', 'Removing audit logs', 'Publishing private user data'],
          correctOptionIndex: 1
        }
      ]
    }
  ];

  function readJson(key, fallback) {
    try {
      var value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function users() {
    var stored = readJson(USERS_KEY, []);
    if (!Array.isArray(stored) || stored.length === 0) {
      writeJson(USERS_KEY, defaultUsers);
      return defaultUsers.slice();
    }
    return stored;
  }

  function attempts() {
    var stored = readJson(ATTEMPTS_KEY, []);
    return Array.isArray(stored) ? stored : [];
  }

  function json(data, status) {
    return Promise.resolve(new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  function parseBody(init) {
    try {
      return init && init.body ? JSON.parse(String(init.body)) : {};
    } catch (_) {
      return {};
    }
  }

  function publicTests() {
    return tests.map(function (test) {
      return {
        id: test.id,
        title: test.title,
        course: test.course,
        durationMinutes: test.durationMinutes,
        questionCount: test.questionCount,
        description: test.description,
        questions: test.questions.map(function (q) {
          return { id: q.id, text: q.text, options: q.options };
        })
      };
    });
  }

  function handleLogin(body) {
    var allUsers = users();
    if (body.role === 'admin') {
      var identifier = String(body.username || body.email || '').trim().toLowerCase();
      var admin = allUsers.find(function (u) {
        return u.role === 'admin' &&
          (String(u.username || '').toLowerCase() === identifier || String(u.email || '').toLowerCase() === identifier);
      });
      if (admin && admin.password === body.password) {
        return json({ success: true, role: 'admin', name: admin.name, email: admin.email });
      }
      return json({ success: false, error: 'Invalid auditor credentials.' }, 401);
    }

    if (body.name && String(body.name).trim().length >= 3) {
      return json({ success: true, role: 'student', name: String(body.name).trim() });
    }

    var email = String(body.email || '').trim().toLowerCase();
    var student = allUsers.find(function (u) {
      return u.role === 'student' && String(u.email || '').toLowerCase() === email;
    });
    if (student && student.password === body.password) {
      return json({ success: true, role: 'student', name: student.name, email: student.email });
    }
    return json({ success: false, error: 'Invalid candidate credentials.' }, 401);
  }

  function handleRegister(body) {
    var allUsers = users();
    var role = body.role === 'admin' ? 'admin' : 'student';
    var name = String(body.name || '').trim();
    var email = String(body.email || '').trim().toLowerCase();
    var password = String(body.password || '');

    if (name.length < 3 || email.indexOf('@') < 1 || password.length < 6) {
      return json({ success: false, error: 'Provide a valid name, email and password of at least six characters.' }, 400);
    }
    if (allUsers.some(function (u) { return String(u.email || '').toLowerCase() === email; })) {
      return json({ success: false, error: 'This email is already registered.' }, 400);
    }
    if (role === 'admin' && body.adminCode !== 'IIPM-ADMIN-2026') {
      return json({ success: false, error: 'Invalid auditor authorization code.' }, 403);
    }

    var account = {
      id: role + '_' + Date.now(),
      name: name,
      email: email,
      role: role,
      password: password,
      username: role === 'admin' ? String(body.username || '').trim().toLowerCase() : undefined,
      pin: role === 'student' ? String(body.pin || ('STU-' + String(Date.now()).slice(-6))) : undefined
    };
    allUsers.push(account);
    writeJson(USERS_KEY, allUsers);
    return json({ success: true, role: role, name: name, email: email });
  }

  function handleSubmit(body) {
    var test = tests.find(function (item) { return item.id === body.testId; });
    if (!test) return json({ error: 'Exam not found.' }, 404);

    var submittedAnswers = body.answers || {};
    var correct = test.questions.reduce(function (total, q) {
      return total + (submittedAnswers[q.id] === q.correctOptionIndex ? 1 : 0);
    }, 0);
    var score = Math.round((correct / test.questions.length) * 100);
    var logs = Array.isArray(body.logs) ? body.logs : [];
    var suspicious = Number(body.tabAwayCount || 0) * 12;
    logs.forEach(function (log) {
      suspicious += log.severity === 'high' ? 45 : log.severity === 'medium' ? 20 : 8;
    });
    suspicious = Math.min(100, Math.max(0, suspicious));

    var attempt = {
      id: 'attempt_demo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      studentName: String(body.studentName || 'Anonymous Student'),
      testId: test.id,
      testTitle: test.title,
      startTime: String(body.startTime || new Date().toISOString()),
      endTime: new Date().toISOString(),
      answers: submittedAnswers,
      score: score,
      logs: logs,
      status: suspicious >= 50 ? 'flagged' : 'submitted',
      suspiciousScore: suspicious
    };

    var allAttempts = attempts();
    allAttempts.unshift(attempt);
    writeJson(ATTEMPTS_KEY, allAttempts);
    return json(attempt);
  }

  function proctor(body) {
    var type = String(body.simType || 'none');
    var map = {
      multiple_people: ['multiple_people', 0.94, 'Demo proctor alert: a secondary person was detected.'],
      phone_detected: ['phone_detected', 0.98, 'Demo proctor alert: a mobile device was detected.'],
      looking_away: ['looking_away', 0.85, 'Demo proctor alert: sustained gaze away from the examination screen.'],
      notes_detected: ['notes_detected', 0.91, 'Demo proctor alert: notes or study material were detected.'],
      no_face: ['no_face', 0.99, 'Demo proctor alert: no candidate face was detected.']
    };
    if (map[type]) {
      return json({ isSuspicious: true, confidence: map[type][1], reason: map[type][2], detections: [map[type][0]] });
    }
    return json({ isSuspicious: false, confidence: 0.95, reason: 'GitHub Pages demo analysis: candidate frame appears normal.', detections: [] });
  }

  window.fetch = function (input, init) {
    var raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    var url = new URL(raw, window.location.href);
    var apiPosition = url.pathname.indexOf('/api/');
    if (apiPosition < 0) return nativeFetch(input, init);

    var path = url.pathname.slice(apiPosition);
    var method = String((init && init.method) || 'GET').toUpperCase();
    var body = parseBody(init);

    if (path === '/api/auth/login' && method === 'POST') return handleLogin(body);
    if (path === '/api/auth/register' && method === 'POST') return handleRegister(body);
    if (path === '/api/tests' && method === 'GET') return json(publicTests());
    if (path.indexOf('/api/tests/') === 0 && path !== '/api/tests/submit' && method === 'GET') {
      var id = decodeURIComponent(path.slice('/api/tests/'.length));
      var test = publicTests().find(function (item) { return item.id === id; });
      return test ? json(test) : json({ error: 'Exam not found.' }, 404);
    }
    if (path === '/api/tests/submit' && method === 'POST') return handleSubmit(body);
    if (path === '/api/attempts' && method === 'GET') {
      var nameFilter = String(url.searchParams.get('studentName') || '').trim().toLowerCase();
      var allAttempts = attempts();
      return json(nameFilter ? allAttempts.filter(function (a) { return String(a.studentName).trim().toLowerCase() === nameFilter; }) : allAttempts);
    }
    if (path === '/api/proctor/analyze' && method === 'POST') return proctor(body);

    return json({ error: 'Demo API route not found: ' + method + ' ' + path }, 404);
  };

  window.__AURA_DEMO_API__ = {
    active: true,
    version: '2026-07-19.3',
    mode: 'github-pages-local-demo'
  };
  console.info('AURA standalone GitHub Pages demo API enabled:', window.__AURA_DEMO_API__);
})();
