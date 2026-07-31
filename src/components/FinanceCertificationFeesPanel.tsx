import { type FormEvent, useMemo, useState } from 'react';
import {
  Award,
  BadgeCheck,
  CalendarClock,
  FileBadge2,
  Globe2,
  Loader2,
  Pencil,
  Save,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import {
  saveFinanceCertificationPrice,
  saveFinanceCertificationScope,
  setFinanceCertificationPriceActive,
  setFinanceCertificationProductActive,
  setFinanceCertificationScopeActive,
  type FinanceCertificateCurrency,
  type FinanceCertificateProductCode,
  type FinanceCertificationPrice,
  type FinanceCertificationPricingMode,
  type FinanceCertificationProduct,
  type FinanceCertificationScope,
  type FinanceCertificationScopeType,
  type FinanceConsoleSnapshot,
} from '../services/financeConsoleService';

type Props = {
  snapshot: FinanceConsoleSnapshot;
  onRefresh: () => Promise<void>;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
};

const currencyDigits = (currency: string): number => {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency })
      .resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
};

const formatMoney = (amountMinor: number, currency: string): string => {
  const divisor = 10 ** currencyDigits(currency);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: currencyDigits(currency),
    }).format(Number(amountMinor || 0) / divisor);
  } catch {
    return `${currency} ${(Number(amountMinor || 0) / divisor).toLocaleString()}`;
  }
};

const majorToMinor = (value: string, currency: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10 ** currencyDigits(currency)) : 0;
};

const minorToMajor = (value: number, currency: string): string =>
  String(Number(value || 0) / 10 ** currencyDigits(currency));

const toDateTimeLocal = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const blankPriceForm = {
  productCode: 'achievement' as FinanceCertificateProductCode,
  currency: 'NGN' as FinanceCertificateCurrency,
  pricingMode: 'separate_payment' as FinanceCertificationPricingMode,
  earlyAmountMajor: '20000',
  standardAmountMajor: '25000',
  countryCodes: 'NG',
  effectiveFrom: '',
  effectiveTo: '',
  isActive: true,
  changeReason: 'Approved certification pricing configuration',
};

const blankScopeForm = {
  scopeId: '',
  productCode: 'achievement' as FinanceCertificateProductCode,
  scopeType: 'all' as FinanceCertificationScopeType,
  targetId: '',
  isActive: true,
  changeReason: 'Approved certification applicability configuration',
};

const featureSummary = (product: FinanceCertificationProduct): string[] => {
  const features = ['Digital certificate', 'Public verification'];
  if (product.includesBadge) features.push('Digital badge');
  if (product.includesTranscript) features.push('Transcript');
  if (product.requiresIdentityVerification) features.push('Identity assurance required');
  return features;
};

const pricingModeLabel = (mode: FinanceCertificationPricingMode): string => {
  if (mode === 'included') return 'Included with examination';
  if (mode === 'free') return 'Free certification';
  return 'Separate payment';
};

const statusTone = (status: string): string => {
  if (['paid', 'success', 'waived'].includes(status)) return 'bg-emerald-100 text-emerald-800';
  if (['failed', 'cancelled', 'expired', 'refunded'].includes(status)) return 'bg-rose-100 text-rose-800';
  return 'bg-amber-100 text-amber-800';
};

export default function FinanceCertificationFeesPanel({
  snapshot,
  onRefresh,
  onMessage,
  onError,
}: Props) {
  const [priceForm, setPriceForm] = useState(blankPriceForm);
  const [scopeForm, setScopeForm] = useState(blankScopeForm);
  const [busy, setBusy] = useState('');

  const pricesByProduct = useMemo(() => {
    const groups = new Map<FinanceCertificateProductCode, FinanceCertificationPrice[]>();
    snapshot.certificationProducts.forEach((product) => groups.set(product.code, []));
    snapshot.certificationPrices.forEach((price) => {
      groups.set(price.productCode, [...(groups.get(price.productCode) || []), price]);
    });
    return groups;
  }, [snapshot.certificationProducts, snapshot.certificationPrices]);

  const scopesByProduct = useMemo(() => {
    const groups = new Map<FinanceCertificateProductCode, FinanceCertificationScope[]>();
    snapshot.certificationProducts.forEach((product) => groups.set(product.code, []));
    snapshot.certificationScopes.forEach((scope) => {
      groups.set(scope.productCode, [...(groups.get(scope.productCode) || []), scope]);
    });
    return groups;
  }, [snapshot.certificationProducts, snapshot.certificationScopes]);

  const editPrice = (price: FinanceCertificationPrice) => {
    setPriceForm({
      productCode: price.productCode,
      currency: price.currency,
      pricingMode: price.pricingMode,
      earlyAmountMajor: minorToMajor(price.earlyAmountMinor, price.currency),
      standardAmountMajor: minorToMajor(price.standardAmountMinor, price.currency),
      countryCodes: (price.countryCodes || []).join(', '),
      effectiveFrom: toDateTimeLocal(price.effectiveFrom),
      effectiveTo: toDateTimeLocal(price.effectiveTo),
      isActive: price.active,
      changeReason: `Approved update to ${price.productTitle} ${price.currency} pricing`,
    });
    onMessage(`${price.productTitle} ${price.currency} pricing loaded for editing.`);
  };

  const savePrice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onError('');
    onMessage('');

    const earlyAmountMinor = majorToMinor(priceForm.earlyAmountMajor, priceForm.currency);
    const standardAmountMinor = majorToMinor(priceForm.standardAmountMajor, priceForm.currency);
    const requiresPayment = priceForm.pricingMode === 'separate_payment';
    if ((requiresPayment && earlyAmountMinor <= 0) || standardAmountMinor < earlyAmountMinor) {
      onError('Separate-payment certification requires a positive early fee. The standard fee cannot be lower.');
      return;
    }
    if (priceForm.changeReason.trim().length < 5) {
      onError('Enter a reason of at least five characters for the certification pricing change.');
      return;
    }

    try {
      setBusy('save-price');
      await saveFinanceCertificationPrice({
        productCode: priceForm.productCode,
        currency: priceForm.currency,
        pricingMode: priceForm.pricingMode,
        earlyAmountMinor,
        standardAmountMinor,
        countryCodes: priceForm.countryCodes
          .split(',')
          .map((code) => code.trim().toUpperCase())
          .filter(Boolean),
        effectiveFrom: priceForm.effectiveFrom
          ? new Date(priceForm.effectiveFrom).toISOString()
          : new Date().toISOString(),
        effectiveTo: priceForm.effectiveTo
          ? new Date(priceForm.effectiveTo).toISOString()
          : null,
        isActive: priceForm.isActive,
        changeReason: priceForm.changeReason,
      });
      onMessage('Certification pricing saved and recorded in the immutable finance audit trail.');
      await onRefresh();
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : 'The certification pricing rule could not be saved.');
    } finally {
      setBusy('');
    }
  };

  const saveScope = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onError('');
    onMessage('');
    if (scopeForm.scopeType !== 'all' && !scopeForm.targetId) {
      onError('Select the programme or examination for this applicability rule.');
      return;
    }
    if (scopeForm.changeReason.trim().length < 5) {
      onError('Enter a reason of at least five characters for the applicability change.');
      return;
    }

    try {
      setBusy('save-scope');
      await saveFinanceCertificationScope({
        scopeId: scopeForm.scopeId || null,
        productCode: scopeForm.productCode,
        scopeType: scopeForm.scopeType,
        programmeId: scopeForm.scopeType === 'programme' ? scopeForm.targetId : null,
        examinationId: scopeForm.scopeType === 'examination' ? scopeForm.targetId : null,
        isActive: scopeForm.isActive,
        changeReason: scopeForm.changeReason,
      });
      setScopeForm(blankScopeForm);
      onMessage('Certification applicability rule saved.');
      await onRefresh();
    } catch (scopeError) {
      onError(scopeError instanceof Error ? scopeError.message : 'The certification applicability rule could not be saved.');
    } finally {
      setBusy('');
    }
  };

  const editScope = (scope: FinanceCertificationScope) => {
    setScopeForm({
      scopeId: scope.id,
      productCode: scope.productCode,
      scopeType: scope.scopeType,
      targetId: scope.scopeType === 'programme'
        ? scope.programmeId || ''
        : scope.scopeType === 'examination'
          ? scope.examinationId || ''
          : '',
      isActive: scope.isActive,
      changeReason: `Approved update to ${scope.productCode} certification applicability`,
    });
    onMessage('Certification applicability rule loaded for editing.');
  };

  const togglePrice = async (price: FinanceCertificationPrice) => {
    const reason = window.prompt(
      `Reason for ${price.active ? 'deactivating' : 'activating'} the ${price.productTitle} ${price.currency} pricing rule:`,
      price.active ? 'Approved temporary certification pricing deactivation' : 'Approved certification pricing activation',
    )?.trim();
    if (!reason) return;

    try {
      setBusy(`price:${price.productCode}:${price.currency}`);
      onError('');
      await setFinanceCertificationPriceActive({
        productCode: price.productCode,
        currency: price.currency,
        isActive: !price.active,
        changeReason: reason,
      });
      onMessage(`${price.productTitle} ${price.currency} pricing ${price.active ? 'deactivated' : 'activated'}.`);
      await onRefresh();
    } catch (toggleError) {
      onError(toggleError instanceof Error ? toggleError.message : 'Unable to change certification pricing status.');
    } finally {
      setBusy('');
    }
  };

  const toggleScope = async (scope: FinanceCertificationScope) => {
    const reason = window.prompt(
      `Reason for ${scope.isActive ? 'deactivating' : 'activating'} this certification applicability rule:`,
      scope.isActive ? 'Approved temporary applicability deactivation' : 'Approved applicability activation',
    )?.trim();
    if (!reason) return;

    try {
      setBusy(`scope:${scope.id}`);
      onError('');
      await setFinanceCertificationScopeActive({
        scopeId: scope.id,
        isActive: !scope.isActive,
        changeReason: reason,
      });
      onMessage(`Certification applicability rule ${scope.isActive ? 'deactivated' : 'activated'}.`);
      await onRefresh();
    } catch (toggleError) {
      onError(toggleError instanceof Error ? toggleError.message : 'Unable to change certification applicability status.');
    } finally {
      setBusy('');
    }
  };

  const toggleProduct = async (product: FinanceCertificationProduct) => {
    const reason = window.prompt(
      `Reason for ${product.active ? 'deactivating' : 'activating'} ${product.title}:`,
      product.active ? 'Approved temporary certification product suspension' : 'Approved certification product activation',
    )?.trim();
    if (!reason) return;

    if (product.active && !window.confirm(
      `Deactivate ${product.title}? New offers will stop, while existing paid and issued credentials remain unchanged.`,
    )) return;

    try {
      setBusy(`product:${product.code}`);
      onError('');
      await setFinanceCertificationProductActive({
        productCode: product.code,
        isActive: !product.active,
        changeReason: reason,
      });
      onMessage(`${product.title} ${product.active ? 'deactivated' : 'activated'}. Existing credentials were not changed.`);
      await onRefresh();
    } catch (toggleError) {
      onError(toggleError instanceof Error ? toggleError.message : 'Unable to change certification product status.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Active products', snapshot.certificationSummary.activeProducts, Award],
          ['Active price points', snapshot.certificationSummary.activePrices, FileBadge2],
          ['Active applicability rules', snapshot.certificationSummary.activeScopes, Globe2],
          ['Issued credentials', snapshot.certificationSummary.credentials, ShieldCheck],
        ].map(([label, value, Icon]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Icon className="h-5 w-5 text-violet-600" />
            <p className="mt-3 text-3xl font-black text-slate-950">{Number(value)}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{String(label)}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <FileBadge2 className="h-5 w-5 text-violet-600" />
            <h2 className="font-black text-slate-950">Certification pricing rule</h2>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Configure separate payment, inclusion with examination access, or free certification by market and effective period.
          </p>

          {!snapshot.access.canManageCertificatePrices ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Your account has view-only access to certification products and pricing.
            </div>
          ) : (
            <form onSubmit={savePrice} className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-600">Certification product
                <select value={priceForm.productCode} onChange={(event) => setPriceForm({ ...priceForm, productCode: event.target.value as FinanceCertificateProductCode })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                  {snapshot.certificationProducts.map((product) => <option key={product.code} value={product.code}>{product.title}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600">Currency market
                <select value={priceForm.currency} onChange={(event) => setPriceForm({ ...priceForm, currency: event.target.value as FinanceCertificateCurrency })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                  <option value="NGN">NGN — Nigeria market</option>
                  <option value="USD">USD — International market</option>
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600 sm:col-span-2">Payment treatment
                <select value={priceForm.pricingMode} onChange={(event) => setPriceForm({ ...priceForm, pricingMode: event.target.value as FinanceCertificationPricingMode })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                  <option value="separate_payment">Separate certificate payment</option>
                  <option value="included">Included with examination arrangement</option>
                  <option value="free">Free certification</option>
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600">Early fee
                <input type="number" min="0" step="0.01" value={priceForm.earlyAmountMajor} onChange={(event) => setPriceForm({ ...priceForm, earlyAmountMajor: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-600">Standard fee
                <input type="number" min="0" step="0.01" value={priceForm.standardAmountMajor} onChange={(event) => setPriceForm({ ...priceForm, standardAmountMajor: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-600 sm:col-span-2">Country routing codes
                <input value={priceForm.countryCodes} onChange={(event) => setPriceForm({ ...priceForm, countryCodes: event.target.value })} placeholder="NG or leave blank as market fallback" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-600">Effective from
                <input type="datetime-local" value={priceForm.effectiveFrom} onChange={(event) => setPriceForm({ ...priceForm, effectiveFrom: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-600">Effective to
                <input type="datetime-local" value={priceForm.effectiveTo} onChange={(event) => setPriceForm({ ...priceForm, effectiveTo: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-600 sm:col-span-2">Change reason
                <textarea value={priceForm.changeReason} onChange={(event) => setPriceForm({ ...priceForm, changeReason: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={priceForm.isActive} onChange={(event) => setPriceForm({ ...priceForm, isActive: event.target.checked })} /> Active pricing rule</label>
              <button type="submit" disabled={busy === 'save-price'} className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-700 disabled:opacity-50">
                {busy === 'save-price' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save pricing rule
              </button>
            </form>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Globe2 className="h-5 w-5 text-blue-600" /><h2 className="font-black text-slate-950">Programme and examination applicability</h2></div>
          <p className="mt-2 text-xs leading-5 text-slate-500">An active “All programmes” rule makes the product globally available. Deactivate it before restricting availability to selected programmes or examinations.</p>
          {!snapshot.access.canManageCertificatePrices ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Your account has view-only access to applicability rules.</div>
          ) : (
            <form onSubmit={saveScope} className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-600">Certification product
                <select value={scopeForm.productCode} onChange={(event) => setScopeForm({ ...scopeForm, productCode: event.target.value as FinanceCertificateProductCode })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                  {snapshot.certificationProducts.map((product) => <option key={product.code} value={product.code}>{product.title}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600">Applicability level
                <select value={scopeForm.scopeType} onChange={(event) => setScopeForm({ ...scopeForm, scopeType: event.target.value as FinanceCertificationScopeType, targetId: '' })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                  <option value="all">All programmes</option>
                  <option value="programme">Selected programme</option>
                  <option value="examination">Selected examination</option>
                </select>
              </label>
              {scopeForm.scopeType === 'programme' && <label className="text-xs font-bold text-slate-600 sm:col-span-2">Programme
                <select value={scopeForm.targetId} onChange={(event) => setScopeForm({ ...scopeForm, targetId: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Select programme</option>{snapshot.programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.code} — {programme.name}</option>)}</select>
              </label>}
              {scopeForm.scopeType === 'examination' && <label className="text-xs font-bold text-slate-600 sm:col-span-2">Examination
                <select value={scopeForm.targetId} onChange={(event) => setScopeForm({ ...scopeForm, targetId: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Select examination</option>{snapshot.examinations.map((exam) => <option key={exam.id} value={exam.id}>{exam.course} — {exam.title}</option>)}</select>
              </label>}
              <label className="text-xs font-bold text-slate-600 sm:col-span-2">Change reason
                <textarea value={scopeForm.changeReason} onChange={(event) => setScopeForm({ ...scopeForm, changeReason: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={scopeForm.isActive} onChange={(event) => setScopeForm({ ...scopeForm, isActive: event.target.checked })} /> Active applicability</label>
              <button type="submit" disabled={busy === 'save-scope'} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50">{busy === 'save-scope' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save applicability</button>
            </form>
          )}
        </section>
      </div>

      <section className="space-y-4">
        {snapshot.certificationProducts.map((product) => {
          const prices = pricesByProduct.get(product.code) || [];
          const scopes = scopesByProduct.get(product.code) || [];
          return (
            <article key={product.code} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl"><p className="text-[10px] font-black uppercase tracking-widest text-violet-500">{product.code}</p><h3 className="mt-1 text-lg font-black text-slate-950">{product.title}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{product.description}</p><div className="mt-3 flex flex-wrap gap-2">{featureSummary(product).map((feature) => <span key={feature} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{feature}</span>)}</div></div>
                <div className="flex flex-col items-end gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${product.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{product.active ? 'Available' : 'Inactive'}</span>{snapshot.access.canManageCertificatePrices && <button type="button" onClick={() => void toggleProduct(product)} disabled={busy === `product:${product.code}`} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-50">{busy === `product:${product.code}` ? <Loader2 className="h-4 w-4 animate-spin" /> : product.active ? <ToggleRight className="h-4 w-4 text-emerald-600" /> : <ToggleLeft className="h-4 w-4" />}{product.active ? 'Deactivate product' : 'Activate product'}</button>}</div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {prices.map((price) => {
                  const key = `${price.productCode}:${price.currency}`;
                  return <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">{price.currency}</p><p className="mt-1 text-lg font-black text-slate-950">{pricingModeLabel(price.pricingMode)}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${price.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{price.active ? 'Active' : 'Inactive'}</span></div>
                    <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg bg-white p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Early fee</p><p className="mt-1 font-black text-slate-800">{formatMoney(price.earlyAmountMinor, price.currency)}</p></div><div className="rounded-lg bg-white p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Standard fee</p><p className="mt-1 font-black text-slate-800">{formatMoney(price.standardAmountMinor, price.currency)}</p></div></div>
                    <div className="mt-3 text-[11px] text-slate-500"><p>Countries: {(price.countryCodes || []).join(', ') || 'Market fallback'}</p><p>Effective: {new Date(price.effectiveFrom).toLocaleString()}</p><p>Ends: {price.effectiveTo ? new Date(price.effectiveTo).toLocaleString() : 'No expiry'}</p></div>
                    {snapshot.access.canManageCertificatePrices && <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => editPrice(price)} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"><Pencil className="h-3.5 w-3.5" /> Edit</button><button type="button" onClick={() => void togglePrice(price)} disabled={busy === `price:${key}`} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-50">{busy === `price:${key}` ? <Loader2 className="h-4 w-4 animate-spin" /> : price.active ? <ToggleRight className="h-4 w-4 text-emerald-600" /> : <ToggleLeft className="h-4 w-4" />}{price.active ? 'Deactivate' : 'Activate'}</button></div>}
                  </div>;
                })}
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Applicability</p><div className="mt-3 flex flex-wrap gap-2">{scopes.map((scope) => <div key={scope.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${scope.isActive ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}><span className="font-bold">{scope.scopeType === 'all' ? 'All programmes' : scope.scopeType === 'programme' ? `${scope.programmeCode} — ${scope.programmeName}` : scope.examinationTitle}</span>{snapshot.access.canManageCertificatePrices && <><button type="button" onClick={() => editScope(scope)} className="font-black underline">Edit</button><button type="button" onClick={() => void toggleScope(scope)} disabled={busy === `scope:${scope.id}`} className="font-black underline">{scope.isActive ? 'Disable' : 'Enable'}</button></>}</div>)}</div></div>
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-amber-600" /><h2 className="font-black text-slate-950">Certificate orders</h2></div>
        <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-950 text-white"><tr><th className="px-3 py-3">Reference</th><th className="px-3 py-3">Candidate</th><th className="px-3 py-3">Product</th><th className="px-3 py-3">Examination</th><th className="px-3 py-3">Treatment</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{snapshot.certificationOrders.slice(0, 100).map((order) => <tr key={order.orderId} className="border-t border-slate-100"><td className="px-3 py-3 font-black">{order.reference}</td><td className="px-3 py-3"><p className="font-bold">{order.candidateName}</p><p className="text-slate-500">{order.candidateEmail}</p></td><td className="px-3 py-3 font-bold">{order.productTitle}</td><td className="px-3 py-3"><p className="font-bold">{order.programmeCode}</p><p className="max-w-xs truncate text-slate-500">{order.examinationTitle}</p></td><td className="px-3 py-3 capitalize">{(order.pricingMode || order.pricingWindow).replaceAll('_', ' ')}</td><td className="px-3 py-3 font-black">{formatMoney(order.payableAmountMinor, order.currency)}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${statusTone(order.status)}`}>{order.status}</span></td></tr>)}</tbody></table>{!snapshot.certificationOrders.length && <p className="p-6 text-center text-sm text-slate-500">No certificate orders have been recorded.</p>}</div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-emerald-600" /><h2 className="font-black text-slate-950">Certificate payments</h2></div>
        <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-950 text-white"><tr><th className="px-3 py-3">Reference</th><th className="px-3 py-3">Candidate</th><th className="px-3 py-3">Product</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Provider</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Verified</th></tr></thead><tbody>{snapshot.certificationPayments.slice(0, 100).map((payment) => <tr key={payment.id} className="border-t border-slate-100"><td className="px-3 py-3 font-black">{payment.reference}</td><td className="px-3 py-3"><p className="font-bold">{payment.candidateName}</p><p className="text-slate-500">{payment.candidateEmail}</p></td><td className="px-3 py-3 font-bold">{payment.productTitle}</td><td className="px-3 py-3 font-black">{formatMoney(payment.amountMinor, payment.currency)}</td><td className="px-3 py-3 capitalize">{payment.provider}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${statusTone(payment.status)}`}>{payment.status}</span></td><td className="px-3 py-3 text-slate-500">{payment.verifiedAt ? new Date(payment.verifiedAt).toLocaleString() : '—'}</td></tr>)}</tbody></table>{!snapshot.certificationPayments.length && <p className="p-6 text-center text-sm text-slate-500">No certificate payments have been recorded.</p>}</div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-violet-600" /><h2 className="font-black text-slate-950">Recent certification finance audit</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">{snapshot.certificationAudit.length ? snapshot.certificationAudit.slice(0, 20).map((event) => <div key={event.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-slate-800">{event.action.replaceAll('_', ' ')}</p><p className="text-[11px] text-slate-500">{new Date(event.createdAt).toLocaleString()}</p></div><p className="mt-1 text-xs text-slate-500">{event.actorName || 'System'} · {event.entityId || event.entityType}</p>{typeof event.metadata?.reason === 'string' && <p className="mt-2 text-xs text-slate-700">{event.metadata.reason}</p>}</div>) : <p className="text-sm text-slate-500">No certification product, pricing or applicability changes have been recorded yet.</p>}</div>
      </section>
    </div>
  );
}
