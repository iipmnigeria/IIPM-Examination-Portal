import { supabase } from '../lib/supabase';

export type FinanceRecord = Record<string, any>;

export interface CandidateFinanceWorkspace {
  generatedAt: string;
  nominations: FinanceRecord[];
  grants: FinanceRecord[];
  refundRequests: FinanceRecord[];
  counts: {
    pendingNominations: number;
    activeGrants: number;
    openRefundRequests: number;
  };
}

export interface AdminFinanceConsole {
  generatedAt: string;
  actorId: string;
  settings: FinanceRecord;
  taxProfiles: FinanceRecord[];
  summary: FinanceRecord;
  customers: FinanceRecord[];
  quotes: FinanceRecord[];
  invoices: FinanceRecord[];
  payments: FinanceRecord[];
  receipts: FinanceRecord[];
  seatPools: FinanceRecord[];
  nominations: FinanceRecord[];
  refunds: FinanceRecord[];
  creditNotes: FinanceRecord[];
  reconciliationBatches: FinanceRecord[];
  auditEvents: FinanceRecord[];
}

async function rpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw new Error(error.message);
  if (data === null || data === undefined) throw new Error(`${name} did not return a result.`);
  return data as T;
}

export const getMyFinanceWorkspace = () => rpc<CandidateFinanceWorkspace>('get_my_agilecert_finance_workspace');

export const respondToSponsorshipNomination = (input: {
  nominationId: string;
  response: 'accepted' | 'declined';
  note?: string;
}) =>
  rpc<FinanceRecord>('respond_my_agilecert_sponsorship_nomination', {
    p_nomination_id: input.nominationId,
    p_response: input.response,
    p_note: input.note?.trim() || null,
  });

export const requestCandidateRefund = (input: {
  sourceType: 'exam_order' | 'certificate_order';
  sourceId: string;
  amountMinor: number;
  reason: string;
}) =>
  rpc<FinanceRecord>('request_my_agilecert_refund', {
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_amount_minor: input.amountMinor,
    p_reason: input.reason.trim(),
  });

export const getAdminFinanceConsole = (limit = 200) =>
  rpc<AdminFinanceConsole>('get_agilecert_finance_admin_console', { p_limit: limit });

export const saveFinanceSettings = (input: {
  defaultCurrency: string;
  quoteValidityDays: number;
  invoicePaymentTermsDays: number;
  maximumInstitutionalDiscountPercent: number;
  refundSuperAdminThresholdMinor: number;
  defaultTaxProfileId?: string | null;
  allowPartialPayments: boolean;
  allowOverpayments: boolean;
}) =>
  rpc<FinanceRecord>('upsert_agilecert_finance_settings', {
    p_default_currency: input.defaultCurrency,
    p_quote_validity_days: input.quoteValidityDays,
    p_invoice_payment_terms_days: input.invoicePaymentTermsDays,
    p_maximum_institutional_discount_percent: input.maximumInstitutionalDiscountPercent,
    p_refund_super_admin_threshold_minor: input.refundSuperAdminThresholdMinor,
    p_default_tax_profile_id: input.defaultTaxProfileId || null,
    p_allow_partial_payments: input.allowPartialPayments,
    p_allow_overpayments: input.allowOverpayments,
  });

export const saveTaxProfile = (input: FinanceRecord) =>
  rpc<FinanceRecord>('upsert_agilecert_tax_profile', {
    p_tax_profile_id: input.id || null,
    p_code: input.code,
    p_name: input.name,
    p_description: input.description || null,
    p_rate_percent: Number(input.ratePercent || 0),
    p_country_code: input.countryCode || null,
    p_registration_number: input.registrationNumber || null,
    p_is_default: Boolean(input.isDefault),
    p_is_active: input.isActive !== false,
  });

export const saveInstitutionalCustomer = (input: FinanceRecord) =>
  rpc<FinanceRecord>('upsert_agilecert_institutional_customer', {
    p_customer_id: input.id || null,
    p_legal_name: input.legalName,
    p_trading_name: input.tradingName || null,
    p_registration_number: input.registrationNumber || null,
    p_tax_identifier: input.taxIdentifier || null,
    p_billing_email: input.billingEmail,
    p_billing_phone: input.billingPhone || null,
    p_billing_address: input.billingAddress || {},
    p_country_code: input.countryCode || null,
    p_default_currency: input.defaultCurrency || 'NGN',
    p_credit_limit_minor: Number(input.creditLimitMinor || 0),
    p_payment_terms_days: Number(input.paymentTermsDays || 14),
    p_institutional_discount_percent: Number(input.institutionalDiscountPercent || 0),
    p_tax_profile_id: input.taxProfileId || null,
    p_status: input.status || 'active',
    p_notes: input.notes || null,
  });

export const saveInstitutionContact = (input: FinanceRecord) =>
  rpc<FinanceRecord>('upsert_agilecert_institution_contact', {
    p_contact_id: input.id || null,
    p_customer_id: input.customerId,
    p_profile_id: input.profileId || null,
    p_full_name: input.fullName,
    p_email: input.email,
    p_phone: input.phone || null,
    p_contact_role: input.contactRole || 'billing',
    p_portal_access: Boolean(input.portalAccess),
    p_is_primary: Boolean(input.isPrimary),
    p_is_active: input.isActive !== false,
  });

export const createInstitutionQuote = (input: FinanceRecord) =>
  rpc<FinanceRecord>('create_agilecert_institution_quote', {
    p_customer_id: input.customerId,
    p_currency: input.currency || 'NGN',
    p_purchase_order_reference: input.purchaseOrderReference || null,
    p_valid_until: input.validUntil || null,
    p_notes: input.notes || null,
    p_terms: input.terms || null,
    p_items: input.items || [],
  });

export const issueInstitutionQuote = (quoteId: string) =>
  rpc<FinanceRecord>('issue_agilecert_institution_quote', { p_quote_id: quoteId });

export const decideInstitutionQuote = (quoteId: string, decision: string, note?: string) =>
  rpc<FinanceRecord>('decide_agilecert_institution_quote', {
    p_quote_id: quoteId,
    p_decision: decision,
    p_note: note?.trim() || null,
  });

export const convertQuoteToInvoice = (input: FinanceRecord) =>
  rpc<FinanceRecord>('convert_agilecert_quote_to_invoice', {
    p_quote_id: input.quoteId,
    p_issue_date: input.issueDate || null,
    p_due_date: input.dueDate || null,
    p_payment_schedule: input.paymentSchedule || null,
  });

export const authorizeSponsoredInvoiceAccess = (invoiceId: string, reason: string) =>
  rpc<FinanceRecord>('authorize_agilecert_invoice_sponsored_access', {
    p_invoice_id: invoiceId,
    p_reason: reason.trim(),
  });

export const createSponsorshipPool = (input: FinanceRecord) =>
  rpc<FinanceRecord>('create_agilecert_sponsorship_seat_pool', {
    p_invoice_item_id: input.invoiceItemId,
    p_valid_from: input.validFrom || new Date().toISOString(),
    p_valid_until: input.validUntil || null,
    p_max_attempts_override: input.maxAttemptsOverride || null,
    p_notes: input.notes || null,
  });

export const nominateSponsoredCandidate = (input: FinanceRecord) =>
  rpc<FinanceRecord>('nominate_agilecert_sponsored_candidate', {
    p_seat_pool_id: input.seatPoolId,
    p_candidate_email: String(input.candidateEmail || '').trim().toLowerCase(),
    p_eligibility_id: input.eligibilityId || null,
    p_expires_at: input.expiresAt || null,
  });

export const recordInstitutionPayment = (input: FinanceRecord) =>
  rpc<FinanceRecord>('record_agilecert_institution_payment', {
    p_customer_id: input.customerId,
    p_provider: input.provider || 'bank_transfer',
    p_external_reference: input.externalReference || null,
    p_provider_transaction_id: input.providerTransactionId || null,
    p_currency: input.currency || 'NGN',
    p_amount_minor: Number(input.amountMinor || 0),
    p_payment_date: input.paymentDate || null,
    p_payer_name: input.payerName || null,
    p_payer_email: input.payerEmail || null,
    p_evidence_object_path: input.evidenceObjectPath || null,
    p_metadata: input.metadata || {},
  });

export const reviewInstitutionPayment = (input: FinanceRecord) =>
  rpc<FinanceRecord>('review_agilecert_institution_payment', {
    p_payment_id: input.paymentId,
    p_decision: input.decision,
    p_review_note: input.reviewNote || null,
    p_allocations: input.allocations || null,
  });

export const createCreditNote = (input: FinanceRecord) =>
  rpc<FinanceRecord>('create_agilecert_credit_note', {
    p_invoice_id: input.invoiceId,
    p_amount_minor: Number(input.amountMinor || 0),
    p_reason: input.reason,
    p_issue_now: input.issueNow !== false,
  });

export const decideCreditNote = (creditNoteId: string, decision: string, reason?: string) =>
  rpc<FinanceRecord>('decide_agilecert_credit_note', {
    p_credit_note_id: creditNoteId,
    p_decision: decision,
    p_reason: reason?.trim() || null,
  });

export const requestInstitutionRefund = (input: FinanceRecord) =>
  rpc<FinanceRecord>('request_agilecert_institution_refund', {
    p_payment_id: input.paymentId,
    p_amount_minor: Number(input.amountMinor || 0),
    p_reason: input.reason,
    p_credit_note_id: input.creditNoteId || null,
  });

export const decideRefundRequest = (input: FinanceRecord) =>
  rpc<FinanceRecord>('decide_agilecert_refund_request', {
    p_refund_id: input.refundId,
    p_decision: input.decision,
    p_approved_amount_minor: input.approvedAmountMinor || null,
    p_decision_reason: input.decisionReason || null,
  });

export const markRefundProcessed = (input: FinanceRecord) =>
  rpc<FinanceRecord>('mark_agilecert_refund_processed', {
    p_refund_id: input.refundId,
    p_status: input.status,
    p_external_refund_reference: input.externalRefundReference || null,
    p_note: input.note || null,
  });

export const createReconciliationBatch = (input: FinanceRecord) =>
  rpc<FinanceRecord>('create_agilecert_reconciliation_batch', {
    p_provider: input.provider,
    p_currency: input.currency || null,
    p_statement_from: input.statementFrom || null,
    p_statement_to: input.statementTo || null,
    p_source_file_name: input.sourceFileName || null,
    p_lines: input.lines || [],
    p_metadata: input.metadata || {},
  });

export const resolveReconciliationLine = (input: FinanceRecord) =>
  rpc<FinanceRecord>('resolve_agilecert_reconciliation_line', {
    p_line_id: input.lineId,
    p_status: input.status,
    p_matched_entity_type: input.matchedEntityType || null,
    p_matched_entity_id: input.matchedEntityId || null,
    p_resolution_note: input.resolutionNote || null,
  });

export const getFinanceDocument = (documentType: string, documentId: string) =>
  rpc<FinanceRecord>('get_agilecert_finance_document', {
    p_document_type: documentType,
    p_document_id: documentId,
  });
