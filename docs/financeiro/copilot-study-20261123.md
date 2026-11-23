# Financeiro · estudo integrado a partir do Copilot

23/11/2026. Baseline 74736716 sobre origin/main ba9e9181. Oito telas do demo Copilot 6.9.0 estudadas no iMac; implementação autoral, sem reutilizar marca, código ou ativos. PULSO mantém chat canônico e fonte Notion/LASTRO, não importa números fictícios.

## Escopo executável

- Visão geral: receitas/despesas classificadas, gráfico diário, recentes, conciliação e lacunas.
- Transações: recorte recebido, busca, filtro entrada/saída, seleção e detalhe. Não simula extrato completo, categoria ou confirmação de pagamento.
- Fluxo: entradas/saídas bancárias e composição, separadas da classificação econômica.
- Contas: saldos por conta e moeda, atualização e cobertura. Não soma moedas nem chama saldo de caixa livre.
- Categorias: totais por natureza do Notion; limites e categorias detalhadas ainda ausentes.
- Recorrências, metas e patrimônio: destinos próprios com lacunas explícitas, sem saldo/compromisso zero inventado. Ainda não possuem integração de suas bases de planejamento.

## Invariantes

- Mesmos endpoint, auth Firebase e grant temporário somente leitura existentes. Nenhuma nova credencial/grant, escrita financeira ou sincronização criada.
- Refresh independente, abort serializado, timeout de 20s, retorno à lista/sessão renova painel sem remount do chat. Rascunhos e renderer canônico preservados.
- Ocultar valores remove gráfico, composição, detalhes e descrições de transações. Busca, filtro e navegação são locais, sem efeito social/financeiro.
- Datas em São Paulo, moeda por conta, estado parcial visível.
- Não altera conteúdo de /live, rotinas LASTRO, backend, projeção ou dados canônicos.

## Verificação

Canária do componente real com auth injetada e projeção privada: 8 destinos, busca, filtro, detalhe, privacidade transversal, refresh preservando rascunho externo/filtro; 390/768/1500px sem overflow e sem pageerrors. Isso não prova login Firebase, split autenticado com LASTRO ou WebView instalado. CSS inspecionado em captura após build; evidências privadas fora do Git.

Build e SHA final registrados na entrega. Preview é alvo web separado; apps Tauri embutem frontend e não são atualizados por Hosting. Não declarar instalado sem CI e prova nativa. Planejamento completo é etapa seguinte de dados, não recurso já concluído.
