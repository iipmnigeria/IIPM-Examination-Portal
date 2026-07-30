begin;

-- Review rows are immutable historical snapshots. They retain identifiers and text
-- without preventing a later approved replacement of question or option records.
alter table public.agilecert_cipmn_attempt_review_items
  drop constraint if exists agilecert_cipmn_attempt_review_items_question_id_fkey,
  drop constraint if exists agilecert_cipmn_attempt_review_items_selected_option_id_fkey,
  drop constraint if exists agilecert_cipmn_attempt_review_items_correct_option_id_fkey;

commit;
