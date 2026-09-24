-- Phase 2B: additive-only CIPMN 40/60 scoring contract.
-- This migration intentionally does not alter question points, rubrics,
-- exam/session state, submissions, proctoring, payments, or existing RPCs.

create or replace function public.agilecert_cipmn_weighted_score(
  p_mcq_percentage numeric,
  p_theory_percentage numeric
)
returns jsonb
language sql
immutable
set search_path = public
as $function$
  select jsonb_build_object(
    'mcqPercentage', case when p_mcq_percentage is null then null else round(greatest(0::numeric, least(100::numeric, p_mcq_percentage)), 2) end,
    'mcqWeightedMark', case when p_mcq_percentage is null then null else round(greatest(0::numeric, least(100::numeric, p_mcq_percentage)) * 0.40, 2) end,
    'mcqMaximumMark', 40,
    'theoryPercentage', case when p_theory_percentage is null then null else round(greatest(0::numeric, least(100::numeric, p_theory_percentage)), 2) end,
    'theoryWeightedMark', case when p_theory_percentage is null then null else round(greatest(0::numeric, least(100::numeric, p_theory_percentage)) * 0.60, 2) end,
    'theoryMaximumMark', 60,
    'overallMark', case
      when p_mcq_percentage is null or p_theory_percentage is null then null
      else round(
        greatest(0::numeric, least(100::numeric, p_mcq_percentage)) * 0.40
        + greatest(0::numeric, least(100::numeric, p_theory_percentage)) * 0.60,
        2
      )
    end,
    'overallMaximumMark', 100,
    'complete', p_mcq_percentage is not null and p_theory_percentage is not null
  );
$function$;

comment on function public.agilecert_cipmn_weighted_score(numeric, numeric) is
  'Pure CIPMN score normalizer: MCQ contributes 40 marks and Theory contributes 60 marks. Additive contract only; does not mutate examination data.';

grant execute on function public.agilecert_cipmn_weighted_score(numeric, numeric) to authenticated;
