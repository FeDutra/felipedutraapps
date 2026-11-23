# Nu Empresa · evidência de categoria e boxes

23/11/2026. Fe aprovou aprofundar a referência com boxes e dados reais, mantendo operações físicas no Air e liberando iMac para chamada.

## Dados e natureza

Conta bancária canônica 5dc65e99-ce6a-4758-b572-314307e62e18 corresponde ao Nu Empresa por identificação de Fe. Isso não determina natureza pessoal/empresarial, dedutibilidade ou finalidade de cada movimento. O nome Nu Empresa é um alias de apresentação, não uma alteração na conta bancária ou no Notion.

Leitura bancária paginada: 965 movimentos no período disponível, 136 POSTED de novembro na data da canária. Filtro de mês em America/Sao_Paulo; pendentes não entram. Notion continua como livro operacional: 849 registros lidos no escopo da coleta, totais econômicos separados do banco.

Sugestões: 2 alta,62 média,72 baixa. Alta exige categoria específica do banco corroborada por identificador textual de fornecedor; média usa categoria específica sem corroboração ou tipo bancário (transferência/fatura); baixa inclui compras genéricas e créditos cuja natureza econômica não pode ser inferida. Todos os rótulos continuam confirmed:false. Não se trata de aprovação contábil nem classificação canônica gravada.

Distribuição sugerida inclui apenas débitos com categoria específica e nature expense_candidate. Exclui créditos, transferências, pagamentos de cartão e compras genéricas. Os totais não são somados às despesas do Notion. Não foi confirmado pagamento por semelhança nem reclassificado lançamento canônico.

## Entrega de leitura

Campos opcionais por transação: accountId,providerCategory,classification(category,confidence,reason,source,nature,confirmed:false). Whitelist estrita remove documentos de estabelecimento/contraparte. API limita1500linhas; interface informa recebidos versus postedCount, sem afirmar completude se truncado. Captura atual136/136.

Boxes translúcidos e bordas suaves delimitam indicadores, gráfico, revisão, categorias e detalhe. Metadados das fontes recolhidos, estado parcial permanece visível. Filtro de confiança e drilldown categoria→movimentos. Privacidade oculta valores, gráficos, descrições e distribuição sugerida.

## Operação

O cron existente permanece no mesmo horário; apenas consumidor de projeção recebe enriquecimento e publicador compatível. Nenhum banco, cartão, lançamento Notion ou job LASTRO alterado. Antes de trocar consumidor, backup em data/finance-boxes-20261123/rollback. Campos são opcionais; frontend e leitura suportam projeção antiga.

Build Functions e21testes passaram, incluindo fuso/limite mensal, sinal monetário, duplicidades, campo privado removido e falta de corroboração. Canária UI valida8visões, confiança, busca/filtros/detalhe,drilldown,privacidade,rascunho e390/768/1500px. Login Firebase completo/chat+painel nativo e iPhone físico não testados. Hosting preview separado; não equivale a atualizar aplicativo instalado.
