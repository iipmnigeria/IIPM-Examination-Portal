import { chrmpQuestions } from './chrmpQuestions';
import { chrmgQuestions } from './chrmgQuestions';
import type { Attempt, ProctorAnalysisResult, ProctorLogEvent, Test } from './types';

/**
 * GitHub Pages is a static host and cannot run the Express server in server.ts.
 * This adapter is enabled only on github.io and provides a browser-local demo API
 * so authentication, catalog loading, grading, attempts, and proctor simulations work.
 * Production deployments should set a permanent backend URL instead of relying on this mode.
 */

const IS_GITHUB_PAGES =
  typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');

const USERS_KEY = 'aura_demo_users_v1';
const ATTEMPTS_KEY = 'aura_demo_attempts_v1';

type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'admin';
  password?: string;
  username?: string;
  pin?: string;
};

const defaultUsers: DemoUser[] = [
  {
    id: 'user_admin_default',
    name: 'Administrator',
    email: 'admin@iipm.org',
    role: 'admin',
    username: 'admin',
    password: 'iipmadmin',
  },
  {
    id: 'user_student_demo',
    name: 'Obinna Nwosu',
    email: 'obinna@iipm.org',
    role: 'student',
    password: 'password123',
    pin: 'STU-2026',
  },
];

const examsDatabase: Test[] = [
  {
    id: 'ai-ml-101',
    title: 'Advanced AI & Machine Learning Foundations',
    course: 'CS-401 (Computer Science)',
    durationMinutes: 10,
    questionCount: 5,
    description:
      'This assessment evaluates supervised learning, neural networks, transformers, loss functions, and ethical bias in machine learning systems.',
    questions: [
      {
        id: 'q1',
        text: 'In neural networks, what is the primary cause of vanishing gradients, and how is it most effectively mitigated?',
        options: [
          'Using Sigmoid activation functions on extremely deep networks; mitigated by using ReLU/GELU activations and residual connections.',
          'High learning rates; mitigated by decreasing learning rate decay schedules.',
          'Small batch sizes; mitigated by implementing batch normalization and dropout layers.',
          'Overfitting; mitigated by adding L1 or L2 regularization parameters.',
        ],
        correctOptionIndex: 0,
      },
      {
        id: 'q2',
        text: 'What is the function of the Self-Attention mechanism in Transformer models?',
        options: [
          'It forces the model to ignore recurrent dependencies and processes tokens strictly sequentially.',
          'It calculates a dynamic weight representing how much each token should focus on every other token in the same sequence.',
          'It compresses token embeddings to speed up backpropagation.',
          'It serves as a linear layer that regularizes output probabilities.',
        ],
        correctOptionIndex: 1,
      },
      {
        id: 'q3',
        text: 'Which loss function is best suited for mutually exclusive multi-class classification?',
        options: [
          'Mean Squared Error (MSE)',
          'Binary Cross-Entropy Loss',
          'Categorical Cross-Entropy Loss',
          'Hinge Loss',
        ],
        correctOptionIndex: 2,
      },
      {
        id: 'q4',
        text: 'A model scores 99.2% on training data but 64.5% on validation data. What is this condition and a standard remedy?',
        options: [
          'Underfitting; increase training duration.',
          'Overfitting; add regularization or collect more varied training data.',
          'Data leakage; reshuffle the split dynamically.',
          'Exploding gradients; apply gradient clipping.',
        ],
        correctOptionIndex: 1,
      },
      {
        id: 'q5',
        text: 'In LLMs, what does the Temperature parameter control during generation?',
        options: [
          'The physical GPU temperature.',
          'The size of the context window.',
          'The randomness of the generated token probability distribution.',
          'The absolute sequence length limit.',
        ],
        correctOptionIndex: 2,
      },
    ],
  },
  {
    id: 'cyber-sec-201',
    title: 'Cybersecurity & Cryptography Fundamentals',
    course: 'SEC-210 (Information Security)',
    durationMinutes: 10,
    questionCount: 5,
    description:
      'This examination tests cryptography, modern threat vectors, access controls, and zero-trust architecture.',
    questions: [
      {
        id: 'sec1',
        text: 'What is the fundamental difference between symmetric and asymmetric cryptography?',
        options: [
          'Symmetric uses the same key for encryption and decryption; asymmetric uses a public-private key pair.',
          'Symmetric is used only for data in transit; asymmetric is only for backups.',
          'Symmetric is slow; asymmetric is exceptionally fast.',
          'Symmetric relies on quantum entanglement; asymmetric relies on prime factorization only.',
        ],
        correctOptionIndex: 0,
      },
      {
        id: 'sec2',
        text: 'How does a Cross-Site Request Forgery attack operate, and what is its standard defense?',
        options: [
          'It injects scripts into database strings; defend with HTML entities.',
          'It tricks an authenticated browser into executing an unauthorized command; defend with anti-CSRF tokens and SameSite cookies.',
          'It intercepts Wi-Fi packets; defend only with TLS.',
          'It floods servers with half-open connections; defend with reverse proxies only.',
        ],
        correctOptionIndex: 1,
      },
      {
        id: 'sec3',
        text: 'What is the primary objective of Zero Trust Architecture?',
        options: [
          'Remove all firewalls.',
          'Eliminate all passwords.',
          'Continuously apply never trust, always verify, regardless of network location.',
          'Encrypt only public database columns.',
        ],
        correctOptionIndex: 2,
      },
      {
        id: 'sec4',
        text: 'Which is the most robust defense against SQL injection?',
        options: [
          'Client-side regex only.',
          'Parameterized queries or prepared statements.',
          'Read-only connections only.',
          'Base64 encoding all search queries.',
        ],
        correctOptionIndex: 1,
      },
      {
        id: 'sec5',
        text: 'What is the purpose of salting a password before hashing it?',
        options: [
          'Increase hashing speed.',
          'Make the password reversible.',
          'Add unique random data so identical passwords produce different hashes and resist rainbow tables.',
          'Compress database records.',
        ],
        correctOptionIndex: 2,
      },
    ],
  },
  {
    id: 'ethics-swe-301',
    title: 'Professional Software Engineering Ethics',
    course: 'SWE-302 (Professional Practice)',
    durationMinutes: 8,
    questionCount: 5,
    description:
      'This exam evaluates ethical decision-making, intellectual property, privacy, whistleblowing, and professional conduct.',
    questions: [
      {
        id: 'eth1',
        text: 'What is an engineer’s primary responsibility after discovering a severe safety vulnerability?',
        options: [
          'Ignore it until a manager creates a ticket.',
          'Disclose it immediately on social media.',
          'Report it clearly to those authorized to act and advocate for user safety.',
          'Patch it silently in a later release.',
        ],
        correctOptionIndex: 2,
      },
      {
        id: 'eth2',
        text: 'Which license is a strong copyleft license?',
        options: ['MIT', 'Apache 2.0', 'GNU GPLv3', 'BSD 3-Clause'],
        correctOptionIndex: 2,
      },
      {
        id: 'eth3',
        text: 'What is the ethical concern regarding dark patterns in interface design?',
        options: [
          'They consume too much battery.',
          'They manipulate users into actions contrary to their intentions or interests.',
          'They do not support dark themes.',
          'They restrict grid layouts.',
        ],
        correctOptionIndex: 1,
      },
      {
        id: 'eth4',
        text: 'How does the GDPR right to erasure affect application database design?',
        options: [
          'Delete every audit log daily.',
          'Support secure deletion of personal data unless a lawful exemption applies.',
          'Never write user data to disk.',
          'Rotate password hashes every two months.',
        ],
        correctOptionIndex: 1,
      },
      {
        id: 'eth5',
        text: 'Secretly prioritizing affiliate products against user filters directly violates which duty?',
        options: [
          'Scalability standards.',
          'Transparency and avoidance of deceptive representations.',
          'Encryption compliance.',
          'Apache Foundation guidelines.',
        ],
        correctOptionIndex: 1,
      },
    ],
  },
  {
    id: 'hrmfc-101',
    title: 'Human Resource Management Foundation Certified (HRMFC)',
    course: 'HRMFC',
    durationMinutes: 10,
    questionCount: 5,
    description:
      'This foundation assessment evaluates employee lifecycles, onboarding, legal compliance, job analysis, and compensation models.',
    questions: [
      {
        id: 'hrmfc-q1',
        text: 'What is the primary strategic objective of Human Resource Management?',
        options: [
          'Manage office supplies.',
          'Align and optimize human capital and workforce capabilities to achieve organizational goals.',
          'Oversee network infrastructure.',
          'Handle external customer sales.',
        ],
        correctOptionIndex: 1,
      },
      {
        id: 'hrmfc-q2',
        text: 'Which employee lifecycle stage integrates a new hire into culture, compliance, and performance expectations?',
        options: [
          'Sourcing',
          'Structured onboarding',
          'Annual appraisal',
          'Offboarding',
        ],
        correctOptionIndex: 1,
      },
      {
        id: 'hrmfc-q3',
        text: 'What does at-will employment generally mean?',
        options: [
          'A mandatory five-year term.',
          'Either party may terminate at any time for a lawful reason, subject to applicable law.',
          'Employees authorize all budgets.',
          'Government sets every salary review.',
        ],
        correctOptionIndex: 1,
      },
      {
        id: 'hrmfc-q4',
        text: 'What is the primary purpose of formal job analysis?',
        options: [
          'Analyze competitors.',
          'Define duties, responsibilities, required skills, and working conditions of a role.',
          'Organize retreats.',
          'Optimize database load balancing.',
        ],
        correctOptionIndex: 1,
      },
      {
        id: 'hrmfc-q5',
        text: 'Which compensation component directly links payout to performance?',
        options: [
          'Fixed hourly wage',
          'Variable incentive compensation',
          'Flat base salary',
          'Pension plan',
        ],
        correctOptionIndex: 1,
      },
    ],
  },
  {
    id: 'chrmg-201',
    title: 'Certified Human Resource Management Generalist (CHRMG)',
    course: 'CHRMG',
    durationMinutes: 60,
    questionCount: 50,
    description:
      'This assessment covers employee relations, SMART goals, total rewards, conflict resolution, and performance improvement.',
    questions: chrmgQuestions,
  },
  {
    id: 'chrmp-301',
    title: 'Certified Human Resource Management Professional (CHRMP)',
    course: 'CHRMP',
    durationMinutes: 120,
    questionCount: 75,
    description:
      'This advanced examination validates proficiency in strategic HRM, succession planning, analytics, change management, and human-capital alignment.',
    questions: chrmpQuestions,
  },
];

function loadUsers(): DemoUser[] {
  try {
    const saved = localStorage.getItem(USERS_KEY);
    if (saved) return JSON.parse(saved) as DemoUser[];
  } catch {
    // Ignore corrupted browser demo storage and restore defaults.
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
  return [...defaultUsers];
}

function saveUsers(users: DemoUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function loadAttempts(): Attempt[] {
  try {
    const saved = localStorage.getItem(ATTEMPTS_KEY);
    return saved ? (JSON.parse(saved) as Attempt[]) : [];
  } catch {
    return [];
  }
}

function saveAttempts(attempts: Attempt[]): void {
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-AURA-Demo-Mode': 'github-pages',
    },
  });
}

function parseBody(init?: RequestInit): Record<string, any> {
  if (!init?.body || typeof init.body !== 'string') return {};
  try {
    return JSON.parse(init.body) as Record<string, any>;
  } catch {
    return {};
  }
}

function sanitizedTests(): Test[] {
  return examsDatabase.map((exam) => ({
    ...exam,
    questions: exam.questions.map(({ correctOptionIndex: _hidden, ...question }) =>
      question as typeof exam.questions[number],
    ),
  }));
}

function handleLogin(payload: Record<string, any>): Response {
  const users = loadUsers();
  if (payload.role === 'admin') {
    const identifier = String(payload.username || payload.email || '').trim().toLowerCase();
    const user = users.find(
      (candidate) =>
        candidate.role === 'admin' &&
        (candidate.username?.toLowerCase() === identifier ||
          candidate.email.toLowerCase() === identifier),
    );
    if (user && user.password === payload.password) {
      return jsonResponse({ success: true, role: 'admin', name: user.name, email: user.email });
    }
    return jsonResponse({ success: false, error: 'Invalid auditor identification or security key.' }, 401);
  }

  if (payload.email && payload.password) {
    const email = String(payload.email).trim().toLowerCase();
    const user = users.find(
      (candidate) => candidate.role === 'student' && candidate.email.toLowerCase() === email,
    );
    if (user && user.password === payload.password) {
      return jsonResponse({ success: true, role: 'student', name: user.name, email: user.email });
    }
    return jsonResponse({ success: false, error: 'Invalid candidate credentials.' }, 401);
  }

  const name = String(payload.name || '').trim();
  if (name.length < 3) {
    return jsonResponse({ success: false, error: 'Valid candidate legal name is required.' }, 400);
  }

  let user = users.find(
    (candidate) => candidate.role === 'student' && candidate.name.toLowerCase() === name.toLowerCase(),
  );
  if (!user) {
    user = {
      id: `student_demo_${Date.now()}`,
      name,
      email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')}@demo.local`,
      role: 'student',
    };
    users.push(user);
    saveUsers(users);
  }
  return jsonResponse({ success: true, role: 'student', name: user.name, email: user.email });
}

function handleRegister(payload: Record<string, any>): Response {
  const users = loadUsers();
  const role = payload.role as 'student' | 'admin';
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');

  if (!['student', 'admin'].includes(role)) {
    return jsonResponse({ success: false, error: 'Valid user role is required.' }, 400);
  }
  if (name.length < 3 || !email.includes('@') || password.length < 6) {
    return jsonResponse({ success: false, error: 'Provide a valid name, email, and password of at least 6 characters.' }, 400);
  }
  if (users.some((user) => user.email.toLowerCase() === email)) {
    return jsonResponse({ success: false, error: 'This email is already registered.' }, 400);
  }

  if (role === 'admin') {
    const username = String(payload.username || '').trim().toLowerCase();
    if (String(payload.adminCode || '') !== 'IIPM-ADMIN-2026') {
      return jsonResponse({ success: false, error: 'Invalid auditor authorization code.' }, 400);
    }
    if (username.length < 3 || users.some((user) => user.username?.toLowerCase() === username)) {
      return jsonResponse({ success: false, error: 'A unique auditor username is required.' }, 400);
    }
    const user: DemoUser = {
      id: `admin_demo_${Date.now()}`,
      name,
      email,
      password,
      username,
      role: 'admin',
    };
    users.push(user);
    saveUsers(users);
    return jsonResponse({ success: true, role: 'admin', name, email });
  }

  const user: DemoUser = {
    id: `student_demo_${Date.now()}`,
    name,
    email,
    password,
    pin: String(payload.pin || `STU-${String(Date.now()).slice(-6)}`),
    role: 'student',
  };
  users.push(user);
  saveUsers(users);
  return jsonResponse({ success: true, role: 'student', name, email });
}

function handleSubmit(payload: Record<string, any>): Response {
  const exam = examsDatabase.find((item) => item.id === payload.testId);
  if (!exam) return jsonResponse({ error: 'Exam not found.' }, 404);

  const answers = (payload.answers || {}) as Record<string, number>;
  const logs = (payload.logs || []) as ProctorLogEvent[];
  const correctCount = exam.questions.reduce(
    (count, question) => count + (answers[question.id] === question.correctOptionIndex ? 1 : 0),
    0,
  );
  const score = Math.round((correctCount / exam.questions.length) * 100);

  let suspiciousScore = Number(payload.tabAwayCount || 0) * 12;
  for (const log of logs) {
    suspiciousScore += log.severity === 'high' ? 45 : log.severity === 'medium' ? 20 : 8;
  }
  suspiciousScore = Math.min(100, Math.max(0, suspiciousScore));

  const attempt: Attempt = {
    id: `attempt_demo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    studentName: String(payload.studentName || 'Anonymous Student'),
    testId: exam.id,
    testTitle: exam.title,
    startTime: String(payload.startTime || new Date().toISOString()),
    endTime: new Date().toISOString(),
    answers,
    score,
    logs,
    status: suspiciousScore >= 50 ? 'flagged' : 'submitted',
    suspiciousScore,
  };

  const attempts = loadAttempts();
  attempts.unshift(attempt);
  saveAttempts(attempts);
  return jsonResponse(attempt);
}

function proctorResult(simType: string): ProctorAnalysisResult {
  const simulations: Record<string, ProctorAnalysisResult> = {
    multiple_people: {
      isSuspicious: true,
      confidence: 0.94,
      reason: 'Demo proctor alert: a secondary person was detected in the frame.',
      detections: ['multiple_people'],
    },
    phone_detected: {
      isSuspicious: true,
      confidence: 0.98,
      reason: 'Demo proctor alert: a mobile device was detected.',
      detections: ['phone_detected'],
    },
    looking_away: {
      isSuspicious: true,
      confidence: 0.85,
      reason: 'Demo proctor alert: sustained gaze away from the examination screen.',
      detections: ['looking_away'],
    },
    notes_detected: {
      isSuspicious: true,
      confidence: 0.91,
      reason: 'Demo proctor alert: notes or study material were detected.',
      detections: ['notes_detected'],
    },
    no_face: {
      isSuspicious: true,
      confidence: 0.99,
      reason: 'Demo proctor alert: no candidate face was detected.',
      detections: ['no_face'],
    },
  };

  return simulations[simType] || {
    isSuspicious: false,
    confidence: 0.95,
    reason: 'GitHub Pages demo analysis: candidate frame appears normal.',
    detections: [],
  };
}

async function handleDemoApi(url: URL, init?: RequestInit): Promise<Response> {
  const method = String(init?.method || 'GET').toUpperCase();
  const path = url.pathname;
  const payload = parseBody(init);

  if (path === '/api/auth/login' && method === 'POST') return handleLogin(payload);
  if (path === '/api/auth/register' && method === 'POST') return handleRegister(payload);
  if (path === '/api/tests' && method === 'GET') return jsonResponse(sanitizedTests());

  if (path.startsWith('/api/tests/') && method === 'GET') {
    const id = decodeURIComponent(path.slice('/api/tests/'.length));
    const exam = sanitizedTests().find((item) => item.id === id);
    return exam ? jsonResponse(exam) : jsonResponse({ error: 'Exam not found.' }, 404);
  }

  if (path === '/api/tests/submit' && method === 'POST') return handleSubmit(payload);

  if (path === '/api/attempts' && method === 'GET') {
    const studentName = url.searchParams.get('studentName')?.trim().toLowerCase();
    const attempts = loadAttempts();
    return jsonResponse(
      studentName
        ? attempts.filter((attempt) => attempt.studentName.trim().toLowerCase() === studentName)
        : attempts,
    );
  }

  if (path === '/api/proctor/analyze' && method === 'POST') {
    return jsonResponse(proctorResult(String(payload.simType || 'none')));
  }

  return jsonResponse({ error: `Demo API route not found: ${method} ${path}` }, 404);
}

if (IS_GITHUB_PAGES) {
  const nativeFetch = window.fetch.bind(window);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const url = new URL(rawUrl, window.location.origin);

    if (url.pathname.startsWith('/api/')) {
      return handleDemoApi(url, init);
    }

    return nativeFetch(input, init);
  }) as typeof window.fetch;

  console.info('AURA GitHub Pages demo API enabled. Data is stored only in this browser.');
}
