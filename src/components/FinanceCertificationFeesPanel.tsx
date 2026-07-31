import { type FormEvent, useMemo, useState } from 'react';
import {
  Award,
  BadgeCheck,
  FileBadge2,
  Loader2,
  Pencil,
  Save,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import {
  saveFinanceCertificationPrice,
  setFinanceCertificationPriceActive,
  setFinanceCertificationProductActive,
  type FinanceCertificateCurrency,
  type FinanceCertificateProductCode,
  type FinanceCertificationPrice,
  type FinanceCertificationProduct,
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

const blankForm = {
  productCode: 'achievement' as FinanceCertificateProductCode,
  currency: 'NGN' as FinanceCertificateCurrency,
  earlyAmountMajor: '20000',
  standardAmountMajor: '25000',
  isActive: true,
  changeReason: 'Approved certification fee configuration',
};

const featureSummary = (product: FinanceCertificationProduct): string[] => {
  const features = ['Digital certificate', 'Public verification'];
  if (product.includesBadge) features.push('Digital badge');
  if (product.includesTranscript) features.push('Transcript');
  if (product.requiresIdentityVerification) features.push('Identity assurance required');
  return features;
};

export default function FinanceCertificationFeesPanel({
  snapshot,
  onRefresh,
  onMessage,
  onError,
}: Props) {
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState('');

  const pricesByProduct = useMemo(() => {
    const groups = new Map<FinanceCertificateProductCode, FinanceCertificationPrice[]>();
    snapshot.certificationProducts.forEach((product) => groups.set(product.code, []));
    snapshot.certificationPrices.forEach((price) => {
      groups.set(price.productCode, [...(groups.get(price.productCode) || []), price]);
    });
    return groups;
  }, [snapshot.certificationProducts, snapshot.certificationPrices]);

  const editPrice = (price: FinanceCertificationPrice) => {
    setForm({
      productCode: price.productCode,
      currency: price.currency,
      earlyAmountMajor: minorToMajor(price.earlyAmountMinor, price.currency),
      standardAmountMajor: minorToMajor(price.standardAmountMinor, price.currency),
      isActive: price.active,
      changeReason: `Approved update to ${price.productTitle} ${price.currency} fee`,
    });
    onMessage(`${price.productTitle} ${price.currency} fee loaded for editing.`);
  };

  const savePrice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onError('');
    onMessage('');

    const earlyAmountMinor = majorToMinor(form.earlyAmountMajor, form.currency);
    const standardAmountMinor = majorToMinor(form.standardAmountMajor, form.currency);
    if (earlyAmountMinor <= 0 || standardAmountMinor < earlyAmountMinor) {
      onError('Enter a positive early fee. The standard fee must be equal to or higher than the early fee.');
      return;
    }
    if (form.changeReason.trim().length < 5) {
      onError('Enter a reason of at least five characters for the certification fee change.');
      return;
    }

    try {
      setBusy('save');
      await saveFinanceCertificationPrice({
        productCode: form.productCode,
        currency: form.currency,
        earlyAmountMinor,
        standardAmountMinor,
        isActive: form.isActive,
        changeReason: form.changeReason,
      });
      onMessage('Certification fee saved and recorded in the immutable finance audit trail.');
      await onRefresh();
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : 'The certification fee could not be saved.');
    } finally {
      setBusy('');
    }
  };

  const togglePrice = async (price: FinanceCertificationPrice) => {
    const reason = window.prompt(
      `Reason for ${price.active ? 'deactivating' : 'activating'} the ${price.productTitle} ${price.currency} fee:`,
      price.active ? 'Approved temporary certification fee deactivation' : 'Approved certification fee activation',
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
      onMessage(`${price.productTitle} ${price.currency} fee ${price.active ? 'deactivated' : 'activated'}.`);
      await onRefresh();
    } catch (toggleError) {
      onError(toggleError instanceof Error ? toggleError.message : 'Unable to change certification fee status.');
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
      `Deactivate ${product.title}? Candidates will not receive a new checkout offer while the product is inactive. Existing paid credentials remain unchanged.`,
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
          ['Pending certificate orders', snapshot.certificationSummary.pendingOrders, BadgeCheck],
          ['Issued paid credentials', snapshot.certificationSummary.credentials, ShieldCheck],
        ].map(([label, value, Icon]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Icon className="h-5 w-5 text-violet-600" />
            <p className="mt-3 text-3xl font-black text-slate-950">{Number(value)}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{String(label)}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
          <div className="flex items-center gap-2">
            <FileBadge2 className="h-5 w-5 text-violet-600" />
            <h2 className="font-black text-slate-950">Configure certification fee</h2>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Early and standard fees are used by the existing certificate checkout authority. Amounts are stored server-side in minor currency units.
          </p>

          {!snapshot.access.canManageCertificatePrices ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Your account has view-only access to certification products and fees.
            </div>
          ) : (
            <form onSubmit={savePrice} className="mt-5 space-y-4">
              <label className="block text-xs font-bold text-slate-600">Certification product
                <select
                  value={form.productCode}
                  onChange={(event) => setForm({ ...form, productCode: event.target.value as FinanceCertificateProductCode })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  {snapshot.certificationProducts.map((product) => (
                    <option key={product.code} value={product.code}>{product.title}</option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold text-slate-600">Currency market
                <select
                  value={form.currency}
                  onChange={(event) => setForm({ ...form, currency: event.target.value as FinanceCertificateCurrency })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="NGN">NGN — Nigeria market</option>
                  <option value="USD">USD — International market</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-slate-600">Early fee
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.earlyAmountMajor}
                    onChange={(event) => setForm({ ...form, earlyAmountMajor: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="text-xs font-bold text-slate-600">Standard fee
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.standardAmountMajor}
                    onChange={(event) => setForm({ ...form, standardAmountMajor: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>
              </div>

              <label className="block text-xs font-bold text-slate-600">Change reason
                <textarea
                  value={form.changeReason}
                  onChange={(event) => setForm({ ...form, changeReason: event.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                />
                Active fee
              </label>

              <button
                type="submit"
                disabled={busy === 'save'}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save certification fee
              </button>
            </form>
          )}
        </section>

        <section className="space-y-4 lg:col-span-2">
          {snapshot.certificationProducts.map((product) => {
            const prices = pricesByProduct.get(product.code) || [];
            return (
              <article key={product.code} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-violet-500">{product.code}</p>
                    <h3 className="mt-1 text-lg font-black text-slate-950">{product.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{product.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {featureSummary(product).map((feature) => (
                        <span key={feature} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{feature}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${product.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                      {product.active ? 'Available' : 'Inactive'}
                    </span>
                    {snapshot.access.canManageCertificatePrices && (
                      <button
                        type="button"
                        onClick={() => void toggleProduct(product)}
                        disabled={busy === `product:${product.code}`}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-50"
                      >
                        {busy === `product:${product.code}`
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : product.active
                            ? <ToggleRight className="h-4 w-4 text-emerald-600" />
                            : <ToggleLeft className="h-4 w-4" />}
                        {product.active ? 'Deactivate product' : 'Activate product'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {prices.length ? prices.map((price) => {
                    const key = `${price.productCode}:${price.currency}`;
                    return (
                      <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-wider text-slate-400">{price.currency}</p>
                            <p className="mt-1 text-lg font-black text-slate-950">{formatMoney(price.earlyAmountMinor, price.currency)}</p>
                            <p className="text-xs text-slate-500">Early fee</p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${price.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                            {price.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="mt-3 rounded-lg bg-white p-3">
                          <p className="text-[10px] font-bold uppercase text-slate-400">Standard fee</p>
                          <p className="mt-1 font-black text-slate-800">{formatMoney(price.standardAmountMinor, price.currency)}</p>
                        </div>
                        <p className="mt-3 text-[11px] text-slate-500">Updated {new Date(price.updatedAt).toLocaleString()}</p>
                        {snapshot.access.canManageCertificatePrices && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => editPrice(price)}
                              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void togglePrice(price)}
                              disabled={busy === `price:${key}`}
                              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-50"
                            >
                              {busy === `price:${key}`
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : price.active
                                  ? <ToggleRight className="h-4 w-4 text-emerald-600" />
                                  : <ToggleLeft className="h-4 w-4" />}
                              {price.active ? 'Deactivate fee' : 'Activate fee'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <div className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 sm:col-span-2">
                      No fee has been configured for this certification product.
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-violet-600" />
          <h2 className="font-black text-slate-950">Recent certification finance audit</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {snapshot.certificationAudit.length ? snapshot.certificationAudit.slice(0, 12).map((event) => (
            <div key={event.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-slate-800">{event.action.replaceAll('_', ' ')}</p>
                <p className="text-[11px] text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">{event.actorName || 'System'} · {event.entityId || event.entityType}</p>
              {typeof event.metadata?.reason === 'string' && (
                <p className="mt-2 text-xs text-slate-700">{event.metadata.reason}</p>
              )}
            </div>
          )) : (
            <p className="text-sm text-slate-500">No certification fee or product changes have been recorded yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
