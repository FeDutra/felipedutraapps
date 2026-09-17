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
