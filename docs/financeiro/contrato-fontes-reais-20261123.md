# Contrato de fontes do Financeiro

23/11/2026. Organização autorizada por Fe. Não é fechamento contábil nem decisão financeira.

## Autoridades

| Informação | Fonte responsável | Regra |
| --- | --- | --- |
| Saldo bancário observado | Pluggy | Posição por conta/moeda e atualização. Histórico Notion não é saldo atual. |
| Movimentação realizada | Pluggy nas contas conectadas; extrato conciliado no Notion nas demais | Mesmo fato uma vez, por identidade bancária e conta. Similaridade é candidata, não baixa automática. |
| Categoria bancária | Pluggy | Sugestão; finalidade econômica e núcleo não decorrem da conta PJ. |
| Natureza/núcleo validados | Notion + LASTRO | Decisão operacional canônica. Não sobrescrever com categoria do provedor. |
| Contas a pagar | Despesas/Notion | `Pago?` exclui do aberto. `Data de Vencimento` é a data; `Data do Gasto` apenas ancora o mês quando falta vencimento. |
| Recebíveis | Painel de Fluxo/Notion | Tipo `Projeção` + `Papel na projeção=Recebível`. Não repetir na base Receitas como se já recebido. |
| Receita recebida | Receita validada/Notion e movimento conciliado | Distinta do previsto; não somar os espelhos bancários. |
| Orçamento | Orçamento/Notion | Valores cadastrados com vigência a validar; não presumir relação com categorias sugeridas. |
| Objetivos e dívidas | Bases próprias/Notion | Cadastro não é reserva disponível ou saldo devedor atualizado. Sem somar estoque patrimonial ao fluxo. |
| Cartões | Fatura + cadastro operacional Notion | Pagamento de fatura não é nova compra. Cadastros atuais sem fechamento/vencimento. |

LASTRO organiza e confirma. PULSO é leitura composta; não possui segundo livro financeiro.

## Cobertura auditada

- Pluggy: um item UPDATED, uma conta BANK/CHECKING_ACCOUNT em BRL. Nu Empresa mapeada ao cadastro Nubank Pulso. 965 movimentos retornados com paginação concluída; 136 efetivados no mês. Meu Pluggy atualiza a cada 24h, sem promessa de tempo real ou refresh manual bancário.
- Notion: 319 Despesas, 15 Receitas, 12 rubricas de Orçamento, 36 registros do Painel de Fluxo, 4 contas, 1 objetivo e 4 dívidas; consultas completas. Dois cartões cadastrados sem datas de fechamento/vencimento.
- Outras contas: Inter Nati PF, Inter Nati PJ e Nubank Felipe sem saldo atual via Pluggy. Há histórico conciliado, que não será convertido em posição de hoje.
- Novembro: zero obrigação aberta cadastrada, não zero compromissos reais. R$ 1.500 de Sara previstos para 24/11/2026, não recebidos na fonte atual.
- Enel novembro: registros atuais pagos prevalecem sobre nota antiga de pagamento não confirmado. Nenhum pago foi alterado por esta integração.

## Organização aplicada

Somente metadado `Papel na projeção` adicionado ao Painel de Fluxo: Recebível / Despesa estimada / Resumo / Revisar. As 36 linhas existentes receberam papel conforme sua função observada, sem alteração de valor, data, status de pagamento ou classificação econômica. Novos recebíveis precisam do papel explícito, nunca identificação por texto ou lista fixa de IDs no consumidor.

Leitura composta incorpora agenda, recebíveis, orçamento, objetivos/dívidas e mapa de cobertura. Bases parcialmente paginadas falham preservando o snapshot anterior; não viram total zero. Atualização mantém a rotina/horário existente. Projeção privada validada por proprietário e whitelist no backend. Nunca retorna CNPJ/merchant bruto/credenciais.

## Pendências materiais

- Completar saldos atuais e faturas das contas não conectadas. Não somar saldos iniciais zero do Notion como posição real.
- Confirmar renda Nati/GUAYI: referências históricas divergentes ficam fora do previsto.
- Resolver Enel dezembro: estimativas divergentes em Despesas (487,71) e Fluxo (609,95); previsão aparece em revisão, nunca como cobrança confirmada.
- Validar vigência do orçamento e cadastros antigos de dívidas/objetivo.
- Resolver classificações econômicas em revisão e correspondências bancárias candidatas. Nenhuma baixa por semelhança, nenhuma dupla soma de Notion + Pluggy.

## Critérios de fechamento

Integração técnica: fonte explícita, paginação, snapshot preservado no erro, links de origem, privacidade e testes de leitura. Fechamento financeiro: saldos reconciliados e cobertura confirmada, faturas, vencimentos e classificações materiais resolvidos. A primeira condição não substitui a segunda.

Backup/rollback privado em data/finance-sources-20261123; instruções no ROLLBACK.md. Esta fase não instala app nativo, não movimenta dinheiro, não envia mensagens externas e não cria ou reprograma jobs.
