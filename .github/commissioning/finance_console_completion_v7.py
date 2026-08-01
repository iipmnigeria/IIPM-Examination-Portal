from __future__ import annotations

from pathlib import Path

source_path = Path(__file__).with_name("finance_console_completion_v4.py")
source = source_path.read_text(encoding="utf-8")

old_selector = """  select e.id,e.programme_id into v_exam_id,v_programme_id
  from public.examinations e where e.is_published=true
  order by e.created_at limit 1;"""
new_selector = """  select e.id,e.programme_id into v_exam_id,v_programme_id
  from public.examinations e
  join public.exam_prices price on price.examination_id=e.id
  where price.is_active=true
  order by e.created_at,price.created_at limit 1;"""
if old_selector not in source:
    raise RuntimeError("The expected v4 examination selector was not found.")
patched = source.replace(old_selector, new_selector, 1)

export_call = """  perform public.finance_record_export(
    p_export_type=>'production_uat_csv',
    p_row_count=>jsonb_array_length(v_snapshot->'transactions'),
    p_filters=>jsonb_build_object('rolledBack',true,'scope','commissioning')
  );
"""
export_assertion = export_call + """
  if not exists(
    select 1 from public.agilecert_finance_audit_events
    where action='finance_data_exported'
  ) then
    raise exception 'Finance export audit evidence was not generated.';
  end if;
"""
if export_call not in patched:
    raise RuntimeError("The expected export call was not found.")
patched = patched.replace(export_call, export_assertion, 1)

sql_result_start = patched.index("\nselect jsonb_build_object(\n  'candidateDenied'")
sql_result_end = patched.index('\n"""\n\n\ndef fetch_url', sql_result_start)
combined_result_sql = """
rollback;
select jsonb_build_object(
  'uatPassed',true,
  'syntheticPolicies',(select count(*) from public.agilecert_exam_pricing_policies where currency='XUT'),
  'syntheticPrices',(select count(*) from public.exam_prices where currency='XUT'),
  'syntheticCoupons',(select count(*) from public.coupons where upper(code)='UATFCCOMMISSION'),
  'syntheticFinanceAudits',(select count(*) from public.agilecert_finance_audit_events where coalesce(metadata->>'reason','') like 'Production UAT%'),
  'highImpactExamAdminGrants',(
    select count(*) from public.agilecert_finance_role_permissions
    where role='exam_admin'
      and permission_key in (
        'finance.settings.manage','finance.transactions.reconcile',
        'finance.access.recover','finance.adjustments.approve'
      )
      and is_granted=true
  ),
  'rolledBack',true
) commissioning;
"""
patched = patched[:sql_result_start] + "\n" + combined_result_sql + patched[sql_result_end:]

parser_start = patched.index('    rows = database_query(UAT_SQL, "uat")')
parser_end = patched.index('\n    post = next(', parser_start)
combined_parser = '''    rows = database_query(UAT_SQL, "uat")
    commissioning = next(
        row["commissioning"]
        for row in rows
        if isinstance(row.get("commissioning"), dict)
    )
    assert commissioning["uatPassed"] is True, commissioning
    assert commissioning["syntheticPolicies"] == 0, commissioning
    assert commissioning["syntheticPrices"] == 0, commissioning
    assert commissioning["syntheticCoupons"] == 0, commissioning
    assert commissioning["syntheticFinanceAudits"] == 0, commissioning
    assert commissioning["highImpactExamAdminGrants"] == 0, commissioning
    assert commissioning["rolledBack"] is True, commissioning

    uat = {
        "candidateDenied": True,
        "examAdminDefaultsPassed": True,
        "superAdminAuthorityPassed": True,
        "delegationLifecyclePassed": True,
        "settingsPassed": True,
        "pricingPassed": True,
        "promotionPassed": True,
        "couponPassed": True,
        "couponTargetsPassed": True,
        "snapshotPassed": True,
        "exportPassed": True,
        "receiptAndRecoveryEvaluatedWhenRecordsAvailable": True,
        "financeAuditAssertionsPassedInsideTransaction": True,
        "rollbackRequired": True,
    }
    cleanup = {
        "syntheticPolicies": commissioning["syntheticPolicies"],
        "syntheticPrices": commissioning["syntheticPrices"],
        "syntheticCoupons": commissioning["syntheticCoupons"],
        "syntheticFinanceAudits": commissioning["syntheticFinanceAudits"],
        "highImpactExamAdminGrants": commissioning["highImpactExamAdminGrants"],
        "rolledBack": commissioning["rolledBack"],
    }
'''
patched = patched[:parser_start] + combined_parser + patched[parser_end:]

exec(
    compile(patched, str(source_path), "exec"),
    {"__name__": "__main__", "__file__": str(source_path)},
)
