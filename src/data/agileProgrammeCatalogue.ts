export type AgileProgrammeLevel = 'Foundation' | 'Associate' | 'Professional' | 'Specialist' | 'Executive';

export type AgileProgrammeCategory =
  'Agile Project Management, Product and Delivery Certifications'
  | 'Agile Human Resource Management Certifications'
  | 'Agile Leadership Certifications';

export interface AgileProgrammeCatalogueItem {
  code: string;
  title: string;
  category: AgileProgrammeCategory;
  level: AgileProgrammeLevel;
  summary: string;
  status: 'catalogue-preview';
}

export const AGILE_PROGRAMME_CATEGORIES: readonly AgileProgrammeCategory[] = [
  'Agile Project Management, Product and Delivery Certifications',
  'Agile Human Resource Management Certifications',
  'Agile Leadership Certifications',
] as const;

export const AGILE_PROGRAMME_LEVELS: readonly AgileProgrammeLevel[] = [
  'Foundation',
  'Associate',
  'Professional',
  'Specialist',
  'Executive',
] as const;

const programmeRows = [
  ['AC-APD-F', 'AgileCert Foundation in Agile Project Delivery', 'Agile Project Management, Product and Delivery Certifications', 'Foundation', 'Agile principles, Kanban WIP limits, iterative delivery, Definition of Done, backlog refinement and release planning.'],
  ['AC-APD-A', 'AgileCert Associate Practitioner in Agile Project Delivery', 'Agile Project Management, Product and Delivery Certifications', 'Associate', 'Sprint planning, velocity, burndown analysis, impediment removal, swarming and delivery discipline.'],
  ['AC-APD-P', 'AgileCert Certified Professional Practitioner in Agile Project Delivery', 'Agile Project Management, Product and Delivery Certifications', 'Professional', 'Enterprise scaling, value streams, multi-team dependencies, Agile governance and portfolio alignment.'],
  ['AC-TFSD-P', 'AgileCert Professional Practitioner in Technical & Financial Software Delivery', 'Agile Project Management, Product and Delivery Certifications', 'Professional', 'CI/CD, DevSecOps, automated testing, architectural spikes and regulated financial-software delivery.'],
  ['AC-PVO-P', 'AgileCert Professional Practitioner in Product Ownership & Value Optimization', 'Agile Project Management, Product and Delivery Certifications', 'Professional', 'Product prioritisation, vision-to-roadmap execution, MVP validation, ROI and stakeholder alignment.'],
  ['AC-ARBA-F', 'AgileCert Foundation in Agile Requirements & Business Analysis', 'Agile Project Management, Product and Delivery Certifications', 'Foundation', 'User stories, acceptance criteria, story mapping, scope decomposition and non-functional requirements.'],
  ['AC-PDAD-P', 'AgileCert Professional Practitioner in Product Design & Agile Delivery', 'Agile Project Management, Product and Delivery Certifications', 'Professional', 'Design thinking, UX prototyping, dual-track Agile, usability testing, continuous discovery and accessibility.'],
  ['AC-KFM-S', 'AgileCert Specialist in Kanban & Flow Management', 'Agile Project Management, Product and Delivery Certifications', 'Specialist', 'WIP limits, cumulative flow, lead and cycle time, service-level expectations and bottleneck management.'],
  ['AC-APVM-P', 'AgileCert Professional in Agile PMO, Portfolio & Value Management', 'Agile Project Management, Product and Delivery Certifications', 'Professional', 'Lean portfolio management, strategic value streams, funding guardrails, portfolio Kanban and outcome dashboards.'],
  ['AC-AQET-P', 'AgileCert Professional in Agile Quality Engineering & Testing', 'Agile Project Management, Product and Delivery Certifications', 'Professional', 'Shift-left testing, BDD, automation frameworks, exploratory testing, quality gates and defect prevention.'],
  ['AC-ARGC-P', 'AgileCert Professional in Agile Risk, Governance & Compliance', 'Agile Project Management, Product and Delivery Certifications', 'Professional', 'Continuous auditing, ROAM, automated compliance, threat modelling, regulatory sandboxes and governance.'],
  ['AC-ACPV-P', 'AgileCert Professional in Agile Contracting, Procurement & Vendor Delivery', 'Agile Project Management, Product and Delivery Certifications', 'Professional', 'Agile contracts, target-cost models, co-creation RFPs, quality gates, IP terms and multi-vendor governance.'],
  ['AC-ASGP-S', 'AgileCert Specialist in Agile Sustainability & Green Project Delivery', 'Agile Project Management, Product and Delivery Certifications', 'Specialist', 'Environmental Definition of Done, efficient computing, green UX, sustainability metrics and e-waste reduction.'],
  ['AC-APM-A', 'AgileCert Associate Practitioner in Agile People Management', 'Agile Human Resource Management Certifications', 'Associate', 'Servant leadership, psychological safety, intrinsic motivation, T-shaped skills, delegation and recognition.'],
  ['AC-APST-P', 'AgileCert Professional in Agile People Strategy & Transformation', 'Agile Human Resource Management Certifications', 'Professional', 'Agile HR operating models, organisational transformation, networks of teams, people analytics and team rewards.'],
  ['AC-AIHR-P', 'AgileCert Professional in AI-Enabled HR & People Operations', 'Agile Human Resource Management Certifications', 'Professional', 'HR virtual assistants, responsible AI, people analytics, GenAI feedback synthesis and privacy.'],
  ['AC-ATAW-P', 'AgileCert Professional in Agile Talent Acquisition & Workforce Planning', 'Agile Human Resource Management Certifications', 'Professional', 'Talent-pipeline Kanban, candidate experience, collaborative hiring, workforce planning and internal mobility.'],
  ['AC-CPOF-P', 'AgileCert Professional in Continuous Performance, OKRs & Feedback', 'Agile Human Resource Management Certifications', 'Professional', 'OKR alignment, continuous one-to-ones, CFRs, peer feedback and outcome-based performance.'],
  ['AC-ALCD-P', 'AgileCert Professional in Agile Learning & Capability Development', 'Agile Human Resource Management Certifications', 'Professional', 'Continuous learning, communities of practice, micro-learning, capability matrices and learning impact.'],
  ['AC-EXED-P', 'AgileCert Professional in Employee Experience & Engagement Design', 'Agile Human Resource Management Certifications', 'Professional', 'Employee journey mapping, HR design thinking, hybrid-work experience, pulse feedback and engagement.'],
  ['AC-AODW-P', 'AgileCert Professional in Adaptive Organization Design & Workforce Transformation', 'Agile Human Resource Management Certifications', 'Professional', 'Value streams, team networks, dynamic talent allocation, team topologies and dual operating systems.'],
  ['AC-AHRD-P', 'AgileCert Professional in Agile HR Service Delivery & Process Improvement', 'Agile Human Resource Management Certifications', 'Professional', 'HR service Kanban, tiered service models, experience levels, WSJF prioritisation and Lean improvement.'],
  ['AC-CCEC-P', 'AgileCert Professional in Change, Culture & Employee Communication', 'Agile Human Resource Management Certifications', 'Professional', 'Lean change, communication design, change champions, culture experiments and organisational storytelling.'],
  ['AC-ARRT-S', 'AgileCert Specialist in Agile Rewards, Recognition & Total Compensation', 'Agile Human Resource Management Certifications', 'Specialist', 'Team incentives, peer recognition, transparent pay, performance-review redesign and skills-based rewards.'],
  ['AC-WCPR-S', 'AgileCert Specialist in Workforce Compliance & People Risk', 'Agile Human Resource Management Certifications', 'Specialist', 'Compliance guardrails, whistleblowing, contingent-work risk, cross-border work, HR privacy and AI bias.'],
  ['AC-ADIT-S', 'AgileCert Specialist in Agile Diversity, Inclusion & Team Belonging', 'Agile Human Resource Management Certifications', 'Specialist', 'Inclusive retrospectives, equitable hiring, neurodiversity, accessibility, belonging and equity audits.'],
  ['AC-ATL-A', 'AgileCert Associate Practitioner in Adaptive Team Leadership', 'Agile Leadership Certifications', 'Associate', 'Servant leadership, psychological safety, situational coaching, delegation, conflict and active listening.'],
  ['AC-EATL-P', 'AgileCert Professional in Enterprise Agility & Transformation Leadership', 'Agile Leadership Certifications', 'Professional', 'Operating-model redesign, executive alignment, enterprise flow, Lean funding and transformation rollout.'],
  ['AC-SAPG-P', 'AgileCert Professional in Strategic Agility, OKRs & Portfolio Governance', 'Agile Leadership Certifications', 'Professional', 'Dynamic strategy, bidirectional OKRs, Lean portfolio management, portfolio Kanban and strategic reviews.'],
  ['AC-AILD-P', 'AgileCert Professional in AI-Enabled Leadership & Decision Intelligence', 'Agile Leadership Certifications', 'Professional', 'AI-augmented decisions, responsible AI governance, GenAI strategy, human oversight and explainability.'],
  ['AC-CLCT-P', 'AgileCert Professional in Change Leadership & Culture Transformation', 'Agile Leadership Certifications', 'Professional', 'Culture change, strategic narratives, guiding coalitions, resistance management and adaptive governance.'],
  ['AC-TLHC-P', 'AgileCert Professional in Agile Team Leadership & High-Performance Collaboration', 'Agile Leadership Certifications', 'Professional', 'Team development, working agreements, swarming, conflict resolution and communities of practice.'],
  ['AC-CFTE-P', 'AgileCert Professional in Coaching, Facilitation & Team Enablement', 'Agile Leadership Certifications', 'Professional', 'Coaching stances, neutral facilitation, liberating structures, GROW coaching and ethical boundaries.'],
  ['AC-IEL-P', 'AgileCert Professional in Innovation & Experimentation Leadership', 'Agile Leadership Certifications', 'Professional', 'Lean experiments, pretotyping, innovation sandboxes, portfolio horizons and innovation accounting.'],
  ['AC-PSAL-P', 'AgileCert Professional in Public-Sector Agile Leadership & Service Transformation', 'Agile Leadership Certifications', 'Professional', 'Citizen-centred services, modular procurement, policy delivery, accessibility and open-data transparency.'],
  ['AC-RLCA-P', 'AgileCert Professional in Resilient Leadership & Crisis Adaptation', 'Agile Leadership Certifications', 'Professional', 'Sense-and-respond leadership, crisis prioritisation, commander intent, antifragility and red teaming.'],
  ['AC-BAAG-E', 'AgileCert Executive in Board Agility & Adaptive Governance', 'Agile Leadership Certifications', 'Executive', 'Adaptive boards, staged investment, technology-risk governance, executive incentives and ESG integration.'],
  ['AC-RHDL-S', 'AgileCert Specialist in Remote, Hybrid & Distributed Team Leadership', 'Agile Leadership Certifications', 'Specialist', 'Asynchronous work, proximity-bias control, right-to-disconnect, outcome measures and time-zone equity.'],
] as const;

export const AGILE_PROGRAMME_CATALOGUE: readonly AgileProgrammeCatalogueItem[] = programmeRows.map(
  ([code, title, category, level, summary]) => ({
    code,
    title,
    category,
    level,
    summary,
    status: 'catalogue-preview' as const,
  }),
);
