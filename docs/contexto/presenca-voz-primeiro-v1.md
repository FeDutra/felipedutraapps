# Presença voz-primeiro · contrato v1

## Objetivo

Reduzir a distância entre fala, contexto e começo da execução sem criar uma
segunda Lótus nem mover a memória canônica para o iMac.

## Caminho crítico

1. A via rápida local continua responsável apenas por ações determinísticas,
   reversíveis e allowlisted.
2. Todo pedido restante passa por um roteador cognitivo local e síncrono antes
   de ser persistido.
3. O roteador pode escolher outra sessão existente somente quando houver
   evidência lexical suficiente e margem clara sobre a segunda opção.
4. Ambiguidade preserva a sessão ativa. O roteador nunca cria sessão, envia
   mensagem, lê fonte privada nem executa mutação.
5. O pedido chega ao OpenClaw já com sessão, área, contexto e explicação do
   roteamento resolvidos.
6. A VPS e o Firestore continuam sendo a memória e o registro canônicos.

## Contexto quente local

O desktop mantém apenas um mapa compacto e reconstruível:

- diretório de sessões e áreas ativas;
- última sessão usada por área;
- decisões recentes de roteamento e respectivas confianças;
- versão do roteador e instante de atualização.

O cache não contém mensagens, documentos, credenciais ou memória pessoal
integral. Falha ou ausência do cache preserva a sessão ativa e não bloqueia a
conversa.

## Metas da v1

- decisão local de sessão em menos de 20 ms em condições normais;
- nenhuma chamada de rede para classificar o destino;
- nenhum pedido duplicado ao OpenClaw;
- sessão selecionada antes da criação de `pulso_requests`;
- pedido ambíguo permanece no contexto atual;
- web e celular continuam funcionais sem o iMac.

## Fora de escopo nesta versão

- modelo de linguagem local completo;
- leitura direta de WhatsApp sem OpenClaw;
- envio de mensagens ou mutações pela camada rápida;
- criação automática de sessões;
- replicação integral da memória da VPS.

