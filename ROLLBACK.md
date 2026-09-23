# Rollback — consistência visual da PULSO (23/09/2026)

- Correção posterior da Orbe: o vidro contextual foi retirado da árvore
  transformada da Orbe e promovido a uma superfície irmã, porque o WebKit
  não amostrava o split pelo `backdrop-filter` anterior. Para reverter apenas
  esse ajuste, reverta o commit da correção da Orbe e refaça o build Intel;
  a release visual anterior permanece recuperável no iMac em
  `/Applications/PULSO.backup-visual-20260923-085132.app`.
- Base reversível: branch `fix/pulso-visual-consistency-20260923`, criada sobre `main` em `b7b98317` e integrada, antes das alterações, com `feat/pulso-presence-edge-20260922` (`4da2739d`).
- Reversão: reinstalar o último artefato aprovado da execução associada ao commit `4da2739d` ou retornar o frontend para esse commit; nenhum dado de usuário é migrado por esta mudança.
- Escopo: vidro suave de sobreposição, renderer compartilhado entre chat/split, limites responsivos, centralização da Presença e âncoras de leitura.

---

# Rollback — Presença + MESA contextual (23/09/2026)

- Escopo: destino geral de área, orçamento de um checkpoint por turno, abertura
  automática de resultados relevantes na MESA e fechamento local por voz.
- Reversão de código: reverter o commit desta frente e refazer o aplicativo
  Intel. A Presença distribuída, a Kokoro e a via rápida de aplicativos ficam.
- Reversão de dados: arquivar a sessão `despertar_geral` caso ela tenha sido
  criada no Firestore; nenhum histórico existente é movido ou apagado.
- Reversão no iMac: encerrar `/Applications/PULSO.app` e restaurar o backup
  `PULSO.backup-before-presence-mesa-*.app` preservado na instalação.

---

# Rollback — Presença distribuída (22/09/2026)

## Roteador cognitivo local e contexto quente

- Escopo: inferência local de sessão antes da fila canônica, cache compacto de
  destinos e metadados de roteamento no pedido.
- Reversão: reverter somente o commit desta camada e refazer o build desktop.
  A via rápida de aplicativos, o Gemini Live, a Kokoro e as sessões canônicas
  permanecem intactos.
- Contingência sem novo build: desativar o roteamento automático na Presença;
  pedidos continuam na sessão que já estiver ativa.

## Sinônimos naturais da via rápida local

- Escopo: remover determinantes e prefixos como `meu`, `aplicativo`, `app de`
  e `programa` antes de resolver o nome exato do aplicativo permitido.
- Reversão: reverter somente o commit dos sinônimos; a via rápida original e
  o restante da Presença permanecem intactos.

## Aplicativo e transporte

- Encerre `/Applications/PULSO.app`, retenha a versão atual e restaure `/Applications/PULSO.backup-20260922-161726.app` como `/Applications/PULSO.app`.
- Sem trocar o aplicativo, selecione `local — openclaw + kokoro` nas configurações de voz ou abra `/pulso/live?gemini_live=0`.
- No código, reverta somente o commit da Presença distribuída; preserve os commits da Kokoro e da ponte de execução local.

---

# Rollback — Modo Presença em tempo real

## Padrão de execução local e correção do Kokoro desktop — 22/09/2026

- Baseline: `6489705d2f2bd2852f6d06765fb69a4a74923073` em `main`.
- Escopo: contrato durável do nó local, gate de release, recursos Kokoro no CI,
  seleção do sidecar no desktop e fallback sidecar → VPS.
- Reversão: reverter apenas o commit desta frente e refazer o build desktop.
  Isso não remove nem altera o nó OpenClaw já instalado no iMac.
- Contingência sem novo build: selecionar `kokoro_http` no app e usar o endpoint
  público da VPS; a web continua independente do sidecar local.

---

## Split de até quatro chats — 20/09/2026

- Baseline: `27f8b639bc2adcbd767cc8edd45c41e76a1823b1`
- Escopo: foco automático do compositor, clique esquerdo substitui o painel ativo, clique direito abre novo painel até o limite de quatro.
- Reversão: reverter o commit desta frente e publicar novamente apenas o Hosting do Firebase.

---

Mudança iniciada em 17/09/2026 na branch `feat/pulso-presence-realtime`.

## Escopo

- unificar o ciclo de captura e reprodução do Modo Presença;
- usar Kokoro obrigatoriamente nas respostas de voz;
- evitar reinício do gravador legado após a resposta;
- orientar respostas orais curtas sem retirar contexto da Lótus.

## Reversão

Antes do merge, descarte apenas os arquivos desta branch comparando-os com `main`.
Depois do merge, reverta o commit final desta mudança com `git revert <commit>` e publique novamente o Firebase Hosting.

O runtime da VPS deve ser revertido separadamente caso o adaptador seja alterado; a cópia anterior fica registrada pelo Git do workspace.

---

# Rollback — Inicialização mobile da Lótus Live

Mudança iniciada em 17/09/2026 na branch `fix/pulso-mobile-init-20260917`.

## Escopo

- consolidar a interface mobile mínima sobre a versão atual da `main`;
- impedir que consultas lentas mantenham “Sintonizando” indefinidamente;
- retirar do navegador web a chamada exclusiva do Tauri;
- manter gravação direta com contador e limite de 7 minutos.
- impedir cache de uma hora no HTML da rota limpa `/pulso/live`.

## Backup e reversão

- baseline preservada na branch `backup/pulso-mobile-before-init-fix-20260917` (`74ae899b`);
- antes do merge, comparar ou descartar apenas a branch `fix/pulso-mobile-init-20260917`;
- após merge/deploy, usar `git revert <commit-final>` e republicar apenas o Firebase Hosting;
- esta mudança não altera worker, credenciais, Firestore nem runtime da VPS.
# Rollback — boot mobile Safari (17/09/2026)

Baseline reversível: branch `backup/pulso-before-safari-boot-20260917` no commit `84678c6e`.

Para desfazer somente esta correção após o commit de release:

```bash
git revert <commit-da-correcao-safari>
npm run build
firebase deploy --only hosting
```

Escopo da correção: remover a tela bloqueante de inicialização, manter o
primeiro render idêntico entre servidor e cliente e tornar preferências em
`localStorage` opcionais quando o Safari negar acesso.

---

# Rollback — presença contínua da orbe (19/09/2026)

Baseline reversível: `47d9dd48` em `main`.

## Escopo

- remover o disco preto opaco ao redor da orbe;
- preservar transparência com blur e escurecimento radial difusos;
- manter uma única instância fixa da Lótus entre abertura, repouso, Presença,
  split, Mesa, Ateliê e Estúdio;
- interpolar posição e escala em vez de remontar ou teleportar a orbe;
- registrar o padrão em `docs/contexto/pulso-lotus-presence-standard-v1.md`.

## Reversão

Após o commit desta correção, usar `git revert <commit-da-presenca-continua>`,
executar `npm run build` e republicar somente o Firebase Hosting. A mudança não
altera Firestore, funções, credenciais nem runtime da VPS.

---

# Rollback — coreografia de abertura da Pulso (19/09/2026)

Baseline reversível: `f9bf6a93` para a presença visual; alterações posteriores
de voz e split devem ser preservadas ao reverter.

## Escopo

- esconder validação e hidratação atrás de uma abertura visual limpa;
- separar nascimento, viagem e acomodação da Lótus;
- revelar a interface durante a viagem, sem exibi-la sob a orbe no nascimento;
- substituir a superfície circular de blur por névoa radial sem perímetro.

## Reversão

Reverter apenas o commit final desta coreografia com `git revert <commit>`,
executar `npm run build` e republicar somente o Firebase Hosting. Não há mudança
em Firestore, Functions, credenciais ou runtime da VPS.

### Refinamento contínuo da entrada — 19/09/2026

- as orbes provisórias do Suspense e da autenticação foram removidas;
- nascimento, foco, escala, deslocamento e dissipação usam uma única curva
  `ease-in-out` declarada no CSS;
- a troca entre nascimento e viagem responde ao fim real da animação, com
  cronômetro apenas como proteção de contingência.

Para reverter somente este refinamento, usar `git revert <commit-da-entrada-contínua>`,
reconstruir o frontend e republicar apenas o Firebase Hosting.

---

# Rollback — ritmo de Presença (19/09/2026)

## Escopo

- consolida `progress_update` rápidos em um único checkpoint oral;
- espera 4,5s após a confirmação inicial e 12s entre checkpoints;
- descarta checkpoints pendentes quando o resultado final chega;
- orienta a voz Gemini para uma fala adulta, concreta e não infantilizada.

## Reversão

Reverter somente o commit desta alteração, executar `npm run build` e publicar
apenas o Firebase Hosting. Não altera Firestore, Functions, credenciais ou o
relay da VPS.

### Ajuste de responsividade

- o primeiro checkpoint passa a ser elegível após 3s; os seguintes mantêm 10s
  de distância mínima;
- a Orbe preserva o estado visual de trabalho enquanto a Gemini aguarda o
  retorno do cérebro da Lótus.

---

# Rollback — camadas da Mesa e leitura por voz (20/09/2026)

Baseline reversível: `dc6c012a` em `origin/main`.

## Escopo

- impedir a orbe de cobrir Mesa, menus, drawers e pré-visualizações integrais;
- preservar a mesma instância da orbe, com recuo suave apenas no mobile;
- disponibilizar na Mesa a mesma leitura TTS/Kokoro usada nas mensagens;
- elevar superfícies modais da Pulso acima da camada reservada à orbe.

## Reversão

Reverter somente o commit desta alteração, executar `npm run build` e publicar
apenas o Firebase Hosting. A mudança não altera Firestore, Functions,
credenciais, preferências de voz nem runtime da VPS.
# 23/09/2026 — consistência visual da PULSO

- Base reversível: branch `fix/pulso-visual-consistency-20260923`, criada sobre `main` em `b7b98317` e integrada, antes das alterações, com `feat/pulso-presence-edge-20260922` (`4da2739d`).
- Reversão: reinstalar o último artefato aprovado da execução associada ao commit `4da2739d` ou retornar o frontend para esse commit; nenhum dado de usuário é migrado por esta mudança.
- Escopo: vidro suave de sobreposição, renderer compartilhado entre chat/split, limites responsivos, centralização da Presença e âncoras de leitura.
