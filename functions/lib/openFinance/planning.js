"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.composePlanning = composePlanning;
// Notion operational records remain canonical. This module never writes financial records.
const text = (v) => (v?.title || v?.rich_text || []).map((x) => x.plain_text || x.text?.content || '').join('');
const amount = (n) => { if (typeof n !== 'number' || !Number.isFinite(n) || n < 0)
    throw Error('invalid_planning_amount'); const c = Math.round(n * 100); if (!Number.isSafeInteger(c))
    throw Error('invalid_planning_amount'); return c; };
const day = (v) => v?.date?.start?.slice(0, 10) || null;
const url = (id) => `https://www.notion.so/${id.replace(/-/g, '')}`;
function composePlanning(sources, month, now = new Date()) {
    for (const key of ['expenses', 'income', 'budget', 'flow', 'accounts', 'goals', 'debts'])
        if (!Array.isArray(sources[key]?.results) || sources[key].has_more !== false)
            throw Error(`incomplete_notion_${key}`);
    const entries = [], issues = [];
    for (const r of sources.expenses.results) {
        const v = r.properties, name = text(v.Nome), n = v.Valor?.number;
        if (!name || n === null)
            continue;
        const due = day(v['Data de Vencimento']), spent = day(v['Data do Gasto']);
        entries.push({ id: r.id, name, kind: 'payable', amountMinor: amount(n), date: due, month: (due || spent)?.slice(0, 7) || null, paid: v['Pago?']?.checkbox === true, review: v.Revisar?.checkbox === true, sourceUrl: url(r.id), note: due ? 'Vencimento do Notion.' : 'Sem vencimento confirmado; Data do Gasto não vira data de pagamento.' });
    }
    for (const r of sources.flow.results) {
        const v = r.properties;
        if (v['Papel na projeção']?.select?.name !== 'Recebível')
            continue;
        if (v.Tipo?.select?.name !== 'Projeção')
            continue;
        const d = day(v['Mês']);
        entries.push({ id: r.id, name: text(v.Nome), kind: 'receivable', amountMinor: amount(v.Valor?.number), date: d, month: d?.slice(0, 7) || null, paid: false, review: true, sourceUrl: url(r.id), note: text(v.Observação) });
    }
    const currentIncome = sources.income.results.filter((r) => day(r.properties['Data da Receita'])?.startsWith(month));
    // Received rows are operationally dated; undated Sara stays in the explicit forecast, not received.
    const received = currentIncome.filter((r) => r.properties.Revisar?.checkbox === false && ['Receita fixa', 'Receita variável'].includes(r.properties.Origem?.select?.name));
    const registered = entries.filter(e => e.month === month && e.kind === 'payable' && !e.paid);
    const sara = entries.find(e => e.id.replace(/-/g, '') === '41d5166d31058172998afd34581eab3f');
    if (sara)
        issues.push({ code: 'receivable_pending', message: 'Sara: previsto, não recebido; não somar ao saldo bancário.', sourceUrl: sara.sourceUrl });
    if (sources.flow.results.some((r) => text(r.properties.Nome).startsWith('PENDENTE · renda mensal Nati')))
        issues.push({ code: 'nati_income_conflict', message: 'Renda mensal Nati/GUAYI: premissas divergentes; excluída da previsão.', sourceUrl: url('3795166d31058144aec7fcac9c9675ae') });
    issues.push({ code: 'cards_incomplete', message: 'Faturas e vencimentos dos cartões ausentes. Pagamento de fatura não duplica compras.', sourceUrl: url('0fc5166d310582aebe4c01cb94df8d40') });
    const decemberEstimate = entries.find(e => e.name.includes('Enel') && e.month === '2026-12' && !e.paid);
    const enelFlow = sources.flow.results.find((r) => text(r.properties.Nome).startsWith('Enel · dezembro/2026'));
    if (decemberEstimate && enelFlow && amount(enelFlow.properties.Valor?.number) !== decemberEstimate.amountMinor) {
        decemberEstimate.review = true;
        issues.push({ code: 'enel_forecast_conflict', message: 'Enel de dezembro tem estimativas divergentes em Despesas e Painel de Fluxo; confirmar a fatura antes de usar na previsão.', sourceUrl: url(enelFlow.id) });
    }
    // Do not present dated placeholders as settled future obligations.
    for (const e of entries)
        if (e.name.includes('PREVISTO'))
            e.review = true;
    const budget = sources.budget.results.map((r) => ({ id: r.id, name: text(r.properties.Nome), amountMinor: amount(r.properties['Meu Orçamento']?.number || 0), sourceUrl: url(r.id) })).filter((r) => r.name && !r.name.startsWith('Histórico'));
    const inventory = (key, field) => sources[key].results.map((r) => ({ id: r.id, name: text(r.properties.Nome), amountMinor: amount(r.properties[field]?.number || 0), sourceUrl: url(r.id) }));
    return { version: 1, updatedAt: now.toISOString(), state: 'partial', scope: 'notion_operational_family_mixed', entries,
        registeredPayableMinor: registered.reduce((n, e) => n + e.amountMinor, 0), receivedMinor: received.reduce((n, r) => n + amount(r.properties.Valor?.number), 0),
        coverageNote: 'Agenda cadastrada consultada integralmente. Isso não prova que todos os compromissos da família foram registrados. Projeção de sobra suspensa: contas sem saldo atual e faturas ausentes.',
        sourceCounts: Object.fromEntries(Object.entries(sources).filter(([, p]) => p.results).map(([k, p]) => [k, p.results.length])),
        budget, goals: inventory('goals', 'Valor Total do Objetivo'), debts: inventory('debts', 'Valor Total do Empréstimo '), issues,
        accountCoverage: sources.accounts.results.map((r) => ({ id: r.id, name: text(r.properties.Nome), sourceUrl: url(r.id), state: r.id.replace(/-/g, '') === '3795166d31058070ab57ea4cb0235c1b' ? 'pluggy_current' : 'notion_history_only' })) };
}
//# sourceMappingURL=planning.js.map