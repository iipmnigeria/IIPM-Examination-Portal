# CIPMN Third-Attempt Remediation — Production Release Record

## Release status

Completed on 30 July 2026.

The CIPMN Professional Licensing Module mock examinations now provide up to three attempts for each paid or otherwise authorised module access. Correct answers remain protected after attempts one and two. After the third completed attempt and examination-integrity clearance, the authenticated candidate may review only questions answered incorrectly or left unanswered, including the selected answer, protected correct answer and approved explanation.

## Approved source

- Feature pull request: `#177` — Add CIPMN third-attempt remediation and secure answer review
- Approved feature source: `c82672cd096ecdeba37e3b073e173c46be0b865d`
- Merged `supabase-integration` release commit: `f8a38e57302f16e4b5b33b9f8c8c6a9dfac26a4c`

## Production database release

Controlled production workflow run: `30570830840`

Exactly these forward-only migrations were applied:

1. `202607301730_cipmn_third_attempt_remediation.sql`
2. `202607301731_cipmn_review_snapshot_decoupling.sql`
3. `202607301732_cipmn_review_composite_row_fix.sql`

The production verification confirmed:

- all 12 `CIPMN-MOCK` examinations use the approved three-attempt policy;
- the protected review functions are security-definer functions;
- the two third-attempt review triggers are active;
- authenticated users do not have direct `SELECT` access to review snapshot tables;
- authenticated users do not have direct `SELECT` access to `question_answer_keys`;
- no remediation migration remained pending after deployment.

## Production candidate lifecycle validation

The complete three-attempt lifecycle was exercised against the production schema inside a transaction that ended with `ROLLBACK`.

The test confirmed:

- attempts one and two did not release protected answers;
- the third attempt generated one protected review;
- only the failed response was included in the review snapshot;
- the selected answer, correct answer and explanation were returned by the candidate-owned protected RPC;
- a second candidate could not access the first candidate's review;
- one idempotent operational remediation email was queued inside the rolled-back transaction;
- the email contained learning explanations and a secure portal call-to-action without reproducing the detailed answer key.

No synthetic candidate, attempt, review or email record from this validation was committed to production.

## Frontend publication verification

Read-only production verification workflow run: `30571370843`

### GitHub Pages

Live URL: `https://iipmnigeria.github.io/IIPM-Examination-Portal/`

The live compiled JavaScript bundle exactly matched the approved build by SHA-256:

`0cb7057d76f4042ac729279b3d30ed55920ed98dd88166c86d65aa8808a2420a`

The live bundle contained the approved production markers:

- `CIPMN Answer Review`
- the third-attempt protected-release notice
- `agilecert-cipmn-remediation-open`
- `get_my_cipmn_attempt_review`

### Namecheap production portal

Live URL: `https://agilecert.iipmi.org/`

Exact-source Namecheap deployment workflow run: `30570928367`

All Namecheap deployment jobs completed successfully for merge commit `f8a38e57302f16e4b5b33b9f8c8c6a9dfac26a4c`. The hosting WAF returned its known HTTP 403 response to the GitHub-hosted external asset request, so the successful exact-commit deployment workflow and server-side release checks serve as the Namecheap publication evidence. The GitHub Pages bundle was independently downloaded and hash-verified.

## Communication and integrity controls

- The remediation email is operational and uses the existing controlled communications outbox.
- The email is idempotent per third attempt.
- Detailed question text and the protected answer key are not reproduced in email.
- A flagged, terminated or actively held integrity result blocks answer release and email delivery.
- Review creation and review opening are audit logged.
- Review snapshots preserve historical text while allowing future approved question-bank replacement.

## Closed release controls

The unmerged database deployment trigger pull request `#179` and the unmerged frontend verification trigger pull request `#182` were closed after successful execution. The temporary one-time workflow registrations and markers were removed after this permanent release record was created.
