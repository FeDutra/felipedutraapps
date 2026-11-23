"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFinanceProjection = readFinanceProjection;
const core_1 = require("./core");
// Administrative projection only. This never reads a client-supplied document path.
function readFinanceProjection(record, uid, now = new Date()) {
    if (!record)
        throw new core_1.OpenFinanceError('snapshot_not_ready', 409);
    if (record.ownerUid !== uid)
        throw new core_1.OpenFinanceError('snapshot_owner_mismatch', 403);
    const p = record.projection;
    const cents = (v) => { if (!Number.isSafeInteger(v))
        throw new core_1.OpenFinanceError('invalid_snapshot', 502); return v; };
    const str = (v) => { if (typeof v !== 'string' || v.length > 1200)
        throw new core_1.OpenFinanceError('invalid_snapshot', 502); return v; };
    const timestamp = (v) => { if (typeof v !== 'string' || !Number.isFinite(Date.parse(v)))
        throw new core_1.OpenFinanceError('invalid_snapshot', 502); return v; };
    if (p?.version !== 1 || !/^\d{4}-\d{2}$/.test(p.month) || !Array.isArray(p.bank?.balances) || !Array.isArray(p.transactions) || !Array.isArray(p.coverage?.missing))
        throw new core_1.OpenFinanceError('invalid_snapshot', 502);
    const classification = (v) => {
        if (!['alta', 'media', 'baixa'].includes(v.confidence) || !['banco_estabelecimento', 'banco', 'notion'].includes(v.source) || !['expense_candidate', 'transfer_candidate', 'card_payment_candidate', 'income_unresolved', 'unresolved'].includes(v.nature) || v.confirmed !== false)
            throw new core_1.OpenFinanceError('invalid_classification', 502);
        return { category: str(v.category), confidence: str(v.confidence), reason: str(v.reason), source: str(v.source), nature: str(v.nature), confirmed: false };
    };
    const planning = (() => {
        const v = p.planning;
        if (v === undefined)
            return undefined;
        const rows = (x, limit = 2000) => { if (!Array.isArray(x) || x.length > limit)
            throw new core_1.OpenFinanceError('invalid_planning', 502); return x; };
        const link = (s) => { if (typeof s !== 'string' || !/^https:\/\/(www\.)?notion\.so\/[a-f0-9]{32}$/.test(s))
            throw new core_1.OpenFinanceError('invalid_source_link', 502); return s; };
        const flag = (v) => { if (typeof v !== 'boolean')
            throw new core_1.OpenFinanceError('invalid_planning', 502); return v; };
        const positive = (n) => { if (cents(n) < 0)
            throw new core_1.OpenFinanceError('invalid_planning', 502); return n; };
        const inventory = (items) => rows(items).map((e) => ({ id: str(e.id), name: str(e.name), amountMinor: positive(e.amountMinor), sourceUrl: link(e.sourceUrl) }));
        if (v.version !== 1 || v.state !== 'partial')
            throw new core_1.OpenFinanceError('invalid_planning', 502);
        const sourceCounts = {};
        for (const [k, n] of Object.entries(v.sourceCounts || {})) {
            if (!['expenses', 'income', 'budget', 'flow', 'accounts', 'goals', 'debts'].includes(k) || !Number.isSafeInteger(n) || Number(n) < 0)
                throw new core_1.OpenFinanceError('invalid_planning', 502);
            sourceCounts[k] = Number(n);
        }
        return { version: 1, updatedAt: timestamp(v.updatedAt), state: 'partial', scope: str(v.scope), coverageNote: str(v.coverageNote), sourceCounts, registeredPayableMinor: positive(v.registeredPayableMinor), receivedMinor: positive(v.receivedMinor),
            entries: rows(v.entries).map((e) => { if (!['payable', 'receivable'].includes(e.kind) || e.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || e.month !== null && !/^\d{4}-\d{2}$/.test(e.month))
                throw new core_1.OpenFinanceError('invalid_planning', 502); return { id: str(e.id), name: str(e.name), kind: e.kind, amountMinor: positive(e.amountMinor), date: e.date === null ? null : str(e.date), month: e.month === null ? null : str(e.month), paid: flag(e.paid), review: flag(e.review), sourceUrl: link(e.sourceUrl), note: str(e.note) }; }),
            budget: inventory(v.budget), goals: inventory(v.goals), debts: inventory(v.debts), issues: rows(v.issues, 100).map((e) => ({ code: str(e.code), message: str(e.message), sourceUrl: link(e.sourceUrl) })), accountCoverage: rows(v.accountCoverage, 100).map((e) => ({ id: str(e.id), name: str(e.name), sourceUrl: link(e.sourceUrl), state: str(e.state) })) };
    })();
    const age = now.getTime() - Date.parse(p.sourceUpdatedAt);
    const sourceState = p.sourceState === 'consent_expired' ? 'consent_expired' : Number.isFinite(age) && age >= 0 && age <= 36 * 3600000 && p.sourceState === 'available' ? 'available' : 'stale_or_unavailable';
    const count = (v) => { if (!Number.isSafeInteger(v) || v < 0)
        throw new core_1.OpenFinanceError('invalid_snapshot', 502); return v; };
    const counts = {};
    for (const key of ['ambiguous', 'review_candidate', 'identity_match', 'not_in_notion', 'pending', 'unmapped_account', 'unknown_due_to_partial_source'])
        if (p.reconciliation?.counts?.[key] !== undefined)
            counts[key] = count(p.reconciliation.counts[key]);
    return { version: 1, month: p.month, generatedAt: timestamp(p.generatedAt), collectedAt: timestamp(p.collectedAt), sourceUpdatedAt: p.sourceUpdatedAt === null ? null : timestamp(p.sourceUpdatedAt), sourceState, refreshPolicy: 'meupluggy_24h_no_manual_update',
        coverage: { state: 'partial', missing: p.coverage.missing.map(str), notionComplete: p.coverage.notionComplete === true },
        bank: { daily: (p.bank.daily || []).map((d) => ({ date: str(d.date), inflowMinor: cents(d.inflowMinor), outflowMinor: cents(d.outflowMinor) })), balances: p.bank.balances.map((a) => ({ accountId: str(a.accountId), name: str(a.name), currency: a.currency === 'BRL' ? 'BRL' : (() => { throw new core_1.OpenFinanceError('unsupported_currency'); })(), balanceMinor: cents(a.balanceMinor) })), postedCount: count(p.bank.postedCount), inflowMinor: cents(p.bank.inflowMinor), outflowMinor: cents(p.bank.outflowMinor) },
        notion: { recordCount: count(p.notion.recordCount), receivedMinor: cents(p.notion.receivedMinor), expenseMinor: cents(p.notion.expenseMinor), reimbursementMinor: cents(p.notion.reimbursementMinor), cardPaymentMinor: cents(p.notion.cardPaymentMinor), reconciledWithApi: p.notion.reconciledWithApi === true },
        reconciliation: { counts, applied: count(p.reconciliation.applied) }, commitmentsState: planning ? 'partial' : 'not_loaded', ...(planning ? { planning } : {}),
        transactions: p.transactions.slice(0, 1500).map((t) => ({ id: str(t.id), date: timestamp(t.date), description: str(t.description), amountMinor: cents(t.amountMinor), ...(t.accountId ? { accountId: str(t.accountId) } : {}), ...(t.providerCategory ? { providerCategory: str(t.providerCategory) } : {}), ...(t.classification ? { classification: classification(t.classification) } : {}) })) };
}
//# sourceMappingURL=projection.js.map