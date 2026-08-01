from __future__ import annotations

import datetime
import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

PROJECT_REF = os.environ["PROJECT_REF"]
ACCESS_TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"]
EXPECTED_SOURCE_COMMIT = os.environ["EXPECTED_SOURCE_COMMIT"]
LIVE_BASE_URL = os.environ["LIVE_BASE_URL"]
APP_DIR = Path(os.environ["APP_DIR"])
ENDPOINT = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"


def database_query(sql: str, label: str) -> list[dict[str, Any]]:
    request = urllib.request.Request(
        ENDPOINT,
        data=json.dumps({"query": sql}).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {ACCESS_TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "IIPM-Finance-Console-Commissioning-v4",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        Path(f"commissioning-{label}-http-error.json").write_text(raw, encoding="utf-8")
        raise RuntimeError(f"{label} HTTP {exc.code}: {raw}") from exc
    result = json.loads(raw)
    if not isinstance(result, list):
        Path(f"commissioning-{label}-unexpected.json").write_text(raw, encoding="utf-8")
        raise AssertionError(result)
    return result


STATE_SQL = r"""
with protected_functions as (
  select p.oid::regprocedure::text identity, md5(pg_get_functiondef(p.oid)) definition_hash
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'create_exam_order','fulfil_paid_exam_order',
      'create_exam_bulk_order','fulfil_paid_exam_bulk_order'
    )
)
select jsonb_build_object(
  'settingsHash', (select md5(to_jsonb(s)::text) from public.agilecert_finance_settings s where singleton=true),
  'rolePermissionsHash', (select md5(coalesce(string_agg(role||':'||permission_key||':'||is_granted::text,'|' order by role,permission_key),'')) from public.agilecert_finance_role_permissions),
  'profileRoleHash', (select md5(coalesce(string_agg(id::text||':'||role||':'||is_active::text,'|' order by id),'')) from public.profiles),
  'protectedFunctionHash', (select md5(coalesce(string_agg(identity||':'||definition_hash,'|' order by identity),'')) from protected_functions),
  'examPricesHash', (select md5(coalesce(string_agg(id::text||':'||examination_id::text||':'||currency||':'||amount_minor::text||':'||is_active::text,'|' order by id),'')) from public.exam_prices),
  'couponHash', (select md5(coalesce(string_agg(id::text||':'||upper(code)||':'||is_active::text||':'||discount_type||':'||discount_value::text,'|' order by id),'')) from public.coupons),
  'examOrders', (select count(*) from public.exam_orders),
  'examPayments', (select count(*) from public.exam_payments),
  'bulkOrders', (select count(*) from public.exam_bulk_orders),
  'bulkPayments', (select count(*) from public.exam_bulk_payments),
  'financeAuditEvents', (select count(*) from public.agilecert_finance_audit_events),
  'generalAuditLogs', (select count(*) from public.audit_logs),
  'syntheticPolicies', (select count(*) from public.agilecert_exam_pricing_policies where currency='XUT'),
  'syntheticPrices', (select count(*) from public.exam_prices where currency='XUT'),
  'syntheticCoupons', (select count(*) from public.coupons where upper(code)='UATFCCOMMISSION'),
  'syntheticFinanceAudits', (select count(*) from public.agilecert_finance_audit_events where coalesce(metadata->>'reason','') like 'Production UAT%'),
  'superAdmins', (select count(*) from public.profiles where role='super_admin' and is_active=true),
  'examAdmins', (select count(*) from public.profiles where role='exam_admin' and is_active=true),
  'candidates', (select count(*) from public.profiles where role='candidate' and is_active=true)
) state;
"""

SIGNATURES_SQL = r"""
select jsonb_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text) signatures
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in (
    'update_agilecert_person_admin',
    'get_my_finance_console_access',
    'get_finance_console_completion_snapshot',
    'admin_set_finance_role_permission',
    'finance_upsert_general_settings',
    'finance_upsert_exam_pricing_policy',
    'finance_upsert_coupon_advanced',
    'finance_record_export',
    'finance_get_receipt_payload',
    'finance_queue_recovery_action'
  );
"""

UAT_SQL = r"""
begin;
do $uat$
declare
  v_super_id uuid;
  v_admin_id uuid;
  v_candidate_id uuid;
  v_exam_id uuid;
  v_programme_id uuid;
  v_access jsonb;
  v_snapshot jsonb;
  v_settings public.agilecert_finance_settings%rowtype;
  v_receipt jsonb;
  v_order_id uuid;
  v_order_type text;
begin
  select id into v_super_id from public.profiles
  where role='super_admin' and is_active=true order by created_at limit 1;
  select id into v_candidate_id from public.profiles
  where role='candidate' and is_active=true order by created_at limit 1;
  select id into v_admin_id from public.profiles
  where role='exam_admin' and is_active=true order by created_at limit 1;

  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',v_super_id::text,true);

  if v_admin_id is null then
    select id into v_admin_id from public.profiles
    where role='candidate' and is_active=true and id<>v_candidate_id
    order by created_at limit 1;
    if v_admin_id is not null then
      perform public.update_agilecert_person_admin(
        p_user_id => v_admin_id,
        p_full_name => null,
        p_phone => null,
        p_role => 'exam_admin',
        p_is_active => true,
        p_require_profile_update => null
      );
    end if;
  end if;

  select e.id,e.programme_id into v_exam_id,v_programme_id
  from public.examinations e where e.is_published=true
  order by e.created_at limit 1;

  if v_super_id is null or v_admin_id is null or v_candidate_id is null or v_exam_id is null then
    raise exception 'Required production identities or published examination are unavailable.';
  end if;

  if (select count(*) from public.agilecert_finance_role_permissions
      where role='exam_admin'
        and permission_key in ('finance.dashboard.view','finance.exports.download','finance.receipts.manage')
        and is_granted=true)<>3 then
    raise exception 'Expected Examination Administrator reporting permissions are not active.';
  end if;
  if (select count(*) from public.agilecert_finance_role_permissions
      where role='exam_admin'
        and permission_key in ('finance.settings.manage','finance.transactions.reconcile','finance.access.recover','finance.adjustments.approve')
        and is_granted=true)<>0 then
    raise exception 'A high-impact Examination Administrator permission is unexpectedly active.';
  end if;

  perform set_config('request.jwt.claim.sub',v_candidate_id::text,true);
  begin
    perform public.get_finance_console_completion_snapshot(
      p_limit=>10,p_from=>now()-interval '30 days',p_to=>now()
    );
    raise exception 'Candidate unexpectedly accessed Finance Console.';
  exception when others then
    if position('Candidate unexpectedly' in sqlerrm)>0 then raise; end if;
    if position('does not have permission' in sqlerrm)=0 then
      raise exception 'Unexpected candidate denial: %',sqlerrm;
    end if;
  end;

  perform set_config('request.jwt.claim.sub',v_admin_id::text,true);
  v_access:=public.get_my_finance_console_access();
  if v_access->>'role'<>'exam_admin'
     or coalesce((v_access->>'canViewDashboard')::boolean,false) is not true
     or coalesce((v_access->>'canManageReceipts')::boolean,false) is not true
     or coalesce((v_access->>'canExportTransactions')::boolean,false) is not true
     or coalesce((v_access->>'canManageSettings')::boolean,false) is not false
     or coalesce((v_access->>'canReconcileTransactions')::boolean,false) is not false
     or coalesce((v_access->>'canRecoverAccess')::boolean,false) is not false
     or coalesce((v_access->>'canApproveAdjustments')::boolean,false) is not false then
    raise exception 'Examination Administrator default access is incorrect: %',v_access;
  end if;

  select * into v_settings from public.agilecert_finance_settings where singleton=true;
  begin
    perform public.finance_upsert_general_settings(
      p_default_currency=>v_settings.default_currency,
      p_supported_currencies=>v_settings.supported_currencies,
      p_paystack_enabled=>v_settings.paystack_enabled,
      p_paystack_environment=>v_settings.paystack_environment,
      p_paystack_status_note=>v_settings.paystack_status_note,
      p_tax_enabled=>v_settings.tax_enabled,
      p_tax_label=>v_settings.tax_label,
      p_default_tax_profile_id=>v_settings.default_tax_profile_id,
      p_receipt_prefix=>v_settings.receipt_prefix,
      p_payment_reference_prefix=>v_settings.payment_reference_prefix,
      p_payment_expiry_minutes=>v_settings.payment_expiry_minutes,
      p_abandoned_order_hours=>v_settings.abandoned_order_hours,
      p_refunds_enabled=>v_settings.refunds_enabled,
      p_reversals_enabled=>v_settings.reversals_enabled,
      p_manual_payment_approval_enabled=>v_settings.manual_payment_approval_enabled,
      p_bank_transfer_instructions=>v_settings.bank_transfer_instructions,
      p_minimum_transaction_minor=>v_settings.minimum_transaction_minor,
      p_maximum_transaction_minor=>v_settings.maximum_transaction_minor,
      p_allow_partial_payments=>v_settings.allow_partial_payments,
      p_allow_overpayments=>v_settings.allow_overpayments,
      p_change_reason=>'Production UAT expected settings denial'
    );
    raise exception 'Exam admin unexpectedly changed settings before delegation.';
  exception when others then
    if position('unexpectedly changed settings' in sqlerrm)>0 then raise; end if;
    if position('does not have permission' in sqlerrm)=0 then
      raise exception 'Unexpected settings denial: %',sqlerrm;
    end if;
  end;

  perform set_config('request.jwt.claim.sub',v_super_id::text,true);
  v_access:=public.get_my_finance_console_access();
  if v_access->>'role'<>'super_admin'
     or coalesce((v_access->>'canManageSettings')::boolean,false) is not true
     or coalesce((v_access->>'canReconcileTransactions')::boolean,false) is not true
     or coalesce((v_access->>'canRecoverAccess')::boolean,false) is not true
     or coalesce((v_access->>'canApproveAdjustments')::boolean,false) is not true then
    raise exception 'Super Administrator authority is incomplete: %',v_access;
  end if;

  perform public.admin_set_finance_role_permission(
    p_role=>'exam_admin',p_permission_key=>'finance.settings.manage',p_is_granted=>true,
    p_reason=>'Production UAT temporary settings delegation'
  );
  perform set_config('request.jwt.claim.sub',v_admin_id::text,true);
  v_access:=public.get_my_finance_console_access();
  if coalesce((v_access->>'canManageSettings')::boolean,false) is not true then
    raise exception 'Delegated settings permission is missing.';
  end if;

  perform public.finance_upsert_general_settings(
    p_default_currency=>v_settings.default_currency,
    p_supported_currencies=>v_settings.supported_currencies,
    p_paystack_enabled=>v_settings.paystack_enabled,
    p_paystack_environment=>v_settings.paystack_environment,
    p_paystack_status_note=>coalesce(v_settings.paystack_status_note,'')||' [Production UAT]',
    p_tax_enabled=>v_settings.tax_enabled,p_tax_label=>v_settings.tax_label,
    p_default_tax_profile_id=>v_settings.default_tax_profile_id,
    p_receipt_prefix=>v_settings.receipt_prefix,
    p_payment_reference_prefix=>v_settings.payment_reference_prefix,
    p_payment_expiry_minutes=>v_settings.payment_expiry_minutes,
    p_abandoned_order_hours=>v_settings.abandoned_order_hours,
    p_refunds_enabled=>v_settings.refunds_enabled,
    p_reversals_enabled=>v_settings.reversals_enabled,
    p_manual_payment_approval_enabled=>v_settings.manual_payment_approval_enabled,
    p_bank_transfer_instructions=>v_settings.bank_transfer_instructions,
    p_minimum_transaction_minor=>v_settings.minimum_transaction_minor,
    p_maximum_transaction_minor=>v_settings.maximum_transaction_minor,
    p_allow_partial_payments=>v_settings.allow_partial_payments,
    p_allow_overpayments=>v_settings.allow_overpayments,
    p_change_reason=>'Production UAT delegated settings save'
  );

  perform set_config('request.jwt.claim.sub',v_super_id::text,true);
  perform public.finance_upsert_exam_pricing_policy(
    p_examination_id=>v_exam_id,p_currency=>'XUT',p_standard_amount_minor=>1234500,
    p_promotional_amount_minor=>1111100,p_promotion_name=>'Production UAT Promotion',
    p_promotion_starts_at=>now()-interval '1 minute',p_promotion_ends_at=>now()+interval '1 day',
    p_access_mode=>'paid',p_attempts_included=>2,p_retake_amount_minor=>900000,
    p_bulk_cart_eligible=>true,p_is_active=>true,
    p_change_reason=>'Production UAT advanced pricing lifecycle'
  );
  if not exists(select 1 from public.agilecert_exam_pricing_policies
                where examination_id=v_exam_id and currency='XUT'
                  and standard_amount_minor=1234500 and promotional_amount_minor=1111100
                  and attempts_included=2 and retake_amount_minor=900000
                  and bulk_cart_eligible=true and is_active=true) then
    raise exception 'Advanced pricing was not stored correctly.';
  end if;
  if not exists(select 1 from public.exam_prices
                where examination_id=v_exam_id and currency='XUT'
                  and amount_minor=1111100 and is_active=true) then
    raise exception 'Effective promotional price was not applied.';
  end if;

  perform public.finance_upsert_coupon_advanced(
    p_coupon_id=>null,p_code=>'UATFCCOMMISSION',p_name=>'Production UAT Coupon',
    p_description=>'Rolled-back commissioning coupon',p_discount_type=>'percentage',
    p_discount_value=>15,p_currency=>null,p_programme_ids=>array[v_programme_id],
    p_examination_ids=>array[v_exam_id],p_minimum_amount_minor=>500000,
    p_minimum_module_count=>2,p_allow_multi_module_cart=>false,
    p_maximum_discount_minor=>250000,p_starts_at=>now()-interval '1 minute',
    p_expires_at=>now()+interval '1 day',p_maximum_redemptions=>10,
    p_per_candidate_limit=>1,p_is_active=>true,
    p_change_reason=>'Production UAT advanced coupon lifecycle'
  );
  if not exists(select 1 from public.coupons
                where upper(code)='UATFCCOMMISSION' and minimum_amount_minor=500000
                  and minimum_module_count=2 and allow_multi_module_cart=false
                  and maximum_discount_minor=250000 and maximum_redemptions=10
                  and per_candidate_limit=1 and is_active=true) then
    raise exception 'Advanced coupon was not stored correctly.';
  end if;
  if (select count(*) from public.agilecert_coupon_targets t
      join public.coupons c on c.id=t.coupon_id
      where upper(c.code)='UATFCCOMMISSION' and t.is_active=true)<>2 then
    raise exception 'Coupon targets were not stored correctly.';
  end if;

  v_snapshot:=public.get_finance_console_completion_snapshot(
    p_limit=>50,p_from=>now()-interval '90 days',p_to=>now()
  );
  if jsonb_typeof(v_snapshot)<>'object'
     or jsonb_typeof(v_snapshot->'transactions')<>'array'
     or jsonb_typeof(v_snapshot->'dashboard')<>'object' then
    raise exception 'Snapshot payload is invalid.';
  end if;

  perform set_config('request.jwt.claim.sub',v_admin_id::text,true);
  perform public.finance_record_export(
    p_export_type=>'production_uat_csv',
    p_row_count=>jsonb_array_length(v_snapshot->'transactions'),
    p_filters=>jsonb_build_object('rolledBack',true,'scope','commissioning')
  );

  select 'exam',id into v_order_type,v_order_id from public.exam_orders
  where status in ('paid','waived') order by created_at desc limit 1;
  if v_order_id is null then
    select 'bulk',id into v_order_type,v_order_id from public.exam_bulk_orders
    where status in ('paid','partially_fulfilled','fulfilled') order by created_at desc limit 1;
  end if;
  if v_order_id is not null then
    v_receipt:=public.finance_get_receipt_payload(p_order_type=>v_order_type,p_order_id=>v_order_id);
    if jsonb_typeof(v_receipt)<>'object'
       or nullif(v_receipt->>'receiptNumber','') is null
       or nullif(v_receipt->>'reference','') is null then
      raise exception 'Receipt payload is invalid.';
    end if;
  end if;

  if v_order_id is null then
    select 'exam',id into v_order_type,v_order_id from public.exam_orders order by created_at desc limit 1;
  end if;
  if v_order_id is null then
    select 'bulk',id into v_order_type,v_order_id from public.exam_bulk_orders order by created_at desc limit 1;
  end if;
  perform set_config('request.jwt.claim.sub',v_super_id::text,true);
  if v_order_id is not null then
    perform public.finance_queue_recovery_action(
      p_order_type=>v_order_type,p_order_id=>v_order_id,p_action=>'refund_review',
      p_reason=>'Production UAT recovery queue lifecycle'
    );
  end if;

  perform public.admin_set_finance_role_permission(
    p_role=>'exam_admin',p_permission_key=>'finance.settings.manage',p_is_granted=>false,
    p_reason=>'Production UAT temporary settings delegation revoked'
  );
  perform set_config('request.jwt.claim.sub',v_admin_id::text,true);
  v_access:=public.get_my_finance_console_access();
  if coalesce((v_access->>'canManageSettings')::boolean,false) is not false then
    raise exception 'Temporary permission was not revoked.';
  end if;
  if (select count(*) from public.agilecert_finance_audit_events
      where coalesce(metadata->>'reason','') like 'Production UAT%')<5 then
    raise exception 'Expected finance audit evidence was not generated.';
  end if;
end;
$uat$;

select jsonb_build_object(
  'candidateDenied',true,'examAdminDefaultsPassed',true,'superAdminAuthorityPassed',true,
  'delegationLifecyclePassed',true,'settingsPassed',true,
  'pricingPassed',exists(select 1 from public.agilecert_exam_pricing_policies where currency='XUT'),
  'promotionPassed',exists(select 1 from public.exam_prices where currency='XUT' and amount_minor=1111100),
  'couponPassed',exists(select 1 from public.coupons where upper(code)='UATFCCOMMISSION'),
  'couponTargetsPassed',(select count(*) from public.agilecert_coupon_targets t join public.coupons c on c.id=t.coupon_id where upper(c.code)='UATFCCOMMISSION')=2,
  'snapshotPassed',true,
  'exportPassed',exists(select 1 from public.agilecert_finance_audit_events where action='finance_data_exported'),
  'auditEvents',(select count(*) from public.agilecert_finance_audit_events where coalesce(metadata->>'reason','') like 'Production UAT%'),
  'rollbackRequired',true
) uat;
rollback;
select jsonb_build_object(
  'syntheticPolicies',(select count(*) from public.agilecert_exam_pricing_policies where currency='XUT'),
  'syntheticPrices',(select count(*) from public.exam_prices where currency='XUT'),
  'syntheticCoupons',(select count(*) from public.coupons where upper(code)='UATFCCOMMISSION'),
  'syntheticFinanceAudits',(select count(*) from public.agilecert_finance_audit_events where coalesce(metadata->>'reason','') like 'Production UAT%'),
  'highImpactExamAdminGrants',(select count(*) from public.agilecert_finance_role_permissions where role='exam_admin' and permission_key in ('finance.settings.manage','finance.transactions.reconcile','finance.access.recover','finance.adjustments.approve') and is_granted=true),
  'rolledBack',true
) cleanup;
"""


def fetch_url(url: str, *, method: str = "GET", body: bytes | None = None) -> tuple[int, bytes]:
    request = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "User-Agent": "IIPM-Finance-Console-Commissioning-v4",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def verify_live_frontend() -> dict[str, Any]:
    local_index = (APP_DIR / "dist/index.html").read_bytes()
    live_index = b""
    for attempt in range(1, 7):
        query = urllib.parse.urlencode({
            "commissioning": EXPECTED_SOURCE_COMMIT,
            "attempt": attempt,
            "time": int(time.time()),
        })
        status, candidate = fetch_url(f"{LIVE_BASE_URL}?{query}")
        if status == 200 and candidate == local_index:
            live_index = candidate
            break
        time.sleep(10)
    assert live_index == local_index, "Live index.html does not match the commissioned source build."

    refs = sorted(set(re.findall(rb'(?:src|href)=["\']([^"\']+)["\']', local_index)))
    compared: list[dict[str, Any]] = []
    live_bundle = bytearray()
    for raw_ref in refs:
        ref = raw_ref.decode("utf-8")
        if ref.startswith(("http://", "https://", "data:", "#")):
            continue
        relative = ref.lstrip("./").lstrip("/")
        local_path = APP_DIR / "dist" / relative
        if not local_path.is_file():
            continue
        local_bytes = local_path.read_bytes()
        status, live_bytes = fetch_url(urllib.parse.urljoin(LIVE_BASE_URL, ref))
        assert status == 200, (ref, status)
        assert live_bytes == local_bytes, f"Live asset mismatch: {ref}"
        if relative.endswith((".js", ".mjs")):
            live_bundle.extend(live_bytes)
        compared.append({
            "path": relative,
            "bytes": len(local_bytes),
            "sha256": hashlib.sha256(local_bytes).hexdigest(),
        })

    bundle_text = live_bundle.decode("utf-8", errors="ignore")
    assert "Advanced examination pricing saved and audited" in bundle_text
    assert "finance-gateway-status" in bundle_text
    evidence = {
        "liveBaseUrl": LIVE_BASE_URL,
        "exactIndexMatch": True,
        "indexSha256": hashlib.sha256(local_index).hexdigest(),
        "exactAssetMatches": compared,
        "financeCompletionMarkersPresent": True,
    }
    Path("live-frontend-commissioning.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    return evidence


def verify_edge_denial() -> dict[str, Any]:
    results: dict[str, Any] = {}
    for function_name in ("admin-verify-exam-payment", "finance-gateway-status"):
        status, response = fetch_url(
            f"https://{PROJECT_REF}.supabase.co/functions/v1/{function_name}",
            method="POST",
            body=b"{}",
        )
        assert status != 200, (function_name, status, response)
        text = response.decode("utf-8", errors="replace")
        assert not re.search(r"sk_(?:live|test)_[A-Za-z0-9]+|service_role|SUPABASE_SERVICE_ROLE_KEY", text, re.I)
        Path(f"{function_name}-denial.json").write_bytes(response)
        results[function_name] = {"status": status, "failedClosed": True}
    return results


def main() -> None:
    pre = next(row["state"] for row in database_query(STATE_SQL, "pre-state") if "state" in row)
    assert pre["superAdmins"] >= 1, pre
    assert pre["examAdmins"] >= 1 or pre["candidates"] >= 2, pre
    assert pre["syntheticPolicies"] == 0, pre
    assert pre["syntheticPrices"] == 0, pre
    assert pre["syntheticCoupons"] == 0, pre
    assert pre["syntheticFinanceAudits"] == 0, pre
    Path("commissioning-pre.json").write_text(json.dumps(pre, indent=2), encoding="utf-8")

    signatures = next(row["signatures"] for row in database_query(SIGNATURES_SQL, "signatures") if "signatures" in row)
    Path("commissioning-signatures.json").write_text(json.dumps(signatures, indent=2), encoding="utf-8")

    rows = database_query(UAT_SQL, "uat")
    uat = next(row["uat"] for row in rows if isinstance(row.get("uat"), dict))
    cleanup = next(row["cleanup"] for row in rows if isinstance(row.get("cleanup"), dict))
    for key in (
        "candidateDenied","examAdminDefaultsPassed","superAdminAuthorityPassed",
        "delegationLifecyclePassed","settingsPassed","pricingPassed","promotionPassed",
        "couponPassed","couponTargetsPassed","snapshotPassed","exportPassed","rollbackRequired",
    ):
        assert uat[key] is True, (key, uat)
    assert uat["auditEvents"] >= 5, uat
    assert cleanup["syntheticPolicies"] == 0, cleanup
    assert cleanup["syntheticPrices"] == 0, cleanup
    assert cleanup["syntheticCoupons"] == 0, cleanup
    assert cleanup["syntheticFinanceAudits"] == 0, cleanup
    assert cleanup["highImpactExamAdminGrants"] == 0, cleanup
    assert cleanup["rolledBack"] is True, cleanup

    post = next(row["state"] for row in database_query(STATE_SQL, "post-state") if "state" in row)
    preserved = [
        "settingsHash","rolePermissionsHash","profileRoleHash","protectedFunctionHash",
        "examPricesHash","couponHash","examOrders","examPayments","bulkOrders","bulkPayments",
        "financeAuditEvents","generalAuditLogs","syntheticPolicies","syntheticPrices",
        "syntheticCoupons","syntheticFinanceAudits",
    ]
    for key in preserved:
        assert pre[key] == post[key], (key, pre, post)

    frontend = verify_live_frontend()
    edge_denial = verify_edge_denial()
    evidence = {
        "sourceCommit": EXPECTED_SOURCE_COMMIT,
        "uat": uat,
        "cleanup": cleanup,
        "prePostStateMatched": True,
        "preservedStateKeys": preserved,
        "initialActiveExamAdministrators": pre["examAdmins"],
        "temporaryExamAdministratorUsed": pre["examAdmins"] == 0,
        "authorisedRoleChangeFunctionUsed": "update_agilecert_person_admin",
        "signatures": signatures,
        "liveFrontend": frontend,
        "edgeFunctionDenial": edge_denial,
        "completedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    Path("production-commissioning.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    Path("commissioning-post.json").write_text(json.dumps(post, indent=2), encoding="utf-8")
    print(json.dumps(evidence, indent=2))


if __name__ == "__main__":
    main()
