# AgileCert Evidence-Backed Proctoring Audit

## Objective

Remove arbitrary client-side suspicion percentages and require every examination-integrity decision to be supported by persisted events, private visual evidence where applicable, and a written administrator reason.

## What changes

- The legacy Super Admin `Clear` and `Flag` controls no longer assign fixed 15% or 75% values.
- The server calculates the integrity risk score from persisted proctor events.
- Repeated events of one type are capped so a noisy browser event cannot automatically create a maximum score.
- Visual AI events such as phone detection, multiple people, no face, notes, or looking away contribute zero risk unless a private event snapshot was retained.
- Browser events such as tab changes, focus loss, clipboard activity, and camera failure remain auditable without a photograph.
- Event snapshots are stored in the private `agilecert-proctor-evidence` bucket and opened through short-lived signed URLs.
- Super Admin review decisions require a written reason and are saved in `agilecert_attempt_integrity_reviews`.
- Flagging requires persisted evidence and an evidence score of at least 25.
- Invalidation requires a score of at least 60 plus visual evidence or at least two high-severity nonvisual events.

## Existing records

The migration recalculates old scores from the events that actually exist. A positive score with no persisted supporting event is reset and annotated as a removed legacy score. Reviewed or terminated records are not automatically overturned.

## Super Admin workflow

1. Open **Control Hub → Examination Integrity Audit**.
2. Select the candidate attempt.
3. Compare the stored score with the server evidence score.
4. Review the chronological event report and any private snapshot.
5. Record one of the controlled decisions:
   - Insufficient evidence
   - Clear after review
   - Flag with evidence
   - Invalidate attempt
6. Enter a specific reason. The decision, score, counts, reviewer, and time are retained immutably.

## Privacy and retention

Snapshots are private, candidate-scoped, and limited to JPEG or PNG files up to 3 MB. The browser does not receive a public URL. Administrators receive a temporary signed URL only when opening a specific evidence item.

## Release boundary

This patch does not alter questions, answer keys, academic grading, examination prices, payments, certificates, or communications automation. The migration must be reviewed and applied separately before the new evidence RPCs and storage controls are available in production.
