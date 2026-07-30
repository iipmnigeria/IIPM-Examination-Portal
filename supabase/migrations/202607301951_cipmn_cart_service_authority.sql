begin;

-- Candidate access remains through candidate-owned RPCs. The service role needs
-- this read-only payload helper to return an already-fulfilled bulk payment.
revoke all on function public.agilecert_exam_bulk_order_payload(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.agilecert_exam_bulk_order_payload(uuid, uuid)
  to service_role;

commit;
