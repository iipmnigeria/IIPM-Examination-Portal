# Video Progress and Learning Analytics — Production Release

Release date: 2026-08-01

## Approved source

- Feature pull request: #248 — Add video progress and learning analytics
- Approved source branch: `supabase-integration`
- Approved source merge commit: `c29e18cc137ca1ee43f704171d5d4fb1691824c7`
- Migration: `202608010520_video_progress_learning_analytics.sql`

## Production database release

- Production-control registration pull request: #249
- Registration merge commit: `9a58d262d8fc290c07e3c3de85a6983a8ddf9711`
- One-use trigger pull request: #250, closed without merge
- Controlled production run: `30684008567`
- Result: success
- Production evidence artifact: `8813274358`
- Production evidence digest: `sha256:fa65ad2ad87725d0eadb40893ae6db83557f822c467d564bfab0439cbafdcd01`

The release workflow stopped unless production reported exactly the approved migration as pending. It built the exact approved frontend, applied only the approved migration, verified the migration ledger, and retained sanitized evidence.

## Frontend publication

- Publication pull request: #251
- GitHub Pages trigger commit: `ffecedfe1c8bed4ea6577d0beaf6a391dc5af08e`
- GitHub Pages run: `30684076729`
- GitHub Pages result: success
- Namecheap source commit: `c29e18cc137ca1ee43f704171d5d4fb1691824c7`
- Namecheap run: `30683891527`
- Namecheap result: success

## Independent production verification

- Verification-control registration pull request: #252
- Verification-control merge commit: `8d81d250e319aa86d66a362264b4e7246c741de5`
- One-use verification trigger pull request: #253, closed without merge
- Verification run: `30684170083`
- Result: success
- Verification artifact: `8813324627`
- Verification artifact digest: `sha256:950fd4a6f43d83c2845bd268d5d9a0660bafd1e7e99d66eaf819600f35c477af`

The verifier rebuilt the approved source and confirmed:

- the GitHub Pages and Namecheap deployment runs completed successfully;
- the public GitHub Pages JavaScript bundle matched the approved build byte-for-byte;
- approved and live bundle SHA-256: `7ea58651ed108188c05b4447e08a403717174efe4b918470e42ada9025410df5`;
- all required candidate and administrator learning-progress markers were present in the public bundle;
- the Namecheap deployment workflow completed for the approved source commit;
- the Namecheap deployment manifest endpoint returned HTTP 403 to the external GitHub runner and was recorded as externally protected rather than treated as a release failure;
- the production learning-progress table exists with row-level security enabled;
- the playback-progress trigger is enabled;
- all four protected learning-progress functions are security-definer functions;
- anonymous execution is not exposed;
- authenticated users have no direct insert, update or delete access to the progress table;
- authorised video playback audits and summed progress-open counts reconciled exactly at verification time: 5 and 5;
- no invalid completion-percentage record existed.

## Released candidate capabilities

- video learning-progress workspace in the Candidate Tools menu;
- authorised viewing history and opening counts;
- continue/open lesson navigation;
- candidate-controlled lesson completion and return-to-in-progress;
- available, started and completed lesson summaries.

## Released administrator capabilities

- Video Progress and Learning Analytics workspace in Administrator Tools;
- candidate, programme, examination and lesson reporting;
- authorised openings, last activity and completion status;
- 30-day activity, completion rate and engaged-candidate summaries;
- search and programme filtering.

## Technical boundary

Google Drive preview playback does not expose current playback time, seeking or player events to the portal. This release records authoritative playback authorisations, opening history and candidate-confirmed lesson completion. Exact continue-from-second resume, watched-duration analytics and automatic watched percentage remain reserved for a controllable standards-based or provider-supported video player.

## Cleanup

The temporary production deployment and production verification workflows were removed after successful release verification. The permanent feature validation workflow remains with the application source.
