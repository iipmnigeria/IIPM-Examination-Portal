import { Test } from './types';
import { chrmpQuestions } from './chrmpQuestions';
import { chrmgQuestions } from './chrmgQuestions';
import { pmQuestions } from './pmQuestions';
import { pcitQuestions } from './pcitQuestions';
import { rmpQuestions } from './rmpQuestions';
import { qmpQuestions } from './qmpQuestions';
import { pcmQuestions } from './pcmQuestions';

export const fallbackExams: Test[] = [
  {
    id: 'ai-ml-101',
    title: 'Advanced AI & Machine Learning Foundations',
    course: 'CS-401 (Computer Science)',
    durationMinutes: 10,
    questionCount: 5,
    description: 'This assessment evaluates your understanding of supervised learning algorithms, neural network design, LLM transformers, loss functions, and ethical bias in machine learning systems. Under strict real-time AI proctoring.',
    questions: [
      {
        id: 'q1',
        text: 'In neural networks, what is the primary cause of vanishing gradients, and how is it most effectively mitigated?',
        options: [
          'Using Sigmoid activation functions on extremely deep networks; mitigated by using ReLU/GELU activations and residual connections.',
          'High learning rates; mitigated by decreasing learning rate decay schedules.',
          'Small batch sizes; mitigated by implementing batch normalization and dropout layers.',
          'Overfitting; mitigated by adding L1 or L2 regularization parameters.'
        ],
        correctOptionIndex: 0
      },
      {
        id: 'q2',
        text: 'What is the function of the "Self-Attention" mechanism in Transformer models?',
        options: [
          'It forces the model to ignore recurrent dependencies and processes tokens strictly sequentially.',
          'It calculates a dynamic weight representing how much each token in a sequence should focus on every other token in the same sequence.',
          'It compresses the dimensions of token embeddings to speed up gradient descent backpropagation.',
          'It serves as a linear layer that regularizes output probabilities to reduce text generation repetition.'
        ],
        correctOptionIndex: 1
      },
      {
        id: 'q3',
        text: 'Which loss function is mathematically best suited for multi-class classification where classes are mutually exclusive?',
        options: [
          'Mean Squared Error (MSE)',
          'Binary Cross-Entropy Loss',
          'Categorical Cross-Entropy Loss',
          'Hinge Loss'
        ],
        correctOptionIndex: 2
      },
      {
        id: 'q4',
        text: 'You notice your machine learning model performs exceptionally well on training data (99.2% accuracy) but poorly on validation data (64.5% accuracy). What is this condition called, and what is a standard remedy?',
        options: [
          'Underfitting; remedy by increasing the training duration and expanding learning rate parameters.',
          'Overfitting; remedy by adding regularization (dropout, weight decay) or collecting more varied training data.',
          'Data Leakage; remedy by re-shuffling the train-validation split index dynamically.',
          'Exploding Gradients; remedy by applying gradient clipping or batch optimization.'
        ],
        correctOptionIndex: 1
      },
      {
        id: 'q5',
        text: 'In LLMs, what does the "Temperature" parameter control during text decoding/generation?',
        options: [
          'The processing temperature of the physical GPU/TPU cluster nodes.',
          'The size of the context window or token history buffer.',
          'The randomness or entropy of the generated token probability distribution.',
          'The absolute sequence length limit of generated sentences.'
        ],
        correctOptionIndex: 2
      }
    ]
  },
  {
    id: 'cyber-sec-201',
    title: 'Cybersecurity & Cryptography Fundamentals',
    course: 'SEC-210 (Information Security)',
    durationMinutes: 10,
    questionCount: 5,
    description: 'This examination tests critical competence in symmetric and asymmetric cryptography, modern threat vectors (XSS, CSRF, SQLi), access controls, and zero-trust framework mechanics. Proctored via active webcam feeds.',
    questions: [
      {
        id: 'sec1',
        text: 'What is the fundamental difference between Symmetric and Asymmetric cryptography?',
        options: [
          'Symmetric uses the same key for encryption and decryption; Asymmetric uses a mathematically linked public-private key pair.',
          'Symmetric is used only for data in transit; Asymmetric is strictly used for encrypting local database storage backups.',
          'Symmetric is slow but highly secure; Asymmetric is exceptionally fast but prone to rainbow table attacks.',
          'Symmetric relies on quantum entanglement properties; Asymmetric relies on high prime factorization complexity.'
        ],
        correctOptionIndex: 0
      },
      {
        id: 'sec2',
        text: 'How does a Cross-Site Request Forgery (CSRF) attack operate, and what is its standard defense?',
        options: [
          'It injects executable scripts into database strings; mitigated by using strict input HTML entity validation.',
          'It tricks an authenticated user\'s browser into executing an unauthorized command on a trusted web application; mitigated by anti-CSRF tokens and SameSite cookie attributes.',
          'It intercepts unencrypted packets over local Wi-Fi networks; mitigated by setting up TLS / SSL configurations.',
          'It floods servers with half-open TCP connections; mitigated by deploying reverse proxies and rate limiters.'
        ],
        correctOptionIndex: 1
      },
      {
        id: 'sec3',
        text: 'What is the absolute primary objective of implementing a Zero Trust Architecture (ZTA)?',
        options: [
          'To remove all firewalls and depend purely on cloud endpoints.',
          'To eliminate password policies and shift to biometric hardware keys exclusively.',
          'To operate under the continuous principle of "never trust, always verify" regardless of whether access originates inside or outside the network.',
          'To secure databases by enforcing 256-bit AES encryption across public columns.'
        ],
        correctOptionIndex: 2
      },
      {
        id: 'sec4',
        text: 'Which of the following is the most robust defense against SQL Injection (SQLi) attacks?',
        options: [
          'Applying client-side JavaScript regex sanitization prior to form submissions.',
          'Using parameterized queries / prepared statements instead of directly concatenating user input into SQL commands.',
          'Restricting table reads using read-only database connections.',
          'Using Base64 encoding for all search queries sent from browser sessions.'
        ],
        correctOptionIndex: 1
      },
      {
        id: 'sec5',
        text: 'What is the purpose of "Salting" a password before hashing it?',
        options: [
          'To increase the speed of the hashing algorithms during high-traffic user logins.',
          'To encrypt the password so that it can be reversed back to plain text if the user loses it.',
          'To add unique, random data to each password so that identical passwords result in different hashes, defeating precomputed rainbow tables.',
          'To compress the length of the resulting database records for better storage efficiency.'
        ],
        correctOptionIndex: 2
      }
    ]
  },
  {
    id: 'ethics-swe-301',
    title: 'Professional Software Engineering Ethics',
    course: 'SWE-302 (Professional Practice)',
    durationMinutes: 8,
    questionCount: 5,
    description: 'This exam evaluates ethical decision-making in software development, intellectual property issues, whistleblowing, privacy guidelines (GDPR/CCPA), and professional code of conduct standards.',
    questions: [
      {
        id: 'eth1',
        text: 'Under the ACM Code of Ethics, what is a software engineer\'s primary responsibility when discovering a severe safety vulnerability in a product under development?',
        options: [
          'Ignore the vulnerability unless the manager explicitly creates a tracking ticket for it.',
          'Disclose the vulnerability publicly on social media immediately to warn stakeholders.',
          'Report the risk clearly to those who have the authority to act, advocating for user safety above timeline or budget constraints.',
          'Patch it quietly in a future minor release without notifying the security operations center.'
        ],
        correctOptionIndex: 2
      },
      {
        id: 'eth2',
        text: 'Which open-source license is classified as a "Strong Copyleft" license, requiring any derivative work to also be open-sourced under the same terms?',
        options: [
          'The MIT License',
          'The Apache 2.0 License',
          'The GNU General Public License (GPLv3)',
          'The BSD 3-Clause License'
        ],
        correctOptionIndex: 2
      },
      {
        id: 'eth3',
        text: 'What is the fundamental ethical concern regarding "Dark Patterns" in user interface design?',
        options: [
          'They consume too much cellular data and device battery charge.',
          'They deliberately manipulate and deceive users into taking actions that run contrary to their actual intentions or best interests.',
          'They do not match modern dark-theme CSS accessibility standards.',
          'They restrict the layout of grids and grids-spacing on tablet devices.'
        ],
        correctOptionIndex: 1
      },
      {
        id: 'eth4',
        text: 'How does the GDPR "Right to be Forgotten" ethically affect database design for software applications?',
        options: [
          'It requires all audit logs to be completely erased every 24 hours.',
          'It mandates that users must be able to completely delete all their personal data from active tables and backups securely, unless legally exempted.',
          'It demands that no user data ever be written to disk; it must reside in RAM cache.',
          'It requires that password hashes are rotated automatically on a bi-monthly basis.'
        ],
        correctOptionIndex: 1
      },
      {
        id: 'eth5',
        text: 'An engineer is asked to write an algorithm that intentionally prioritizes affiliate products without disclosure, contrary to user search filters. What is this a direct violation of?',
        options: [
          'System architecture scalability standards.',
          'The ethical duty of transparency and avoiding deceptive representations to the public.',
          'Symmetric encryption standard compliance.',
          'The Apache software foundation guideline principles.'
        ],
        correctOptionIndex: 1
      }
    ]
  },
  {
    id: 'hrmfc-101',
    title: 'Human Resource Management Foundation Certified (HRMFC)',
    course: 'HRMFC',
    durationMinutes: 10,
    questionCount: 5,
    description: 'This foundation assessment evaluates core concepts of Human Resource Management, including employee lifecycles, structured onboarding, legal compliance, job analysis, and compensation models.',
    questions: [
      {
        id: 'hrmfc-q1',
        text: 'What is the primary strategic objective of Human Resource Management (HRM) within an organization?',
        options: [
          'To manage physical workspace facilities and administrative office supply inventories.',
          'To align and optimize human capital and workforce capabilities to achieve organizational goals.',
          'To oversee computer network infrastructure and manage code repositories.',
          'To design advertising copy and handle external customer sales inquiries.'
        ],
        correctOptionIndex: 1
      },
      {
        id: 'hrmfc-q2',
        text: 'Which stage of the employee lifecycle is explicitly designed to integrate a new hire into the organization\'s culture, compliance guidelines, and performance expectations?',
        options: [
          'Pre-screening / Sourcing',
          'Structured Onboarding',
          'Annual Performance Appraisal',
          'Offboarding / Exit Interview'
        ],
        correctOptionIndex: 1
      },
      {
        id: 'hrmfc-q3',
        text: 'Under standard labor guidelines, what does the principle of "At-Will Employment" mean for the employment relationship?',
        options: [
          'Employees are legally bound to a non-negotiable five-year employment duration.',
          'Either the employer or the employee can terminate the employment at any time, for any lawful reason, with or without notice.',
          'Employees must authorize all financial budget decisions within their respective departments.',
          'The government acts as the primary arbitrator for all annual salary reviews.'
        ],
        correctOptionIndex: 1
      },
      {
        id: 'hrmfc-q4',
        text: 'What is the primary purpose of executing a formal "Job Analysis"?',
        options: [
          'To analyze the competitor\'s market share and product pricing.',
          'To systematically identify and define the specific duties, responsibilities, required skills, and working conditions of a role.',
          'To organize company retreats and schedule team bonding events.',
          'To optimize load balancing on database servers.'
        ],
        correctOptionIndex: 1
      },
      {
        id: 'hrmfc-q5',
        text: 'Which standard compensation component links an employee\'s payout directly to individual, team, or company-wide performance achievements?',
        options: [
          'Fixed Hourly Wage',
          'Variable Incentive Compensation (Performance-Based Bonus)',
          'Flat Base Salary',
          'Employer-Sponsored Pension Plan'
        ],
        correctOptionIndex: 1
      }
    ]
  },
  {
    id: 'chrmg-201',
    title: 'Certified Human Resource Management Generalist (CHRMG)',
    course: 'CHRMG',
    durationMinutes: 60,
    questionCount: 50,
    description: 'This assessment tests professional competence required of an HR Generalist, focusing on employee relations, goal-setting methodologies, recruitment, total rewards, performance management, and compliance.',
    questions: chrmgQuestions
  },
  {
    id: 'chrmp-301',
    title: 'Certified Human Resource Management Professional (CHRMP)',
    course: 'CHRMP',
    durationMinutes: 120,
    questionCount: 75,
    description: 'This advanced executive-level examination validates proficiency in Strategic HRM, succession planning, workforce analytics, change management frameworks, and the alignment of human capital with business strategy.',
    questions: chrmpQuestions
  },
  {
    id: 'pm-201',
    title: 'Performance Management',
    course: 'Performance Management (PM)',
    durationMinutes: 60,
    questionCount: 50,
    description: 'Evaluates key capabilities in strategic goal alignment, OKRs, continuous feedback loops, professional coaching, appraisal systems, and performance improvement structures.',
    questions: pmQuestions
  },
  {
    id: 'pcit-301',
    title: 'Project Communication and Information Technology',
    course: 'Project Communication and Information Technology (PCIT)',
    durationMinutes: 120,
    questionCount: 75,
    description: 'Evaluates competencies in project stakeholder communication, collaboration models, agile team reporting, information architecture, and enterprise IT governance.',
    questions: pcitQuestions
  },
  {
    id: 'rmp-301',
    title: 'Risk Management Professional',
    course: 'Risk Management Professional (RMP)',
    durationMinutes: 120,
    questionCount: 75,
    description: 'Evaluates proficiency in risk planning, qualitative and quantitative risk analysis, risk response strategies, contingency planning, and enterprise risk management (ERM).',
    questions: rmpQuestions
  },
  {
    id: 'qmp-301',
    title: 'Quality Management Professional',
    course: 'Quality Management Professional (QMP)',
    durationMinutes: 120,
    questionCount: 75,
    description: 'Evaluates expertise in quality assurance, quality control frameworks, Lean, Six Sigma DMAIC, ISO 9001 standards, statistical process control, and total quality management.',
    questions: qmpQuestions
  },
  {
    id: 'pcm-301',
    title: 'Procurement and Contract Management',
    course: 'Procurement and Contract Management (PCM)',
    durationMinutes: 120,
    questionCount: 75,
    description: 'Evaluates capabilities in procurement planning, contract type selection, bidding processes, vendor negotiations, contract administration, and legal/dispute resolution.',
    questions: pcmQuestions
  }
];
