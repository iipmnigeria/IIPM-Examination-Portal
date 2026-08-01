from __future__ import annotations

from pathlib import Path

source_path = Path(__file__).with_name("finance_console_completion_v4.py")
source = source_path.read_text(encoding="utf-8")
old = """  select e.id,e.programme_id into v_exam_id,v_programme_id
  from public.examinations e where e.is_published=true
  order by e.created_at limit 1;"""
new = """  select e.id,e.programme_id into v_exam_id,v_programme_id
  from public.examinations e
  join public.exam_prices price on price.examination_id=e.id
  where price.is_active=true
  order by e.created_at,price.created_at limit 1;"""
if old not in source:
    raise RuntimeError("The expected v4 examination selector was not found.")
patched = source.replace(old, new, 1)
exec(compile(patched, str(source_path), "exec"), {"__name__": "__main__", "__file__": str(source_path)})
