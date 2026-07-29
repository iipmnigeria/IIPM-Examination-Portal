begin;

-- Correct CIPMN Module 012 to the approved curriculum title while preserving
-- the existing examination, price, assignments, orders, attempts and material
-- mappings attached to the deterministic examination identifier.

do $$
declare
  v_programme_id uuid;
  v_exam_id uuid := '5c49847b-3944-5034-b620-0a3c5a1c7523'::uuid;
  v_pdf_material_id uuid := public.cipmn_mock_seed_uuid('CIPMN-MATERIAL:CIPMN-MOD-012:PDF');
  v_video_material_id uuid := public.cipmn_mock_seed_uuid('CIPMN-MATERIAL:CIPMN-MOD-012:VIDEO');
  v_updated_count integer;
begin
  select id
  into v_programme_id
  from public.programmes
  where code = 'CIPMN-MOCK'
    and is_active = true
  limit 1;

  if v_programme_id is null then
    raise exception 'The active CIPMN-MOCK programme was not found.';
  end if;

  update public.examinations
  set title = 'CIPMN-MOD-012 - Project Procurement and Contract Management Mock Examination',
      updated_at = now()
  where id = v_exam_id
    and programme_id = v_programme_id;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'Expected to update one CIPMN Module 012 examination, updated %.', v_updated_count;
  end if;

  update public.agilecert_preparation_materials
  set title = 'CIPMN-MOD-012 Study Material - Project Procurement and Contract Management',
      description = 'Official CIPMN PDF study material matched to CIPMN-MOD-012: Project Procurement and Contract Management. It is released through the secure candidate library only after private import, publication and a valid examination entitlement.',
      updated_at = now()
  where id = v_pdf_material_id;

  update public.agilecert_preparation_materials
  set title = 'CIPMN-MOD-012 Video Lesson - Project Procurement and Contract Management',
      description = 'Reserved video-learning slot for CIPMN-MOD-012: Project Procurement and Contract Management. A Google Drive, YouTube, Vimeo or securely hosted video reference may be configured without changing the examination payment entitlement.',
      updated_at = now()
  where id = v_video_material_id;

  if not exists (
    select 1
    from public.examinations e
    where e.id = v_exam_id
      and e.programme_id = v_programme_id
      and e.title = 'CIPMN-MOD-012 - Project Procurement and Contract Management Mock Examination'
      and e.status = 'published'
      and e.requires_payment = true
  ) then
    raise exception 'CIPMN Module 012 title or payment protection was not correctly preserved.';
  end if;
end;
$$;

commit;
