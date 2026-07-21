import { Question } from './types';

export const chrmgQuestions: Question[] = [
  // AREA 1: EMPLOYEE RELATIONS & ENGAGEMENT (Questions 1-10)
  {
    id: 'chrmg-q1',
    text: 'Scenario: An employee submits a formal complaint to HR stating that their immediate manager has been making inappropriate personal remarks. The employee expresses fear of retaliation. What is the most critical immediate action the HR Generalist must take?',
    options: [
      'Advise the employee to submit a transfer request first, then talk to the manager.',
      'Reassure the employee of anti-retaliation policies, document the grievance, and initiate a prompt, objective investigation.',
      'Confront the manager immediately in an informal meeting and demand that they apologize to the employee.',
      'Advise the employee to resolve the issue directly with the manager to preserve the working relationship.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q2',
    text: 'Scenario: A team of software engineers reports a persistent clash between two senior designers regarding product styling, which is delaying project milestones. What conflict resolution technique should the HR Generalist facilitate to achieve a sustainable, win-win outcome?',
    options: [
      'Forcing: Instruct the project manager to select one designer\'s styling rules and mandate compliance.',
      'Avoiding: Reassign one of the senior designers to a completely different engineering unit.',
      'Collaborating: Guide both designers in a structured brainstorming session to integrate their ideas and align on shared criteria.',
      'Accommodating: Ask one designer to give in to the other\'s ideas to maintain harmony.'
    ],
    correctOptionIndex: 2
  },
  {
    id: 'chrmg-q3',
    text: 'Scenario: A customer service agent with high customer ratings is found to be consistently late for work. Following the company’s progressive discipline policy, the supervisor wants to issue an immediate suspension. What is HR\'s role in advising this supervisor?',
    options: [
      'Approve the suspension because attendance is a basic requirement, regardless of past performance.',
      'Advise the supervisor to verify that previous progressive steps (verbal and written warnings) were documented and issued before proceeding to suspension.',
      'Instruct the supervisor to overlook the lateness since the agent has high customer feedback scores.',
      'Terminate the employee immediately to set an example for other team members.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q4',
    text: 'Scenario: During an exit interview, a high-performing analyst states that they are resigning because their supervisor has repeatedly changed performance targets without notice and excluded them from core client presentations. What does this situation indicate to HR strategically?',
    options: [
      'The analyst was not resilient enough to handle a fast-paced work environment.',
      'A localized leadership issue that requires a targeted stay-interview and manager development intervention.',
      'The company\'s base salary range is non-competitive in the regional market.',
      'An isolated incident that does not require any follow-up or system diagnostics.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q5',
    text: 'Scenario: An HR Generalist is reviewing engagement survey results for a division experiencing high turnover. The data shows that while employees are happy with benefits, they feel highly disconnected from management decision-making. What is the most constructive response?',
    options: [
      'Implement an automated newsletter from the CEO to increase the flow of high-level company communications.',
      'Establish cross-functional feedback forums and action planning committees to involve employees directly in problem-solving.',
      'Increase the employee referral bonus to offset the turnover rates quickly.',
      'Restrict the distribution of future surveys to avoid highlighting negative areas.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q6',
    text: 'Scenario: An employee claims they were forced to resign because the company made their working conditions intolerable by cutting their pay by 20% and changing their shift to overnight without reason. What legal risk does this scenario present to the company?',
    options: [
      'Breach of employment loyalty',
      'Constructive Dismissal (treated as involuntary termination under labor laws)',
      'Voluntary Resignation with cause',
      'No legal risk since the employee signed a standard voluntary resignation letter'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q7',
    text: 'Scenario: An HR Generalist is conducting stay interviews with critical software developers. Several developers express that while they enjoy their work, they are constantly approached by external recruiters offering remote options. What should HR recommend?',
    options: [
      'Draft non-compete agreements to prevent the developers from leaving for other tech firms.',
      'Review and design a localized hybrid/remote work framework and benchmark the total rewards against remote markets.',
      'Offer immediate salary increases to the entire development team without modifying work policies.',
      'Ignore the feedback, assuming that corporate loyalty will naturally prevent developer attrition.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q8',
    text: 'Scenario: A company is planning a major restructuring that will eliminate several roles and introduce new operational technologies. HR is tasked with managing employee anxiety and maintaining engagement. What should be HR\'s primary communication strategy?',
    options: [
      'Keep the restructuring completely confidential until the day of execution to avoid panic.',
      'Communicate the business rationale early and transparently, hold town hall meetings to answer questions, and detail support pathways.',
      'Issue standard electronic policy manuals explaining the operational changes and mandate signatures.',
      'Instruct middle managers to handle communications on an individual, ad-hoc basis without central coordination.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q9',
    text: 'Scenario: A top-performing sales executive is accused of bullying junior sales coordinators. The head of sales asks HR to ignore the complaint because the executive generates 40% of the department\'s revenue. How should HR respond?',
    options: [
      'Agree to defer the investigation, but advise the sales head to speak to the executive informally.',
      'Insist on conducting a complete, unbiased investigation, highlighting that ignoring misconduct violates policy and exposes the company to severe legal and cultural risks.',
      'Instruct the junior sales coordinators to adapt to the executive\'s high-pressure style.',
      'Reassign the junior coordinators to other sales reps to resolve the conflict without checking the claims.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q10',
    text: 'Scenario: An employee requests to bring an external legal counsel into a routine internal meeting with their manager regarding a minor performance concern. What is the standard HR generalist best practice in this scenario?',
    options: [
      'Allow the attorney to attend to show that the company has nothing to hide.',
      'Explain that internal performance reviews are private business matters, deny the request, and offer a supportive internal colleague or HR presence instead.',
      'Cancel the meeting entirely and escalate the performance concern to a formal disciplinary board.',
      'Immediately terminate the employee for attempting to involve external legal entities.'
    ],
    correctOptionIndex: 1
  },

  // AREA 2: RECRUITMENT & SELECTION (Questions 11-18)
  {
    id: 'chrmg-q11',
    text: 'Scenario: A logistics company needs to recruit 100 delivery drivers in a short period due to seasonal expansion. The HR Generalist needs to select a sourcing and screening strategy that is fast but reliable. Which approach is most effective?',
    options: [
      'Post openings on national professional networks, requiring a detailed cover letter, executive references, and a multi-stage essay test.',
      'Deploy mobile-responsive micro-applications, hold local walk-in recruitment days, and conduct immediate background and driving record screening.',
      'Rely exclusively on executive search boutique headhunters to source individual drivers from competitor pools.',
      'Post on general forums and hire the first 100 applicants without background checks, handling quality issues during onboarding.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q12',
    text: 'Scenario: To reduce subjectivity and personal bias in hiring, the Head of HR wants to reform the interviewing process for administrative roles. What interview design has the highest predictive validity?',
    options: [
      'Structured behavioral interviews where candidates are asked specific, job-related situational questions scored against a standardized rubric.',
      'Unstructured conversational interviews that allow managers to assess cultural fit and chemistry naturally.',
      'A series of unstructured meetings with different executives, followed by an informal group vote.',
      'A review of the candidate\'s social media profiles and academic institution prestige.'
    ],
    correctOptionIndex: 0
  },
  {
    id: 'chrmg-q13',
    text: 'Scenario: A tech company wishes to move from hiring for "cultural fit" to "cultural add" in its engineering department. What is the fundamental difference between these two philosophies?',
    options: [
      '"Cultural fit" focuses on selecting candidates who share identical hobbies, interests, and background; "cultural add" actively seeks diverse perspectives and experiences that enrich the existing team.',
      '"Cultural fit" is a legal requirement; "cultural add" is a voluntary diversity campaign.',
      '"Cultural fit" is used for entry-level positions; "cultural add" is reserved strictly for C-suite executive recruitment.',
      'There is no functional difference; they are synonymous HR marketing buzzwords.'
    ],
    correctOptionIndex: 0
  },
  {
    id: 'chrmg-q14',
    text: 'Scenario: During an interview debrief, a hiring manager states that they want to hire a candidate because they went to the same university and are highly energetic, ignoring the fact that the candidate scored poorly on the technical assessment. What cognitive bias is the manager exhibiting?',
    options: [
      'Contrast effect',
      'Halo effect and affinity bias',
      'Leniency bias',
      'Stereotyping'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q15',
    text: 'Scenario: An HR Generalist is evaluating a recruitment pipeline and notices that while candidate attraction is high, 45% of offers in the customer success department are rejected. What is the first diagnostic step HR should take?',
    options: [
      'Increase the budget for corporate recruiting advertisements on social channels.',
      'Analyze exit and feedback data from candidate rejections, and benchmark salary, benefits, and remote flexibility against local competitor offerings.',
      'Increase base salaries across the board without investigating candidate sentiments.',
      'Mandate that the talent acquisition team double the volume of weekly candidates sourced.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q16',
    text: 'Scenario: When conducting background checks for a candidate who is about to be offered a financial clerk position, HR receives a highly enthusiastic reference letter from a relative, but the candidate\'s previous employer refuses to disclose anything other than dates of employment. How should HR handle this?',
    options: [
      'Assume the previous employer\'s silence implies a negative record and reject the candidate immediately.',
      'Understand that many companies have strict "dates-only" reference policies to avoid liability, and utilize neutral verification methods combined with secondary professional references.',
      'Demand that the candidate obtain a written performance waiver from the previous employer\'s CEO.',
      'Overlook the dates and rely fully on the relative\'s reference letter to close the hiring file.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q17',
    text: 'Scenario: A manufacturing company wants to implement pre-employment tests to evaluate the manual dexterity and safety alignment of machinery operators. To ensure the tests are legally defensible, what must HR verify?',
    options: [
      'The tests must be highly difficult so that only the top 5% of candidates can pass.',
      'The tests must have proven job-related validity and reliability, and must not create an adverse impact on protected groups.',
      'The tests must be administered off-site during evening hours to test candidate commitment.',
      'The tests must be purchased from an approved general educational vendor, regardless of the target job duties.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q18',
    text: 'Scenario: A tech startup is experiencing high voluntary turnover among engineers who quit within their first 6 months. Exit surveys indicate they felt the actual job duties were completely different from what was described during recruitment. What is the best solution?',
    options: [
      'Increase the initial base salary for all new engineering hires.',
      'Implement a Realistic Job Preview (RJP) during the selection process to provide candidates with an honest view of daily duties and challenges.',
      'Require engineers to sign a 12-month retention commitment contract upon hiring.',
      'Redesign the corporate career website to make the job roles look more attractive.'
    ],
    correctOptionIndex: 1
  },

  // AREA 3: ONBOARDING & RETENTION (Questions 19-25)
  {
    id: 'chrmg-q19',
    text: 'Scenario: A financial services firm wants to improve its onboarding process to increase first-year retention. Which structure represents the most strategic and complete onboarding framework?',
    options: [
      'A single-day classroom lecture covering corporate history, payroll setup, and handbook signing.',
      'A structured, multi-month program featuring 30-60-90 day milestone reviews, executive context briefings, peer buddies, and continuous manager feedback.',
      'An online self-service folder containing PDF policy documents that the employee reviews independently.',
      'An informal process where the employee shadows a senior colleague on their first afternoon.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q20',
    text: 'Scenario: An employee submits a medical request for a specialized ergonomic desk chair and a software text-to-speech reader due to a physical disability. How should the HR Generalist proceed under accommodation frameworks?',
    options: [
      'Deny the request because it creates an administrative inconvenience and sets a precedent for other employees.',
      'Engage in an interactive process with the employee to understand their functional limitations, review medical recommendations, and provide reasonable accommodations.',
      'Advise the employee that they must purchase their own ergonomic equipment if they wish to use it at the office.',
      'Reassign the employee to a lower-stress, non-technical role to avoid having to implement accommodations.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q21',
    text: 'Scenario: To address high burnout rates in customer operations, HR wants to implement a wellness initiative. Which of the following approaches is most likely to deliver a measurable, positive impact on employee retention?',
    options: [
      'Distribute fruit baskets and organize optional wellness lectures on weekends.',
      'Conduct a structural work-load analysis, optimize shift schedules to allow adequate rest, and train managers to support mental health boundaries.',
      'Introduce a meditation room in the office while keeping the 60-hour mandatory workweek unchanged.',
      'Encourage employees to utilize their personal time off more effectively without adjusting daily performance quotas.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q22',
    text: 'Scenario: During calibration, the HR team realizes that the company\'s baby-boomer generation managers are reporting high frustration with younger Gen Z hires, citing different communications and remote work expectations. How should HR intervene?',
    options: [
      'Advise the managers that Gen Z workers are too difficult to manage and recommend prioritizing older hires.',
      'Organize cross-generational collaboration workshops to build mutual understanding of work styles, and clarify objective output metrics.',
      'Mandate that all younger workers return to 100% in-office work while allowing older employees to remain hybrid.',
      'Redesign the corporate communication handbook to prohibit modern text messaging and messaging apps.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q23',
    text: 'Scenario: An HR Generalist is looking for ways to enrich the roles of senior customer service representatives who are bored but do not want to move into people-management. Which job design approach should HR implement?',
    options: [
      'Job Rotation: Move them to different low-skill entry roles across various physical offices.',
      'Job Enrichment: Delegate higher-level responsibilities such as handling escalated client accounts, designing training modules, and leading process improvement initiatives.',
      'Job Simplification: Reduce their tasks to standard, repetitive processes to minimize stress.',
      'Job Enlargement: Increase the number of low-skill support calls they are required to answer daily.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q24',
    text: 'Scenario: To increase workforce flexibility and reduce facility costs, the executive committee asks HR to review compressed workweek configurations. What is a standard compressed workweek setup?',
    options: [
      'Working 40 hours over 6 days in a flexible shift rotation.',
      'Working four 10-hour days per week (4/10 schedule), providing employees with a 3-day weekend.',
      'Allowing employees to log in and work whenever they choose, provided they meet weekly tasks.',
      'Working 5 hours per day, 5 days per week, with a proportional salary reduction.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q25',
    text: 'Scenario: A company is struggling to attract talent. The VP of Talent wants to track the effectiveness of the company\'s Employer Value Proposition (EVP). Which metric is the most direct indicator of EVP health?',
    options: [
      'The average time-to-hire for administrative positions.',
      'The ratio of job-offer acceptances relative to the total number of offers extended to top candidates.',
      'The total number of followers on the company\'s official LinkedIn page.',
      'The percentage of employees who completed their annual compliance training.'
    ],
    correctOptionIndex: 1
  },

  // AREA 4: COMPENSATION, BENEFITS & TOTAL REWARDS (Questions 26-32)
  {
    id: 'chrmg-q26',
    text: 'Scenario: A medium-sized enterprise wants to overhaul its compensation structure to ensure internal equity. Which job evaluation methodology provides the most objective, quantitative system for ranking roles based on compensable factors?',
    options: [
      'Classification Method',
      'Point Factor Method',
      'Job Ranking Method',
      'Market Pricing Method'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q27',
    text: 'Scenario: HR wants to establish a competitive pay policy that attracts high-caliber talent but remains financially sustainable. What strategy should HR recommend to the board regarding market-pricing benchmarks?',
    options: [
      'Target base salaries at the 95th percentile of the market, regardless of incentive options.',
      'Benchmark base salaries at the 50th percentile (market median), but design a high-value performance-based variable pay and comprehensive benefits package.',
      'Set base salaries at the 25th percentile to minimize fixed costs and rely fully on discretionary bonuses.',
      'Copy the compensation structures of international companies, irrespective of local cost-of-living data.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q28',
    text: 'Scenario: An HR Generalist is auditing employee classifications under fair labor standards. They discover several executive assistants are classified as "exempt" from overtime pay, even though their primary duties are administrative support, scheduling, and data entry. What is the risk, and what is the correction?',
    options: [
      'There is no risk since they have "assistant" in their title; maintain current exempt classification.',
      'High risk of wage-and-hour violations; reclassify them as "non-exempt" based on the duties test, track their hours, and pay appropriate overtime.',
      'Ask the assistants to sign a voluntary waiver agreeing to waive their rights to overtime pay.',
      'Change their job titles to "Executive Director of Calendars" to justify the exempt classification.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q29',
    text: 'Scenario: To manage rising medical insurance premium costs, a company wants to transition to a consumer-directed health plan (CDHP). What typical benefits configuration should HR communicate to employees?',
    options: [
      'An insurance plan with zero deductibles but high monthly premiums, coupled with restricted clinic selections.',
      'A High-Deductible Health Plan (HDHP) combined with a tax-advantaged Health Savings Account (HSA) that receives employer contributions.',
      'A plan that covers dental and vision care only, leaving general medical expenses to be paid out-of-pocket.',
      'An plan that requires employees to obtain pre-approval from HR for all medical visits.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q30',
    text: 'Scenario: HR is designing a rewards framework for a remote sales team. Focus groups reveal that reps value professional development as much as cash bonuses. What rewards model should HR adopt?',
    options: [
      'A traditional commissions-only model that focuses strictly on cash incentives.',
      'A Total Rewards framework that integrates competitive base pay, sales commissions, paid certifications, and career mentoring.',
      'A non-cash model that replaces all sales bonuses with company recognition certificates.',
      'A plan where stipends are deducted from commissions to fund mandatory training sessions.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q31',
    text: 'Scenario: An employee discovers that a newly hired colleague with less tenure in an identical role is earning 15% more base salary. The employee files a complaint alleging pay discrimination. How should HR handle this pay disparity?',
    options: [
      'Advise the employee that salary discussions are prohibited and threaten disciplinary action.',
      'Conduct a pay equity review, identify objective factors (e.g., certifications, specialized experience, market fluctuations at hire), and adjust pay if unjustified disparities are found.',
      'Explain that new hires always make more due to market inflation, and advise them to wait for the annual review.',
      'Immediately lower the new hire\'s salary to match the existing employee\'s rate.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q32',
    text: 'Scenario: A global firm needs to temporarily relocate a senior project manager from headquarters to a foreign subsidiary for 12 months. Which compensation approach is standard for maintaining the manager\'s purchasing power and covering relocation costs?',
    options: [
      'Local Market Approach: Pay the manager the local going rate of the host country, regardless of home country standards.',
      'Balance Sheet Approach: Keep the manager on the home-country salary scale, while providing cost-of-living adjustments, housing allowances, and tax equalization.',
      'Lump-Sum Approach: Give the manager a flat cash allowance and require them to handle all salary, tax, and relocation logistics independently.',
      'Negotiation Approach: Agree on a custom, ad-hoc salary rate through individual bargaining without structured policies.'
    ],
    correctOptionIndex: 1
  },

  // AREA 5: PERFORMANCE MANAGEMENT & PIPs (Questions 33-40)
  {
    id: 'chrmg-q33',
    text: 'Scenario: An HR Generalist is designing a 360-degree feedback program for mid-level managers. What is the primary best-practice application of 360-degree feedback data?',
    options: [
      'To serve as the direct, sole mathematical basis for calculating annual salary increases and promotion decisions.',
      'To provide broad developmental feedback on leadership behaviors, communication style, and collaboration, separate from pay evaluations.',
      'To identify and document low-performing managers for immediate placement on Performance Improvement Plans.',
      'To allow team members to anonymously grade their supervisors for disciplinary reviews.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q34',
    text: 'Scenario: Following annual reviews, the HR Director notices that 90% of employees in the administrative department were rated "exceeds expectations," while the engineering department has a balanced bell-curve of ratings. What intervention should HR implement?',
    options: [
      'Order the engineering department to raise their ratings to match the administrative department.',
      'Introduce structured performance calibration sessions where managers discuss and justify their ratings based on objective evidence.',
      'Enforce a rigid forced-ranking system where 15% of all employees must be rated as low performers.',
      'Instruct the payroll department to cap bonuses regardless of performance ratings.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q35',
    text: 'Scenario: To improve rating clarity, HR wants to replace the standard 1-to-5 graphic rating scale with a Behaviorally Anchored Rating Scale (BARS). What is the primary benefit of BARS?',
    options: [
      'It is faster to design and requires zero supervisor training.',
      'It anchors rating levels to specific, observable behavioral examples, reducing supervisor subjectivity and bias.',
      'It automatically calculates employee bonuses based on mathematical algorithms.',
      'It allows employees to rate themselves without supervisor intervention.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q36',
    text: 'Scenario: A historically high-performing administrative assistant has recently made several data-entry errors and missed core deadlines. The supervisor wants to place them on a formal PIP immediately. What should HR recommend first?',
    options: [
      'Approve the PIP immediately to start the termination documentation process.',
      'Advise the supervisor to hold an informal, supportive meeting with the assistant to discuss the sudden performance drop, identify root causes, and offer guidance.',
      'Reassign the assistant to a non-administrative role to bypass performance issues.',
      'Issue an immediate formal written warning and log it in the employee\'s permanent file.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q37',
    text: 'Scenario: A company CEO wants to introduce a "forced distribution" performance appraisal model where the bottom 10% of employees are automatically terminated every year. What should HR warn the CEO about regarding this system?',
    options: [
      'It increases operational costs by requiring too many physical evaluation sheets.',
      'It destroys teamwork, encourages internal competition, increases voluntary turnover of high-performers, and exposes the firm to legal risks.',
      'It is highly favored by labor unions and will lead to excessive collective bargaining demands.',
      'It has no impact on culture and is the industry standard for all major technology companies.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q38',
    text: 'Scenario: Frontline employees complain that their annual performance appraisal is stressful because they only receive feedback once a year and are surprised by negative supervisor comments. What structural reform should HR implement?',
    options: [
      'Abolish all performance evaluations and allocate salary increases strictly based on tenure.',
      'Transition from annual appraisals to a continuous feedback model with structured monthly or bi-weekly check-ins and shared OKRs.',
      'Mandate that supervisors send performance check-in emails every Monday morning.',
      'Create an online portal where employees can view their manager\'s notes in real-time without scheduling meetings.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q39',
    text: 'Scenario: What is the fundamental difference between "Coaching" and "Mentoring" in talent development?',
    options: [
      'Coaching is long-term and informal; Mentoring is short-term and focused strictly on technical skills.',
      'Coaching is typically short-term, structured, and focused on specific task performance; Mentoring is long-term, development-oriented, and focused on career pathing.',
      'Coaching is handled by external consultants; Mentoring is handled exclusively by HR staff.',
      'There is no difference; they are synonymous terms in executive development.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q40',
    text: 'Scenario: To ensure individual goals directly support the company’s strategic business objectives, which goal-setting methodology should HR implement?',
    options: [
      'Isolated Departmental Goals: Allow each manager to set team tasks independently of other divisions.',
      'Cascading Goals: Align organizational strategic objectives to division KPIs, department targets, and individual performance goals.',
      'Ad-hoc Goals: Encourage employees to set weekly personal tasks without corporate alignments.',
      'Bottom-up Mandate: Aggregate individual personal goals and define the corporate strategy based on employee preferences.'
    ],
    correctOptionIndex: 1
  },

  // AREA 6: LEARNING & DEVELOPMENT (Questions 41-45)
  {
    id: 'chrmg-q41',
    text: 'Scenario: A manufacturing division wants to purchase a $50,000 training program for forklift operators. The L&D Specialist wants to ensure the program will address the actual root cause of warehouse delays. What should be the first step under the ADDIE framework?',
    options: [
      'Review online catalogs and sign a contract with the highest-rated training vendor.',
      'Conduct a thorough Training Needs Assessment (TNA) to analyze the performance gap, target audience skills, and operational challenges.',
      'Design interactive slide decks and forklift training manuals for the operators.',
      'Organize a pilot training session with the most experienced forklift operators.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q42',
    text: 'Scenario: A company wants to design a training program for its senior managers. According to Knowles’ Theory of Andragogy (Adult Learning), which design principle will maximize manager engagement?',
    options: [
      'Structuring the course around abstract theories, rote-memorization, and grades.',
      'Designing problem-centered, experiential modules where managers can apply their existing professional expertise to solve real scenarios.',
      'Enforcing strict daily attendance quotas with formal reprimands for missing lectures.',
      'Keeping the training content uniform and standardized, without allowing self-directed pacing.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q43',
    text: 'Scenario: The CFO demands that HR evaluate the effectiveness of a newly implemented leadership development program. To measure behavioral transfer (the degree to which participants apply training back on the job), which Kirkpatrick level must HR target?',
    options: [
      'Level 1: Reaction (satisfaction surveys)',
      'Level 2: Learning (post-training knowledge quizzes)',
      'Level 3: Behavior (on-the-job behavioral audits and 360-degree feedback reviews)',
      'Level 4: Results (business unit productivity metrics)'
    ],
    correctOptionIndex: 2
  },
  {
    id: 'chrmg-q44',
    text: 'Scenario: A multinational retail chain wants to train 10,000 retail clerks on new POS terminal safety features in 2 weeks. The clerks have limited time during their shifts. What L&D modality should HR select?',
    options: [
      'Schedule live, full-day classroom lectures at regional hotels over the next three months.',
      'Deploy bite-sized, mobile-optimized microlearning modules on the corporate LMS with interactive simulated checks.',
      'Distribute printed technical manuals and require clerks to study them in their personal hours.',
      'Deliver the training via a sequence of weekly corporate emails without assessments.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q45',
    text: 'Scenario: To accelerate the technical development of junior financial analysts, HR wants to implement a mentorship program. Which structure will yield the highest success rate?',
    options: [
      'Allow junior analysts and executives to self-select matches and meet informally without guidelines.',
      'Establish a formal pairing system based on career mapping, define clear goals and meeting templates, and monitor progress.',
      'Require senior partners to grade the weekly performance of their junior mentees for the HR files.',
      'Limit the mentorship program to the highest-performing junior analyst each year.'
    ],
    correctOptionIndex: 1
  },

  // AREA 7: HR OPERATIONS & COMPLIANCE (Questions 46-50)
  {
    id: 'chrmg-q46',
    text: 'Scenario: An employee requests 6 weeks of leave to care for a family member with a serious health condition. What is the standard HR generalist compliance priority regarding job-protected leave?',
    options: [
      'Deny the leave if the department is currently understaffed, and suggest they resign.',
      'Review and administer the leave under family/medical leave laws (such as FMLA or national equivalents), maintaining their health benefits and guaranteeing their role or equivalent upon return.',
      'Approve the leave but suspend their health insurance benefits during their absence.',
      'Approve the leave only on the condition that the employee works part-time from home.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q47',
    text: 'Scenario: A warehouse operator reports a physical safety hazard regarding broken safety guards on a conveyor belt. The warehouse manager tells the operator to ignore it and continue working. How must the HR Generalist intervene?',
    options: [
      'Support the manager\'s production goals and advise the operator to work carefully.',
      'Ensure the belt is shut down immediately, report the hazard to the safety officer, and protect the operator from any retaliation.',
      'Advise the operator to file an external government lawsuit without notifying internal safety teams.',
      'Instruct the operator to find a colleague willing to operate the belt instead.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q48',
    text: 'Scenario: A company operates a unionized manufacturing facility. Management wants to make a unilateral change to the employee health benefit plans. What is HR\'s counsel to the site director?',
    options: [
      'Management can change benefits unilaterally at any time under executive authority.',
      'Benefits are mandatory subjects of collective bargaining; HR must consult union representatives and negotiate in good faith before making changes.',
      'Advise the site director to announce the changes quietly to avoid union opposition.',
      'Terminate the collective bargaining agreement to simplify benefits administration.'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q49',
    text: 'Scenario: HR wants to evaluate the stability of its workforce. During the year, the company had 50 separations and maintained an average headcount of 500 employees. What is the annual turnover rate?',
    options: [
      '5%',
      '10%',
      '20%',
      '15%'
    ],
    correctOptionIndex: 1
  },
  {
    id: 'chrmg-q50',
    text: 'Scenario: A manager consistently speaks in a loud, aggressive tone during project review meetings and critiques employee work in front of colleagues. An employee files a complaint alleging workplace harassment and bullying. How should HR analyze this?',
    options: [
      'Dismiss the complaint immediately because critiquing work is part of a manager\'s job.',
      'Conduct a thorough review of the manager\'s behavior against workplace conduct policies, interview witnesses, and guide the manager on professional coaching.',
      'Inform the employee that they must adapt to different management styles or seek other roles.',
      'Immediately suspend the manager without checking the claims to demonstrate safety.'
    ],
    correctOptionIndex: 1
  }
];
