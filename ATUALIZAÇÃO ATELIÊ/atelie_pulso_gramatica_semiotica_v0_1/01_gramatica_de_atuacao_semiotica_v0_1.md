# Ateliê PULSO — Gramática de Atuação Semiótica v0.1

## Princípio

O Ateliê não deve ser tratado como editor de efeitos. Ele é um campo de relações semióticas.

Cada elemento carrega uma assinatura. Quando se aproxima de um som, imagem ou outro elemento, ele influencia o corpo encontrado.

```text
elemento + alvo = modulação
elemento + elemento = composto
composto + alvo = atuação híbrida
```

## Tipos de corpo

- `som`: corpo sonoro ativo, como pulso, sopro, grave seco, fricção, ruído fino.
- `imagem`: corpo visual carregado pelo usuário.
- `elemento`: matéria, atributo, emoção, temperamento, força, relação, encarnação.
- `composto`: assinatura temporária nascida da proximidade entre elementos.

## Proximidade

Sugestão de pesos:

| Distância | Peso |
|---|---:|
| sobreposição | 1.00 |
| muito próximo | 0.70 |
| próximo | 0.40 |
| campo amplo | 0.15 |
| fora do campo | 0.00 |

## Dominância

Quando vários elementos influenciam o mesmo alvo, calcular:

1. elemento dominante;
2. elementos modificadores;
3. resíduo de campo.

Exemplo:

```text
som + colérico + áspero + vermelho
```

Não deve virar três efeitos separados. Deve virar uma assinatura composta:

```text
atrito agressivo, quente, seco e saturado
```

## Tipos de combinação entre elementos

| Tipo | Definição |
|---|---|
| amplificação | elementos reforçam a mesma direção |
| contraste | elementos puxam sentidos opostos |
| contaminação | um colore o outro sem anulá-lo |
| fusão | nasce uma terceira qualidade estável |
| instabilidade | surge tremor, ruído, oscilação ou conflito |

Exemplos:

| Combinação | Composto |
|---|---|
| alegria + luminoso | expansão radiante |
| alegria + sombrio | brilho ferido |
| melancólico + etéreo | saudade fantasmática |
| colérico + denso | pressão explosiva |
| medo + translúcido | presença instável e vulnerável |
| sagrado + bruto | rito arcaico |
| erótico + frio | desejo distante |
| infantil + ruína | memória quebrada |

## Incidência visual

A atuação na imagem pode ser:

- `local`: onde o elemento toca ou orbita a imagem;
- `radial`: em torno do ponto de influência;
- `global`: quando domina a imagem inteira.

Vocabulário visual autorizado:

```text
glitch, pixel sort, dithering, halftone, ASCII, threshold, edge detection,
contour, scanline, VHS, aberração cromática, point cloud, depth map,
rasterização, deslocamento horizontal, deslocamento radial, ghost trail,
blur direcional, ruído fino, ruído grosso, fragmentação, máscara,
dissolução de borda, compressão de escala, expansão de campo
```

## Incidência sonora

Vocabulário sonoro:

```text
pitch, volume, ataque, decay, sustain, release, filtro, ressonância,
distorção, granulação, delay, feedback, vibrato, tremolo, jitter,
ruído, espacialidade, silêncio, compressão, pulso, respiração
```

## Emoções

As subemoções não devem herdar integralmente a emoção-mãe.

Exemplo:

| Subemoção | Desvio próprio |
|---|---|
| euforia | expansão acelerada e instável |
| satisfação | estabilidade quente e repousada |
| serenidade | abertura lenta e sem tensão |
| êxtase | saturação luminosa quase excessiva |
| gratidão | brilho interno, suave e descendente |

## Ordem de cálculo sugerida

1. detectar corpos no canvas;
2. detectar proximidade entre elementos;
3. formar compostos temporários;
4. detectar alvos afetados;
5. definir dominante, modificadores e resíduo;
6. aplicar atuação sonora ou visual;
7. suavizar transições;
8. preservar a assinatura original do alvo.
