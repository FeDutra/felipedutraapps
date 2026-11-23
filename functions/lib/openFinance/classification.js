"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suggestClassification = suggestClassification;
exports.enrichFinanceSnapshot = enrichFinanceSnapshot;
const categories = { 'Groceries': 'Mercado', 'Gas stations': 'Combustível', 'Eating out': 'Alimentação fora de casa', 'Services': 'Serviços · detalhar', 'Digital services': 'Serviços digitais', 'Telecommunications': 'Telefonia', 'Electricity': 'Energia elétrica', 'Pharmacy': 'Farmácia', 'Food and drinks': 'Alimentação · detalhar', 'Transportation': 'Transporte', 'Clothing': 'Vestuário', 'Housing': 'Moradia · detalhar', 'Pet supplies and vet': 'Animais e veterinário', 'Parking': 'Estacionamento', 'Automotive': 'Veículo · detalhar', 'Education': 'Educação', 'Video streaming': 'Streaming', 'Taxi and ride-hailing': 'Transporte por aplicativo', 'Travel': 'Viagens', 'Gas': 'Gás', 'Internet': 'Internet', 'Electronics': 'Eletrônicos' };
const normalize = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
function suggestClassification(t) {
    const base = { confirmed: false, source: 'banco' };
    const p = String(t.category || '');
    if (['Transfers', 'Transfer - PIX', 'Same person transfer'].includes(p))
        return { ...base, category: 'Transferência · conferir finalidade', confidence: 'media', reason: 'Banco marcou transferência; favorecido e finalidade econômica ainda precisam de conciliação.', nature: 'transfer_candidate' };
    if (p === 'Credit card payment')
        return { ...base, category: 'Pagamento de cartão', confidence: 'media', reason: 'Marcado pelo banco como pagamento de cartão; separado das compras para evitar duplicidade.', nature: 'card_payment_candidate' };
    if (t.type === 'CREDIT')
        return { ...base, category: 'Entrada · classificar', confidence: 'baixa', reason: 'Crédito bancário pode ser receita, transferência, empréstimo ou reembolso. Sem confirmação de natureza econômica.', nature: 'income_unresolved' };
    if (t.type !== 'DEBIT')
        return { ...base, category: 'Operação · revisar', confidence: 'baixa', reason: 'Direção da operação não reconhecida.', nature: 'unresolved' };
    if (!categories[p])
        return { ...base, category: p === 'Shopping' ? 'Compras · detalhar' : 'Saída · classificar', confidence: 'baixa', reason: p === 'Shopping' ? 'Categoria genérica de compras não identifica a finalidade do gasto.' : 'Fonte sem categoria específica suficiente.', nature: 'unresolved' };
    const text = normalize([t.description, t.descriptionRaw, t.merchant?.name, t.merchant?.businessName].join(' '));
    const corroborated = (p === 'Electricity' && /\b(ENEL|ELETROPAULO|ENERGISA|CPFL|CEMIG|COPEL)\b/.test(text)) || (p === 'Telecommunications' && /\b(VIVO|CLARO|TIM|TELEFONICA)\b/.test(text)) || (p === 'Video streaming' && /\b(NETFLIX|DISNEY|MAX|GLOBOPLAY)\b/.test(text));
    return { ...base, category: categories[p], confidence: corroborated ? 'alta' : 'media', source: corroborated ? 'banco_estabelecimento' : 'banco', reason: corroborated ? 'Categoria do banco corroborada pelo estabelecimento identificado. Finalidade pessoal ou empresarial ainda não confirmada.' : 'Sugestão baseada na categoria do banco, ainda sem validação no livro operacional.', nature: 'expense_candidate' };
}
function enrichFinanceSnapshot(projection, snapshot) {
    const localMonth = (value) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date(value));
    const raw = snapshot.transactions.filter((t) => t.status === 'POSTED' && localMonth(t.date) === projection.month);
    if (raw.length !== projection.bank.postedCount || new Set(raw.map((t) => t.id)).size !== raw.length)
        throw Error('transaction_count_mismatch');
    const transactions = raw.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 1500).map((t) => {
        const amount = Math.round(Math.abs(t.amount) * 100) * (t.type === 'DEBIT' ? -1 : 1);
        if (!Number.isSafeInteger(amount) || t.currencyCode !== 'BRL')
            throw Error('invalid_transaction_amount');
        return { id: t.id, date: t.date, description: t.description, amountMinor: amount, accountId: t.accountId, providerCategory: t.category || '', classification: suggestClassification(t) };
    });
    return { ...projection, transactions };
}
//# sourceMappingURL=classification.js.map