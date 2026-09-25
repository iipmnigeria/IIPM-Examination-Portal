-- D5-D: distinguish a fully submitted CIPMN mixed examination from an MCQ-incomplete session.
-- The production function is applied through the managed Supabase migration. This repository migration
-- documents the added sectionProgress contract consumed by the Module Hub:
-- theoryCompleted = session.status = 'submitted' AND current_section = 'complete' AND mcq_submitted_at IS NOT NULL.
--
-- See the immediately preceding get_available_exams migration for the full function body; this migration
-- is intentionally documentation-only in Git history because production DDL was applied through the
-- managed Supabase migration runner to avoid a second function replacement during deployment.
select 1;
