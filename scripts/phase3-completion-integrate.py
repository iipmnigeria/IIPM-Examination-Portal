from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    print(f'Applying {label}')
    return text.replace(old, new, 1)


def patch_migration() -> None:
    path = Path('supabase/migrations/202607251800_phase_3_certificate_completion.sql')
    sql = path.read_text(encoding='utf-8')

    console_marker = 'create or replace function public.get_agilecert_certificate_completion_console('
    verify_marker = 'create or replace function public.verify_agilecert_certificate('
    console_start = sql.index(console_marker)
    console_end = sql.index(verify_marker, console_start)
    console = sql[console_start:console_end]

    if '  v_queue jsonb;' not in console:
        console = replace_once(
            console,
            "  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 250));\n  v_templates jsonb;",
            "  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 250));\n  v_queue jsonb;\n  v_templates jsonb;",
            'completion console queue declaration',
        )

    if "'approvalQueue', v_queue" not in console:
        queue_query = """
  select coalesce(jsonb_agg(payload order by approval_updated_at desc), '[]'::jsonb)
  into v_queue
  from (
    select er.approval_updated_at,
      jsonb_build_object(
        'eligibilityId', er.id,
        'candidateName', candidate.full_name,
        'candidateEmail', candidate.email,
        'examinationId', er.examination_id,
        'examinationTitle', e.title,
        'programmeCode', p.code,
        'score', er.score,
        'passMark', er.pass_mark,
        'integrityStatus', er.integrity_status,
        'eligibilityStatus', er.eligibility_status,
        'approvalStatus', er.approval_status,
        'approvalReason', er.approval_reason,
        'requestedAt', er.requested_at,
        'approvalUpdatedAt', er.approval_updated_at
      ) payload
    from public.agilecert_certificate_eligibility_records er
    join public.profiles candidate on candidate.id = er.candidate_id
    join public.examinations e on e.id = er.examination_id
    join public.programmes p on p.id = e.programme_id
    join public.agilecert_certificate_policies cp on cp.examination_id = er.examination_id
    where cp.approval_mode = 'manual'
      and er.eligibility_status <> 'issued'
      and er.approval_status in ('pending', 'changes_requested', 'rejected')
    order by er.approval_updated_at desc
    limit v_limit
  ) recent;

"""
        anchor = "  perform public.agilecert_require_certificate_admin();\n\n"
        console = replace_once(
            console,
            anchor,
            anchor + queue_query,
            'completion approval queue query',
        )
        console = replace_once(
            console,
            "  return jsonb_build_object(\n    'templates', v_templates,",
            "  return jsonb_build_object(\n    'templates', v_templates,\n    'approvalQueue', v_queue,",
            'completion approval queue response',
        )

    sql = sql[:console_start] + console + sql[console_end:]

    request_guard_text = "The candidate must submit a certificate request before issuance."
    if request_guard_text not in sql:
        manual_guard = """  if coalesce(v_policy.approval_mode, 'automatic') = 'manual'
     and coalesce(v_eligibility.approval_status, 'not_required') <> 'approved' then
    raise exception 'This certificate policy requires administrator approval before issuance.';
  end if;

  select e.programme_id into v_programme_id
"""
        guarded = """  if coalesce(v_policy.approval_mode, 'automatic') = 'manual'
     and coalesce(v_eligibility.approval_status, 'not_required') <> 'approved' then
    raise exception 'This certificate policy requires administrator approval before issuance.';
  end if;

  if coalesce(v_policy.require_candidate_request, false)
     and v_eligibility.eligibility_status not in ('requested', 'issued') then
    raise exception 'The candidate must submit a certificate request before issuance.';
  end if;

  select e.programme_id into v_programme_id
"""
        sql = replace_once(sql, manual_guard, guarded, 'candidate-request insert guard')

    workspace_marker = 'create or replace function public.get_my_agilecert_certificate_workspace_v2()'
    new_request_marker = "'request_submitted_for_approval'"
    if new_request_marker not in sql:
        request_function = r"""create or replace function public.request_my_agilecert_certificate(
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_eligibility_id uuid;
  v_record public.agilecert_certificate_eligibility_records%rowtype;
  v_policy public.agilecert_certificate_policies%rowtype;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  v_eligibility_id := public.evaluate_agilecert_certificate_eligibility(p_attempt_id);

  select * into v_record
  from public.agilecert_certificate_eligibility_records
  where id = v_eligibility_id
    and candidate_id = v_candidate_id
  for update;

  if not found then
    raise exception 'The certificate eligibility record is unavailable.';
  end if;
  if v_record.eligibility_status in ('blocked', 'revoked') then
    raise exception 'Certificate issuance is unavailable: %.', replace(v_record.reason_code, '_', ' ');
  end if;
  if v_record.eligibility_status = 'issued' then
    return jsonb_build_object(
      'eligibilityId', v_record.id,
      'status', 'issued',
      'message', 'This certificate has already been issued.'
    );
  end if;
  if v_record.approval_status = 'rejected' then
    raise exception 'This certificate request was rejected. Contact IIPM support for further review.';
  end if;

  select * into v_policy
  from public.agilecert_certificate_policies
  where examination_id = v_record.examination_id;

  update public.agilecert_certificate_eligibility_records
  set eligibility_status = 'requested',
      requested_at = now(),
      approval_status = case
        when coalesce(v_policy.approval_mode, 'automatic') = 'manual' then 'pending'
        else 'not_required'
      end,
      approval_reason = null,
      approval_decided_at = null,
      approval_decided_by = null,
      approval_updated_at = now(),
      updated_at = now()
  where id = v_record.id
  returning * into v_record;

  insert into public.agilecert_certificate_audit_events (
    eligibility_id, candidate_id, actor_id, event_type, metadata
  ) values (
    v_record.id,
    v_record.candidate_id,
    v_candidate_id,
    case when v_record.approval_status = 'pending'
      then 'request_submitted_for_approval'
      else 'request_submitted'
    end,
    jsonb_build_object('approvalStatus', v_record.approval_status)
  );

  return jsonb_build_object(
    'eligibilityId', v_record.id,
    'status', 'requested',
    'approvalStatus', v_record.approval_status,
    'message', case when v_record.approval_status = 'pending'
      then 'Your certificate request has been submitted for administrator approval.'
      else 'Your certificate request has been recorded.'
    end
  );
end;
$$;

"""
        sql = replace_once(
            sql,
            workspace_marker,
            request_function + workspace_marker,
            'approval-aware certificate request override',
        )

    path.write_text(sql, encoding='utf-8')


def patch_candidate_workspace() -> None:
    path = Path('src/components/CandidateCertificateWorkspace.tsx')
    text = path.read_text(encoding='utf-8')

    if "certificatePdfService" not in text:
        text = replace_once(
            text,
            "import { jsPDF } from 'jspdf';\n",
            "import { downloadCertificatePdf } from '../services/certificatePdfService';\n",
            'candidate QR PDF import',
        )
    text = text.replace('  type IssuedCertificateRecord,\n', '', 1)

    if 'const drawBarcode' in text:
        start = text.index('const verificationUrl = (code: string): string => {')
        end = text.index('const eligibilityBadge = (item: CandidateCertificateItem) => {')
        print('Removing legacy pseudo-barcode PDF renderer')
        text = text[:start] + text[end:]

    if "item.approvalStatus === 'changes_requested'" not in text.split('export default', 1)[0]:
        requested_badge = """  if (item.eligibilityStatus === 'requested') {
    return { label: 'Issuance requested', className: 'border-blue-200 bg-blue-50 text-blue-700' };
  }
"""
        approval_badges = """  if (item.approvalStatus === 'changes_requested') {
    return { label: 'Changes requested', className: 'border-amber-200 bg-amber-50 text-amber-700' };
  }
  if (item.approvalStatus === 'rejected') {
    return { label: 'Request rejected', className: 'border-rose-200 bg-rose-50 text-rose-700' };
  }
  if (item.approvalStatus === 'pending') {
    return { label: 'Approval pending', className: 'border-blue-200 bg-blue-50 text-blue-700' };
  }
  if (item.eligibilityStatus === 'requested') {
    return { label: 'Issuance requested', className: 'border-blue-200 bg-blue-50 text-blue-700' };
  }
"""
        text = replace_once(text, requested_badge, approval_badges, 'candidate approval badges')

    if 'downloadingCertificateId' not in text:
        text = replace_once(
            text,
            "  const [requestingAttemptId, setRequestingAttemptId] = useState('');\n",
            "  const [requestingAttemptId, setRequestingAttemptId] = useState('');\n  const [downloadingCertificateId, setDownloadingCertificateId] = useState('');\n",
            'candidate download state',
        )

    if 'const handleDownload = async' not in text:
        handler = """  const handleDownload = async (certificateId: string) => {
    try {
      setDownloadingCertificateId(certificateId);
      setError('');
      setMessage('');
      await downloadCertificatePdf(certificateId);
      setMessage('The QR-coded certificate PDF was generated from the current server record.');
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download the certificate PDF.');
    } finally {
      setDownloadingCertificateId('');
    }
  };

"""
        text = replace_once(text, '  if (!isCandidate) return null;\n', handler + '  if (!isCandidate) return null;\n', 'candidate QR download handler')

    old_rule = "const canRequest = item.eligibilityStatus === 'eligible' && !certificate;"
    if old_rule in text:
        text = replace_once(
            text,
            old_rule,
            "const canRequest = (item.eligibilityStatus === 'eligible' || item.approvalStatus === 'changes_requested') && !certificate;",
            'candidate request/resubmission rule',
        )

    if 'Resubmit certificate request' not in text:
        start_token = '                  ) : canRequest ? (\n'
        end_token = "                  ) : item.eligibilityStatus === 'requested' ? (\n"
        start = text.index(start_token)
        end = text.index(end_token, start)
        request_block = """                  ) : canRequest ? (
                    <div className="mt-5 space-y-3">
                      {item.approvalStatus === 'changes_requested' && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                          <p className="font-extrabold">Administrator changes requested</p>
                          <p className="mt-1">{item.approvalReason || 'Update the required candidate information before resubmitting.'}</p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleRequest(item)}
                        disabled={requestingAttemptId === item.attemptId}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {requestingAttemptId === item.attemptId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {item.approvalStatus === 'changes_requested' ? 'Resubmit certificate request' : 'Request certificate issuance'}
                      </button>
                    </div>
                  ) : item.approvalStatus === 'rejected' ? (
                    <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                      <p className="font-extrabold">Certificate request rejected</p>
                      <p className="mt-1 text-xs">{item.approvalReason || 'Contact IIPM support for further review.'}</p>
                    </div>
"""
        print('Replacing candidate request block with approval-aware flow')
        text = text[:start] + request_block + text[end:]

    if 'downloadIssuedCertificate(certificate)' in text:
        text = replace_once(
            text,
            'onClick={() => downloadIssuedCertificate(certificate)}',
            'onClick={() => void handleDownload(certificate.id)}',
            'candidate download action',
        )
        text = replace_once(
            text,
            "disabled={certificate.status !== 'active'}",
            "disabled={certificate.status !== 'active' || downloadingCertificateId === certificate.id}",
            'candidate download busy state',
        )
        text = replace_once(
            text,
            '<Download className="h-3.5 w-3.5" /> Download issued PDF',
            '{downloadingCertificateId === certificate.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download QR-coded PDF',
            'candidate QR PDF button label',
        )

    path.write_text(text, encoding='utf-8')


def patch_main() -> None:
    path = Path('src/main.tsx')
    text = path.read_text(encoding='utf-8')
    import_line = "import AdminCertificateCompletionLauncher from './components/AdminCertificateCompletionLauncher';\n"
    if import_line not in text:
        text = replace_once(
            text,
            "import AdminCertificateManagementLauncher from './components/AdminCertificateManagementLauncher';\n",
            "import AdminCertificateManagementLauncher from './components/AdminCertificateManagementLauncher';\n" + import_line,
            'Phase 3 completion launcher import',
        )
    mount_line = '      <AdminCertificateCompletionLauncher />\n'
    if mount_line not in text:
        text = replace_once(
            text,
            '      <AdminCertificateManagementLauncher />\n',
            '      <AdminCertificateManagementLauncher />\n' + mount_line,
            'Phase 3 completion launcher mount',
        )
    path.write_text(text, encoding='utf-8')


patch_migration()
patch_candidate_workspace()
patch_main()
print('Phase 3 completion integration patches applied successfully.')
