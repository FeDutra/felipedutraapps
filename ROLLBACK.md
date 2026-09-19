# Rollback — Modo Presença em tempo real

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
