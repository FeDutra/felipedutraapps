# PULSO — padrão de presença contínua da Lótus v1

## Princípio

A orbe é a presença contínua da Lótus, não um componente descartável de cada tela.
Ela deve permanecer visualmente a mesma entidade durante abertura, conversa, modo
Presença, split, Mesa, Ateliê, Estúdio e futuras superfícies da Pulso.

## Invariantes visuais

- Uma única instância visual persistente atravessa os estados da interface.
- Mudanças de posição e escala são interpoladas; a orbe nunca desaparece em um
  lugar para reaparecer em outro.
- O corpo da orbe é transparente: apenas a membrana branca e sua luz são opacas.
- Qualquer separação do conteúdo sob a orbe usa somente blur gaussiano, sombra
  difusa e escurecimento radial suave, sem disco, recorte ou borda circular visível.
- A abertura nasce de blur e foco, permanece no centro por dois segundos com
  duas respirações curtas, acomoda sua dimensão ainda parada e só então se
  desloca até a posição de repouso da interface real. O último quadro da
  acomodação e o primeiro quadro da viagem devem ter escala, luz e textura
  idênticas, separados por uma microfase estável de raccord. A pausa é viva,
  não um congelamento.
- O nascimento começa em escala e opacidade zero. Blur, luz, escala, opacidade,
  deslocamento e dissipação usam uma curva simétrica `ease-in-out` declarada no
  CSS; não há saltos de keyframe, curvas abruptas ou troca de instância entre
  fallback, autenticação e interface.
- O movimento em repouso continua sutil e orgânico, sem competir com o conteúdo.
- `prefers-reduced-motion` reduz a abertura e todas as travessias a transições
  praticamente instantâneas.

## Invariantes de implementação

- A instância persistente vive em uma camada fixa acima das superfícies.
- Cada composição fornece apenas uma âncora/destino; não monta outra orbe local.
- Escala e deslocamento são fases independentes na abertura: a orbe termina a
  acomodação dimensional, pinta um estado estável de raccord e só então inicia
  a mudança de posição.
- Transições entre destinos usam a mesma curva `ease-in-out` do sistema,
  centralizada no CSS.
- Arraste em split move a própria instância e desativa interpolação apenas durante
  o gesto; ao encerrar, a continuidade volta a ser aplicada.
- Novos modos e painéis devem declarar para onde a presença se desloca antes de
  serem considerados acabados.

## Verificação mínima para mudanças futuras

1. Abrir `/pulso/live` em desktop e mobile e observar nascimento + acomodação.
2. Entrar e sair do modo Presença sem salto ou remontagem.
3. Abrir e fechar split e Mesa, verificando a trajetória contínua.
4. Confirmar que texto/conteúdo continua perceptível sob o halo, sem círculo preto.
5. Testar `prefers-reduced-motion`.
