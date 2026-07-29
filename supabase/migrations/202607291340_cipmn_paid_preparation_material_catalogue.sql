begin;

-- Match the approved CIPMN PDF catalogue to the twelve paid module examinations.
-- Files remain in draft until an administrator imports them into the existing
-- private preparation-material bucket and publishes a version. Once published,
-- the existing entitlement triggers make each resource available only after a
-- verified paid/waived order or an approved administrator assignment for the
-- matching examination.

create table if not exists public.agilecert_material_source_manifests (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null unique
    references public.agilecert_preparation_materials(id) on delete cascade,
  delivery_mode text not null default 'secure_download'
    check (delivery_mode in ('secure_download', 'embedded_video')),
  source_provider text not null
    check (source_provider in ('google_drive', 'youtube', 'vimeo', 'other')),
  source_reference text not null check (length(trim(source_reference)) between 1 and 500),
  source_file_name text,
  source_size_bytes bigint check (source_size_bytes is null or source_size_bytes >= 0),
  target_storage_bucket text,
  target_storage_path text,
  import_status text not null default 'pending'
    check (import_status in ('pending', 'imported', 'failed', 'not_required')),
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agilecert_material_source_manifests enable row level security;

drop policy if exists agilecert_material_source_manifests_admin_manage
  on public.agilecert_material_source_manifests;
create policy agilecert_material_source_manifests_admin_manage
  on public.agilecert_material_source_manifests
  to authenticated
  using (public.is_exam_admin())
  with check (public.is_exam_admin());

revoke all on public.agilecert_material_source_manifests from anon, authenticated;
grant select, insert, update, delete on public.agilecert_material_source_manifests to authenticated;

comment on table public.agilecert_material_source_manifests is
  'Administrator-only import manifest for private preparation files and future embedded-video references. Source references are never returned by the candidate material RPC.';

do $seed$
declare
  v_programme_id uuid;
  v_module jsonb;
  v_exam_id uuid;
  v_pdf_material_id uuid;
  v_video_material_id uuid;
  v_esg_material_id uuid := public.cipmn_mock_seed_uuid('CIPMN-MATERIAL:ESG:REFERENCE');
  v_pdf_count integer;
  v_video_count integer;
  v_esg_mapping_count integer;
begin
  select id into v_programme_id
  from public.programmes
  where code = 'CIPMN-MOCK'
    and is_active = true
  limit 1;

  if v_programme_id is null then
    raise exception 'The active CIPMN-MOCK programme was not found.';
  end if;

  insert into public.agilecert_preparation_materials (
    id, title, description, material_type, status
  ) values (
    v_esg_material_id,
    'ESG in Project Management Practice',
    'Supplementary CIPMN reference material on environmental, social and governance considerations in project management practice.',
    'reference',
    'draft'
  )
  on conflict (id) do update set
    title = excluded.title,
    description = excluded.description,
    material_type = excluded.material_type,
    status = case
      when public.agilecert_preparation_materials.status = 'published' then 'published'
      else 'draft'
    end,
    updated_at = now();

  insert into public.agilecert_material_source_manifests (
    id,
    material_id,
    delivery_mode,
    source_provider,
    source_reference,
    source_file_name,
    source_size_bytes,
    target_storage_bucket,
    target_storage_path,
    import_status,
    metadata
  ) values (
    public.cipmn_mock_seed_uuid('CIPMN-MANIFEST:ESG:REFERENCE'),
    v_esg_material_id,
    'secure_download',
    'google_drive',
    '1wOPXZOWwRPoiZYoMiPz7nYT7VIM284dY',
    'CIPMN_ESG_in_Project_Management_Practice.pdf',
    1047491,
    'agilecert-preparation-materials',
    'cipmn/shared/CIPMN_ESG_in_Project_Management_Practice.pdf',
    'pending',
    jsonb_build_object('scope', 'all_cipmn_modules', 'required', false)
  )
  on conflict (material_id) do update set
    delivery_mode = excluded.delivery_mode,
    source_provider = excluded.source_provider,
    source_reference = excluded.source_reference,
    source_file_name = excluded.source_file_name,
    source_size_bytes = excluded.source_size_bytes,
    target_storage_bucket = excluded.target_storage_bucket,
    target_storage_path = excluded.target_storage_path,
    metadata = excluded.metadata,
    updated_at = now();

  for v_module in
    select value
    from jsonb_array_elements(
      '[
        {"code":"CIPMN-MOD-001","title":"Principles of Project Management","exam_id":"2e5fea8b-a4de-5c61-9a43-e53e9d28403f","drive_id":"1oJT8WLMnq3vzJSnq8x-wiOp63ylmHvwy","source_name":"CIPMN_MOD001_Projection_Legible_IIPM_CIPMN_Logos.pptx.pdf","target_name":"CIPMN_MOD001_Principles_of_Project_Management.pdf","size_bytes":6289479},
        {"code":"CIPMN-MOD-002","title":"Understanding Project Management Methodologies","exam_id":"fe7a116b-72ef-5d1f-acc8-36938ee8b0cf","drive_id":"18YPJGyDldlSICvsP13xPb-NFaravc6br","source_name":"CIPMN_MOD002_Project_Management_Methodologies_Training_Slides.pptx.pdf","target_name":"CIPMN_MOD002_Project_Management_Methodologies.pdf","size_bytes":614379},
        {"code":"CIPMN-MOD-003","title":"Project Delivery Conceptual Tools","exam_id":"916ed55c-e157-5e23-9d46-43ad4e2b9c2a","drive_id":"1Uey_2QOg4A5RDs54R8-gZZvqFcZRLTWt","source_name":"CIPMN_MOD003_Project_Delivery_Conceptual_Tools_Training_Slides.pptx.pdf","target_name":"CIPMN_MOD003_Project_Delivery_Conceptual_Tools.pdf","size_bytes":1892398},
        {"code":"CIPMN-MOD-004","title":"Requirements Engineering in Project Management","exam_id":"5322572d-27b0-5467-ab89-c6b45612b960","drive_id":"1BQIbY9Gh_5240ZJLE9dGlmEpQPDUbgJ3","source_name":"CIPMN_MOD004_Requirements_Engineering_Training_Slides.pptx (1).pdf","target_name":"CIPMN_MOD004_Requirements_Engineering.pdf","size_bytes":1486212},
        {"code":"CIPMN-MOD-005","title":"Project Risk and Issues Management","exam_id":"d0c77c9c-a711-5864-97ac-c930ca231773","drive_id":"1vNiCKNQnK0Ik6PHSXmdRAd-CifbrHrHM","source_name":"CIPMN_MOD005_Project_Risk_and_Issues_Management_Training_Slides.pptx.pdf","target_name":"CIPMN_MOD005_Project_Risk_and_Issues_Management.pdf","size_bytes":220153},
        {"code":"CIPMN-MOD-006","title":"Project Planning and Scheduling","exam_id":"63311ad6-4bc2-59b6-a5fd-283423c4a2ac","drive_id":"1aPmz8gl4a_8us9-AsXJ_aNtVFbEptuTf","source_name":"CIPMN_MOD006_Project_Planning_and_Scheduling_Training_Slides (1).pptx.pdf","target_name":"CIPMN_MOD006_Project_Planning_and_Scheduling.pdf","size_bytes":2076948},
        {"code":"CIPMN-MOD-007","title":"Project Scope and Change Management","exam_id":"a573f28c-a38a-5978-a6a9-42b1d8239935","drive_id":"1y4UsxksNgieDEnOXfE2ccD4nubM17g9q","source_name":"CIPMN_MOD007_Project_Scope_and_Change_Management_Training_Slides.pptx.pdf","target_name":"CIPMN_MOD007_Project_Scope_and_Change_Management.pdf","size_bytes":2251070},
        {"code":"CIPMN-MOD-008","title":"Project Quality Management","exam_id":"2eec289b-9c0b-57e4-a2c6-e288fa6d4a28","drive_id":"1AAI-lojBdnjJuQdDAh4706Fh6SqDF_YC","source_name":"CIPMN_MOD008_Project_Quality_Management_Training_Slides.pptx.pdf","target_name":"CIPMN_MOD008_Project_Quality_Management.pdf","size_bytes":2337016},
        {"code":"CIPMN-MOD-009","title":"Agile Delivery","exam_id":"8305ebe1-ea1e-5089-bf4c-cb5bac29a918","drive_id":"1ETu97kOJs76Mrke31kXR3a6LEnnKml24","source_name":"CIPMN_MOD009_Agile_Delivery_Training_Slides.pptx.pdf","target_name":"CIPMN_MOD009_Agile_Delivery.pdf","size_bytes":1992864},
        {"code":"CIPMN-MOD-010","title":"Project Leadership and Building High-Performing Teams","exam_id":"37eaf7f3-42c8-525c-8c28-cd9c3327da13","drive_id":"1pbxx87GVsGIh3TVdpOnGEILU8JU5-sPS","source_name":"CIPMN_MOD010_Project_Leadership_and_High_Performing_Teams_Training_Slides.pptx (1).pdf","target_name":"CIPMN_MOD010_Project_Leadership_and_High_Performing_Teams.pdf","size_bytes":2056786},
        {"code":"CIPMN-MOD-011","title":"Understanding DUCAP Methodology","exam_id":"6561efd6-938e-5da0-aae3-520349741cc9","drive_id":"1tN5lto4MFoCSByUlBoxQHWIGzrgroT48","source_name":"CIPMN_MOD011_Understanding_DUCAP_Methodology_Training_Slides(1).pptx (1).pdf","target_name":"CIPMN_MOD011_Understanding_DUCAP_Methodology.pdf","size_bytes":2408198},
        {"code":"CIPMN-MOD-012","title":"Managing Successful International Programs and Portfolios","exam_id":"5c49847b-3944-5034-b620-0a3c5a1c7523","drive_id":"1SUkooJES8H72Lb0dZHY5mgb_dhQY-TvS","source_name":"CIPMN_MOD012_Project_Procurement_and_Contract_Management_Training_Slides.pptx (1).pdf","target_name":"CIPMN_MOD012_Project_Procurement_and_Contract_Management.pdf","size_bytes":2475194}
      ]'::jsonb
    )
  loop
    v_exam_id := (v_module ->> 'exam_id')::uuid;
    v_pdf_material_id := public.cipmn_mock_seed_uuid('CIPMN-MATERIAL:' || (v_module ->> 'code') || ':PDF');
    v_video_material_id := public.cipmn_mock_seed_uuid('CIPMN-MATERIAL:' || (v_module ->> 'code') || ':VIDEO');

    if not exists (
      select 1
      from public.examinations e
      where e.id = v_exam_id
        and e.programme_id = v_programme_id
        and e.title like (v_module ->> 'code') || ' - %'
    ) then
      raise exception 'Expected CIPMN examination % was not found or does not match its module code.', v_module ->> 'code';
    end if;

    insert into public.agilecert_preparation_materials (
      id, title, description, material_type, status
    ) values (
      v_pdf_material_id,
      (v_module ->> 'code') || ' Study Material - ' || (v_module ->> 'title'),
      'Official CIPMN PDF study material matched to ' || (v_module ->> 'code') || '. It will be released through the secure candidate library after private import and publication.',
      'study_guide',
      'draft'
    )
    on conflict (id) do update set
      title = excluded.title,
      description = excluded.description,
      material_type = excluded.material_type,
      status = case
        when public.agilecert_preparation_materials.status = 'published' then 'published'
        else 'draft'
      end,
      updated_at = now();

    insert into public.agilecert_preparation_materials (
      id, title, description, material_type, status
    ) values (
      v_video_material_id,
      (v_module ->> 'code') || ' Video Lesson - ' || (v_module ->> 'title'),
      'Reserved video-learning slot for the corresponding CIPMN module. A Google Drive, YouTube, Vimeo or securely hosted video reference may be configured later without changing the examination-to-material mapping.',
      'video',
      'draft'
    )
    on conflict (id) do update set
      title = excluded.title,
      description = excluded.description,
      material_type = excluded.material_type,
      updated_at = now();

    insert into public.agilecert_exam_materials (
      examination_id, material_id, position, is_required, is_active
    ) values (
      v_exam_id, v_pdf_material_id, 1, true, true
    )
    on conflict (examination_id, material_id) do update set
      position = 1,
      is_required = true,
      is_active = true,
      updated_at = now();

    insert into public.agilecert_exam_materials (
      examination_id, material_id, position, is_required, is_active
    ) values (
      v_exam_id, v_video_material_id, 2, false, true
    )
    on conflict (examination_id, material_id) do update set
      position = 2,
      is_required = false,
      is_active = true,
      updated_at = now();

    insert into public.agilecert_exam_materials (
      examination_id, material_id, position, is_required, is_active
    ) values (
      v_exam_id, v_esg_material_id, 3, false, true
    )
    on conflict (examination_id, material_id) do update set
      position = 3,
      is_required = false,
      is_active = true,
      updated_at = now();

    insert into public.agilecert_material_source_manifests (
      id,
      material_id,
      delivery_mode,
      source_provider,
      source_reference,
      source_file_name,
      source_size_bytes,
      target_storage_bucket,
      target_storage_path,
      import_status,
      metadata
    ) values (
      public.cipmn_mock_seed_uuid('CIPMN-MANIFEST:' || (v_module ->> 'code') || ':PDF'),
      v_pdf_material_id,
      'secure_download',
      'google_drive',
      v_module ->> 'drive_id',
      v_module ->> 'source_name',
      (v_module ->> 'size_bytes')::bigint,
      'agilecert-preparation-materials',
      'cipmn/' || lower(v_module ->> 'code') || '/' || (v_module ->> 'target_name'),
      'pending',
      jsonb_build_object(
        'moduleCode', v_module ->> 'code',
        'moduleTitle', v_module ->> 'title',
        'required', true,
        'candidateAccess', 'verified examination payment, waiver or administrator assignment'
      )
    )
    on conflict (material_id) do update set
      delivery_mode = excluded.delivery_mode,
      source_provider = excluded.source_provider,
      source_reference = excluded.source_reference,
      source_file_name = excluded.source_file_name,
      source_size_bytes = excluded.source_size_bytes,
      target_storage_bucket = excluded.target_storage_bucket,
      target_storage_path = excluded.target_storage_path,
      metadata = excluded.metadata,
      updated_at = now();

    insert into public.agilecert_material_source_manifests (
      id,
      material_id,
      delivery_mode,
      source_provider,
      source_reference,
      source_file_name,
      source_size_bytes,
      target_storage_bucket,
      target_storage_path,
      import_status,
      metadata
    ) values (
      public.cipmn_mock_seed_uuid('CIPMN-MANIFEST:' || (v_module ->> 'code') || ':VIDEO'),
      v_video_material_id,
      'embedded_video',
      'google_drive',
      'pending',
      null,
      null,
      null,
      null,
      'pending',
      jsonb_build_object(
        'moduleCode', v_module ->> 'code',
        'moduleTitle', v_module ->> 'title',
        'allowedProviders', jsonb_build_array('google_drive', 'youtube', 'vimeo'),
        'candidateAccess', 'verified examination payment, waiver or administrator assignment'
      )
    )
    on conflict (material_id) do update set
      delivery_mode = excluded.delivery_mode,
      metadata = excluded.metadata,
      updated_at = now();
  end loop;

  select count(*) into v_pdf_count
  from public.agilecert_exam_materials em
  join public.agilecert_preparation_materials m on m.id = em.material_id
  join public.examinations e on e.id = em.examination_id
  where e.programme_id = v_programme_id
    and m.material_type = 'study_guide'
    and m.title like 'CIPMN-MOD-% Study Material - %'
    and em.position = 1
    and em.is_required = true
    and em.is_active = true;

  select count(*) into v_video_count
  from public.agilecert_exam_materials em
  join public.agilecert_preparation_materials m on m.id = em.material_id
  join public.examinations e on e.id = em.examination_id
  where e.programme_id = v_programme_id
    and m.material_type = 'video'
    and m.title like 'CIPMN-MOD-% Video Lesson - %'
    and em.position = 2
    and em.is_active = true;

  select count(*) into v_esg_mapping_count
  from public.agilecert_exam_materials em
  join public.examinations e on e.id = em.examination_id
  where e.programme_id = v_programme_id
    and em.material_id = v_esg_material_id
    and em.position = 3
    and em.is_active = true;

  if v_pdf_count <> 12 then
    raise exception 'Expected 12 CIPMN PDF mappings, found %.', v_pdf_count;
  end if;
  if v_video_count <> 12 then
    raise exception 'Expected 12 CIPMN video placeholders, found %.', v_video_count;
  end if;
  if v_esg_mapping_count <> 12 then
    raise exception 'Expected the ESG reference to be mapped to all 12 CIPMN examinations, found % mappings.', v_esg_mapping_count;
  end if;

  if exists (
    select 1
    from public.agilecert_preparation_material_versions mv
    join public.agilecert_preparation_materials m on m.id = mv.material_id
    where m.title like 'CIPMN-MOD-% Study Material - %'
      and mv.status = 'published'
      and not exists (
        select 1
        from storage.objects o
        where o.bucket_id = mv.storage_bucket
          and o.name = mv.storage_path
      )
  ) then
    raise exception 'A CIPMN material version is marked published without a matching private storage object.';
  end if;
end;
$seed$;

commit;
