# Financeiro · caixa, vencimentos e filtros

23/11/2026 · Estudo de interface. Não implementado nem publicado.

## Direção de Fe
Priorizar filtros e melhorias da interface antes de aprofundar dados/classificações. Abrir a área e entender rapidamente quanto existe agora e o que ainda precisa pagar neste mês. Operação física só no Air; este estudo foi inteiramente no Gateway, sem tela de Mac.

## Diagnóstico no código atual
Fonte: src/apps/pulso/components/finance/FinanceWorkspace.tsx, estado 576454819c72 conforme continuidade.
- Visão geral privilegia receitas/despesas classificadas. Saldos só aparecem em Contas; compromissos ainda são placeholder. Resultado econômico e disponibilidade ficam distantes na navegação.
- Busca somente na descrição, direção e confiança são os filtros expostos. Categoria só entra pelo clique na distribuição. Ordenação fixa por data descendente; não há seleção de período, conta, valor, situação nem visão salva.
- O mesmo conjunto filtrado alimenta movimentos recentes na visão geral. Query/direção/confiança sobrevivem à troca de seção, mas categoria é limpa por go(). Isso permite recorte oculto na volta ao resumo.
- O título mostra o mês recebido, mas não existe seletor de período. Backend não fornece compromissos nesta projeção; seleção de outro mês não deve fingir consultar histórico ausente.

## Primeira dobra proposta
Contexto explícito: Família / Empresa / Consolidado. Consolidado exige fontes e vínculos; PJ não define finalidade do gasto. Uma conta PJ isolada não sustenta total familiar.

| Box | Significado | Clique |
| --- | --- | --- |
| Saldo nas contas | Dinheiro observado em contas líquidas selecionadas, por moeda, com atualização e fontes | Contas incluídas e saldos |
| Ainda a pagar neste mês | Obrigações abertas até o último dia, com vencidas discriminadas e sem somar de novo pagamentos confirmados | Lista de compromissos filtrada |
| A receber no mês | Entradas previstas, com evidência e data, sem incorporar ao dinheiro atual | Recebíveis |
| Projeção ao fim do mês | Saldo menos compromissos; cenário adicional incluindo recebimentos previstos | Memória do cálculo e linha do tempo |

Saldo observado nunca é chamado automaticamente de livre para gastar. Valores reservados/bloqueados precisam de fonte própria; cartão e limite não entram como caixa. Patrimônio não entra nessa soma. Se existirem moedas diferentes, mostrar posições separadas.

Cobertura parcial permanece legível em cada box: não disponível difere de zero. Com o recorte atual, saldo pode ser mostrado como Nu Empresa; a pagar e projeção ficam com fonte pendente. Não estimar vencimentos pela repetição de extrato.

O saldo é posição de agora, não total do mês selecionado. Se o período mudar, manter essa distinção ou oferecer posição histórica somente quando houver fonte. Mostrar data/hora local da fonte, não apenas da abertura da tela.

## Abaixo dos boxes
- Próximos pagamentos em lista: vencidas, hoje, próximos 7 dias e restante do mês. Nome, vencimento, valor, conta/responsável e situação. Calendário como alternativa, não requisito para leitura rápida.
- Linha do tempo do caixa com realizado contínuo e previsto tracejado; indicar primeiro dia negativo mesmo quando o mês termina positivo.
- Despesas por categoria e comparação com orçamento abaixo da posição de caixa, não antes dela.
- LASTRO permanece ao lado. Ações de consulta preparam contexto no chat sem enviar automaticamente nem marcar pagamentos.

## Filtros em camadas
1. Barra principal: contexto, período, contas e busca. Atalhos Este mês / Até o fim do mês / Próximos 7 dias, adequados à visão aberta.
2. A pagar: vencida / hoje / próxima / paga; recorrência e parcela. Transações: entrada / saída / transferência / fatura, categoria, faixa de valor, contraparte, confirmado / sugerido / para revisar.
3. Mais filtros: fonte, responsável, projeto e confiança. Confiança da sugestão não substitui situação de pagamento.
4. Ordenação por vencimento, maior valor ou mais recente conforme tela. Quantidade e subtotal do recorte visíveis, separados do saldo da conta; entradas e saídas não devem se cancelar num único total ambíguo.
5. Chips removíveis + Limpar tudo; estado vazio explica condições e permite removê-las. Visões salvas depois: Contas da semana, Empresa, Família e Revisar grandes valores.

Filtros se combinam por interseção entre campos e união entre valores do mesmo campo. Ao clicar no box, levar à lista correspondente com filtro explícito; voltar preserva contexto. Filtros locais da lista nunca afetam silenciosamente os totais gerais. Atualizar dados não apaga busca, filtros nem rascunho do chat.

## Interação e acabamento
Boxes escuros de baixa opacidade, blur real, borda discreta e tipografia hierárquica. Valores principais grandes; rótulos legíveis, sem reduzir informação importante à opacidade mínima. Cor é apoio, não único indicador. Foco visível, teclado e rótulos acessíveis. Mobile empilha os boxes e oferece resumo dos filtros ativos sem rolagem horizontal.

Privacidade esconde valores, gráficos reveladores e nomes sensíveis também nos detalhes, subtotais e tooltips. Atualização mostra carregando, última leitura e erro sem transformar falha em saldo zero. Fontes ausentes têm explicação curta e contexto para LASTRO; não botão de integração fictício.

## Sequência recomendada
1. Protótipo de interface separado e explicitamente demonstrativo, usando cenários fictícios identificados. Validar primeira dobra, atalhos e navegação antes de ampliar coleta real.
2. Exercitar período, combinações, limpar/voltar, valores ocultos, teclado, 390/768/1500 px e atualização sem perder rascunho.
3. Conectar fontes faltantes e revisar regras financeiras só após validar a experiência. Não promover app instalado durante o estudo.

## Cenários de aceite
- Em poucos segundos, localizar posição, obrigações e lacunas sem trocar de aba.
- Abrir A pagar e ver exatamente o conjunto que compõe o total, incluindo saldo aberto de pagamento parcial quando fornecido.
- Fatura representa obrigação de caixa; compras não somam novamente ao total a pagar da mesma fatura. Transferência interna consolidada não cria receita.
- Fonte incompleta não produz sobra aparentemente garantida; recebíveis incertos ficam em cenário separado.
- A projeção alerta falta de caixa antes de um recebível posterior; não depende apenas do saldo no fim do mês.
- Filtro de transações nunca altera silenciosamente o resumo; saldo observado não muda por busca textual.

## Referências consultadas
- Estudo local documentado do demo Copilot 6.9.0: artifacts/financeiro-referencias-20261123/README.md. Dashboard, categorias, recorrências e contas observados em fase anterior; nenhuma nova sessão autenticada neste estudo.
- https://help.copilot.money/en/ — documentação pública confirma separação Dashboard, Cash Flow, Accounts, Transactions e Recurrings. Páginas de coleção retornaram pouco conteúdo; não atribuir comportamentos de filtro não verificados.
- https://actualbudget.org/docs/transactions/filters/ — filtros combináveis, intervalos de data/valor, total filtrado e filtros salvos. Usar referência funcional; Fe rejeitou Actual como direção visual.
- https://actualbudget.org/docs/reports/ — cards de resumo/calendário, períodos estáticos/dinâmicos e separação fluxo/patrimônio. Previsão de saldo aparece como experimental nessa fonte.
- Contexto Notion DINHEIRO fornecido nesta sessão: visão econômica, compromissos próximos, reservas e separação familiar/empresarial; norte de clareza sem decisão financeira automatizada.

Pesquisa pública por busca indisponível; consulta direta às fontes oficiais funcionou. Nenhum banco, classificação, serviço, credencial, rotina ou app instalado foi alterado.
