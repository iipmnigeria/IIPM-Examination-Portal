# Finance Console Examination Administrator Activation

## Purpose

Activate the existing Finance Console launcher for active Examination Administrator accounts while applying an explicit least-privilege role profile.

The Finance Console is already mounted through `AdminCommerceConsole`, which is retained as a compatibility alias to `AdminFinanceConsole`. The consolidated administrator Tools menu discovers the authorised fixed launcher automatically. No new browser-only access switch is introduced.

## Enabled permissions

- `finance.console.view`
- `finance.dashboard.view`
- `finance.receipts.manage`
- `finance.exports.download`

## Restricted permissions

- `finance.exam_prices.manage`
- `finance.certificate_prices.manage`
- `finance.coupons.manage`
- `finance.orders.manage`
- `finance.settings.manage`
- `finance.transactions.reconcile`
- `finance.access.recover`
- `finance.adjustments.approve`
- `finance.permissions.manage`

Super Administrators retain their implicit complete finance authority.

## Operational result

After deployment and a new authenticated session, an active Examination Administrator such as the `test` account will see **Finance** in the consolidated administrator Tools menu. Selecting it opens the Finance Console. The officer can review the dashboard and transactions, generate eligible receipts and download finance exports. Pricing, coupon, settings, payment-verification, recovery, adjustment and permission-management operations remain denied server-side.

## Scope and safety

This package changes only the Examination Administrator Finance Console role-permission profile. It does not modify orders, payments, examination fees, certification fees, coupons, receipts, candidates, certificates, Paystack configuration, fulfilment functions or historical finance records.

The current permission system is role-based. The activation therefore applies to every active Examination Administrator account, not only one named user.
