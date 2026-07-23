# AgileCert Global — Master Product and Implementation Specification

**Brand:** AgileCert Global  
**Endorsement line:** Powered by the Integrated Institute of Professional Management (IIPM)  
**Development branch:** `certificate-commerce-v2`  
**Production branch:** `supabase-integration`

## 1. Product role

AgileCert Global is an independent, examination-led platform for niche, modular and specialist professional credentials. It is separate from the IIPM main professional ecosystem.

### IIPM main site

The IIPM main site provides full professional certification courses that normally include structured training, facilitation, assignments, examinations, membership and professional progression.

Examples include:

- Project Management Foundation Certified (PMFC)
- Certified Project Management Associate (CPMA)
- Certified Project Management Professional (CPMP)

### AgileCert Global

AgileCert Global provides focused competency examinations and stackable modular credentials. Training is optional rather than compulsory.

Examples include:

- Project Risk and Quality Management
- Project Planning and Schedule Management
- Project Communication and Information Management
- Agile Project Management
- Project Cost and Budget Management
- Procurement and Contract Management
- Project Monitoring and Control
- Stakeholder Engagement Management
- HR Analytics
- Performance Management
- Cybersecurity Fundamentals

The two platforms must remain commercially and technically independent while supporting links, cross-selling and a shared credential-verification point.

## 2. Positioning and independence

Approved positioning:

> AgileCert Global provides independent professional competency examinations, preparation resources and verifiable specialist credentials for candidates worldwide. Powered by IIPM.

Required disclosure:

> AgileCert Global credentials are independently developed and issued by AgileCert Global, powered by IIPM. References to external standards, frameworks or certification organisations are for educational and competency-mapping purposes only and do not imply affiliation, authorisation, endorsement or equivalence.

Do not use external certification-body logos without written permission. Plain-text references may be used only where legally appropriate and accompanied by the independence disclosure.

## 3. Candidate journey

1. Visitor explores the specialist certification catalogue.
2. The AI Certification Adviser recommends suitable modular credentials.
3. Candidate creates a profile and confirms country, currency, time zone and communication preferences.
4. Candidate sees a clear disclosure that examination and certificate fees are separate.
5. Candidate pays the examination fee.
6. Preparation PDF materials unlock automatically after verified examination payment.
7. Candidate takes the secured examination.
8. A passing candidate receives a congratulations popup and becomes certificate-eligible.
9. The candidate selects either a Certificate of Achievement or Professional Certificate.
10. The seven-day early-price window is calculated from the server-recorded passing timestamp.
11. After verified certificate payment, the credential, digital badge, transcript and verification record are generated automatically.
12. Certificate reminder emails stop immediately after purchase.
13. Relevant AgileCert modular credentials and IIPM full professional programmes are then marketed to the candidate.

Failed candidates receive results, preparation guidance and a retake pathway. They do not receive certificate purchase options until they pass.

## 4. Mandatory fee disclosure

The following notice must appear on programme pages, examination checkout, receipts and examination instructions:

> **Important:** The examination fee covers examination access and downloadable preparation materials. Certificate issuance is optional and attracts a separate fee after the candidate meets the required pass mark.

Certificate pricing must be visible before examination payment.

## 5. Certificate products and pricing

### Certificate of Achievement

Confirms that the candidate passed the specialist examination.

| Market | Early price — within 7 days | Standard price |
|---|---:|---:|
| Nigeria | NGN 20,000 | NGN 25,000 |
| International | USD 35 | USD 50 |

Includes:

- Digital PDF certificate
- Unique credential number
- QR-linked public verification
- Candidate name, examination title, score and issue date
- Achievement digital badge

### Professional Certificate

Provides a higher-assurance professional credential.

| Market | Early price — within 7 days | Standard price |
|---|---:|---:|
| Nigeria | NGN 50,000 | NGN 75,000 |
| International | USD 60 | USD 75 |

Includes everything in the Certificate of Achievement, plus:

- Government-issued identity verification status
- AI-proctor integrity clearance
- Enhanced professional digital badge
- Formal examination transcript/result statement
- Public professional credential profile
- LinkedIn-ready credential information
- Credential lifecycle status: active, suspended or revoked

Passing establishes eligibility only. It does not create certificate ownership. A credential may be issued only after verified payment or an authorised waiver.

## 6. Seven-day revenue window

The early-price window remains seven calendar days from the exact server-recorded passing timestamp.

Recommended reminder cadence:

- Immediately after passing
- Day 2
- Day 5
- Final day 7 reminder
- Day 10 or 14 standard-price reminder

After certificate purchase, all certificate-reminder jobs must be cancelled and the candidate moved into relevant-course recommendations.

## 7. Digital badges and LinkedIn

Each paid credential receives a verifiable digital badge with:

- Candidate identity
- Issuer
- Credential title
- Achievement criteria
- Score or achievement level
- Issue date
- Credential ID
- Verification URL
- Expiration date where applicable
- Active, suspended or revoked status
- Evidence metadata

The credential screen must provide:

- Add to LinkedIn Profile
- Share on LinkedIn
- Copy verification link
- Download certificate
- Download/share badge

## 8. Candidate profile and settings

The candidate profile is the central account area and includes:

- Legal name and profile photograph
- Email and telephone
- Country, currency, language and time zone
- Professional headline, employer and industry
- Education, skills and certification interests
- Identity-verification status
- Public-profile visibility
- Purchased examinations and materials
- Examination attempts, results and transcripts
- Certificate offers and countdowns
- Certificates, badges and verification links
- Marketing consent and communication preferences
- Password, security and two-factor authentication settings
- Data export and account-deletion request controls

## 9. Study materials

PDF preparation materials unlock only after successful examination-payment verification.

Each material record should support:

- Examination/programme mapping
- Version number
- Active/inactive status
- Secure storage path
- Copyright notice
- Candidate watermarking where technically feasible
- Download audit

## 10. AI Certification Adviser

The platform will provide 24/7 AI-powered candidate support with human escalation for exceptional cases.

The adviser may:

- Recommend certifications
- Explain requirements, pass marks and separate fees
- Assist with registration and checkout
- Guide candidates to preparation materials
- Explain examination rules
- Check authenticated payment and credential status
- Recover incomplete sales
- Recommend related modular credentials and IIPM full programmes

The adviser must never:

- Claim unauthorised affiliations
- Reveal examination questions or answer keys
- Change results
- Promise refunds or certification outside approved rules
- Disclose personal data without authentication

## 11. Homepage structure

The public landing page should contain:

1. AgileCert Global hero and value proposition
2. Searchable modular certification catalogue
3. How it works
4. Separate examination/certificate pricing disclosure
5. Specialist competency categories
6. Credential benefits
7. Certificate and digital-badge verification demonstration
8. Examination integrity and proctoring
9. Candidate testimonials
10. Frequently asked questions
11. AI Certification Adviser
12. Genuine IIPM approvals/affiliations only
13. Final registration call to action

## 12. Payment identity

The intended checkout identity is:

- **Trading name:** AgileCert Global by IIPM
- **Legal entity:** Integrated Institute of Professional Management

The certification platform must use payment keys, webhook configuration, transaction references and reporting that are operationally separable from the IIPM main-site checkout.

No Paystack secret may appear in frontend code or GitHub.

## 13. Shared verification and cross-selling

The IIPM site and AgileCert Global operate independently but may share a credential-verification service.

Verification records should identify:

- Credential holder
- Credential title
- Issuing platform
- Powered-by relationship
- Credential number
- Issue date
- Status
- Achievement criteria
- Examination-only or training pathway

Cross-selling rules:

- AgileCert modular candidates may be referred to IIPM full professional programmes.
- IIPM learners may be referred to AgileCert specialist modular credentials.
- The two platforms must not sell apparently identical credentials at conflicting prices.

## 14. Automation principle

The platform is designed to operate with little or no routine human intervention.

Automated processes include:

- Payment confirmation
- Material entitlement
- Examination assignment
- Grading
- Pass/fail result presentation
- Certificate eligibility
- Seven-day pricing
- Reminder scheduling and cancellation
- Credential issuance
- Badge creation
- Verification activation
- LinkedIn sharing data
- Receipts and delivery emails
- Cross-selling

Human intervention is reserved for:

- Identity mismatches
- Payment disputes
- Suspected examination fraud
- Revoked or challenged results
- Exceptional refunds
- Legal/compliance cases

## 15. Delivery phases

### Phase 1 — Foundation

- Brand configuration
- Candidate profile/settings schema
- Certificate products and server-priced offers
- Study-material records and entitlements
- Credential and badge records
- Marketing/reminder job records
- Public verification RPC

### Phase 2 — Candidate commerce

- Congratulations popup
- Certificate-selection and payment interface
- Paystack certificate-order Edge Functions
- Server-side seven-day pricing
- Locked certificate download until verified purchase

### Phase 3 — Credentials

- Server-authorised certificate generation
- Digital badges
- Transcript generation
- QR/public verification
- LinkedIn profile/share actions

### Phase 4 — Materials and profiles

- Secure PDF material downloads
- Candidate profile and settings UI
- Identity-verification workflow
- Public credential profile

### Phase 5 — Automation and AI adviser

- Email reminder engine
- Stop-on-purchase logic
- Cross-selling campaigns
- AI Certification Adviser with authenticated tools and escalation

### Phase 6 — Landing page and launch

- AgileCert Global public homepage
- International catalogue and country-aware pricing
- Legal disclosures
- End-to-end QA, security review and controlled production deployment

## 16. Production safety

All work must remain on `certificate-commerce-v2` until database migrations, Edge Functions, UI, email workflows, credential verification, payment tests and build validation have passed.

Do not deploy or merge into `supabase-integration` without explicit acceptance.