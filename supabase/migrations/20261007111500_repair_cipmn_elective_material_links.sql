begin;

-- Urgent production repair for CIPMN elective preparation materials.
-- EL02 had the correct PDF retained as version 1 but a later EL03 PDF was
-- accidentally published against the EL02 material record. EL01 also had two
-- active mappings pointing to identical Outcome Realisation PDFs.

do $repair$
declare
  v_el01_exam uuid := '9eb84cf2-bd25-f4ed-084b-413d7a976237';
  v_el01_duplicate_material uuid := 'fcbea8aa-4b0c-4d45-af68-075752aa560a';
  v_el02_material uuid := '98345394-2538-4d71-aee7-2c2f7de342ad';
  v_el02_correct_version uuid := '32e607cc-7f4b-4999-b4f0-67e654ad9a55';
  v_bucket text;
  v_path text;
begin
  select storage_bucket, storage_path
  into v_bucket, v_path
  from public.agilecert_preparation_material_versions
  where id = v_el02_correct_version
    and material_id = v_el02_material;

  if v_bucket is null or v_path is null then
    raise exception 'The approved EL02 material version could not be found.';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id = v_bucket
      and name = v_path
  ) then
    raise exception 'The approved EL02 private storage object is missing.';
  end if;

  update public.agilecert_preparation_material_versions
  set status = 'retired',
      updated_at = now()
  where material_id = v_el02_material
    and id <> v_el02_correct_version
    and status = 'published';

  update public.agilecert_preparation_material_versions
  set status = 'published',
      published_at = coalesce(published_at, now()),
      updated_at = now()
  where id = v_el02_correct_version
    and material_id = v_el02_material;

  update public.agilecert_preparation_materials
  set status = 'published',
      updated_at = now()
  where id = v_el02_material;

  delete from public.agilecert_exam_materials
  where examination_id = v_el01_exam
    and material_id = v_el01_duplicate_material;
end;
$repair$;

do $verify$
declare
  v_el01_exam uuid := '9eb84cf2-bd25-f4ed-084b-413d7a976237';
  v_el02_exam uuid := '98eedf01-59f6-979f-b2b9-2f55a640e6d0';
  v_el02_material uuid := '98345394-2538-4d71-aee7-2c2f7de342ad';
  v_el02_correct_version uuid := '32e607cc-7f4b-4999-b4f0-67e654ad9a55';
  v_count integer;
begin
  select count(*) into v_count
  from public.agilecert_exam_materials
  where examination_id = v_el01_exam
    and is_active = true;
  if v_count <> 1 then
    raise exception 'Expected exactly one active EL01 material mapping after repair; found %.', v_count;
  end if;

  if not exists (
    select 1
    from public.agilecert_exam_materials
    where examination_id = v_el02_exam
      and material_id = v_el02_material
      and is_active = true
  ) then
    raise exception 'EL02 material mapping is missing after repair.';
  end if;

  select count(*) into v_count
  from public.agilecert_preparation_material_versions
  where material_id = v_el02_material
    and status = 'published';
  if v_count <> 1 then
    raise exception 'Expected exactly one published EL02 material version; found %.', v_count;
  end if;

  if not exists (
    select 1
    from public.agilecert_preparation_material_versions
    where id = v_el02_correct_version
      and material_id = v_el02_material
      and status = 'published'
      and lower(file_name) like '%el02%'
  ) then
    raise exception 'The approved EL02 PDF is not the published version.';
  end if;
end;
$verify$;

commit;
