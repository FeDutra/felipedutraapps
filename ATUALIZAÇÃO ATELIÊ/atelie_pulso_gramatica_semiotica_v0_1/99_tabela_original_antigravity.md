# Tabela Geral de Atuação: Ateliê (Som & Imagem)

Este arquivo descreve a totalidade das matérias, elementos, texturas, temperamentos, atributos, forças, relações, encarnações e emoções (incluindo todas as 80 sub-emoções) do Ateliê, mapeando em detalhes como cada um atua no motor de áudio e no processamento visual da imagem.

---

## 1. Matérias (Cores)

As cores agem adicionando overlays cromáticos e temperando o comportamento sonoro de acordo com o calor ou frieza conceitual.

| Matéria (Cor) | Cor Hex | Atuação no Som | Atuação na Imagem |
| :--- | :--- | :--- | :--- |
| **vermelho** | `#ef4444` | Aquece o timbre; baixa pitch base, abre filtro passa-baixa (Warmth: 0.8). Adiciona distorção harmônica e volume (Anger: 0.4). | Overlay vermelho saturação máxima; aquece tonalidades; gera pixelização dura (Anger). |
| **vinho** | `#781a1a` | Aquece sutilmente (Warmth: 0.5); desativa brilho e rarefaz/desacelera volume (Sadness: 0.3). | Overlay vinho (vermelho + azul); desatura e escurece a imagem (Sadness). |
| **ferrugem** | `#b45309` | Aquece filtro (Warmth: 0.4); adiciona distorção granulada/áspera (Roughness: 0.6). | Overlay vermelho/ouro; adiciona ruído/grão áspero (trama). |
| **rosa** | `#ec4899` | Abre filtro e vibrato alegre (Joy: 0.5); suaviza e remove distorções (Softness: 0.7). | Overlay rosa; aumenta brilho e contraste; suaviza bordas com blur leve. |
| **âmbar** | `#f59e0b` | Aquece timbre (Warmth: 0.6); abre filtro e adiciona brilho (Joy: 0.4). | Overlay âmbar; aquece cores; aumenta contraste/brilho. |
| **dourado** | `#fbbf24` | Aquece timbre (Warmth: 0.7); sobe pitch base e abre filtro (Joy: 0.6). | Overlay dourado brilhante; contraste e luminosidade elevados. |
| **azul** | `#3b82f6` | Esfria timbre, eleva pitch, fecha filtro (Coldness: 0.8); rarefaz/desacelera (Sadness: 0.5). | Overlay azul; dessatura tons quentes, esfria temperatura; escurece. |
| **verde** | `#10b981` | Abre filtro passa-baixa levemente, vibrato alegre (Joy: 0.3). | Overlay verde (azul + ouro); contraste equilibrado e alegre. |
| **preto** | `#000000` | Baixa freq base (Density: 0.8); desacelera e fecha filtro (Sadness: 0.6); eleva pitch secundário (Coldness: 0.3). | Comprime escala física do nó; escurece intensamente; dessatura. |
| **branco** | `#ffffff` | Reduz fator Q do filtro (Transparency: 0.8); vibrato alegre e aberto (Joy: 0.5); eleva pitch secundário (Coldness: 0.2). | Reduz opacidade global (translucidez); aumenta brilho e contraste. |
| **cinza** | `#6b7280` | Eleva pitch (Coldness: 0.4); fecha filtro e rarefaz volume (Sadness: 0.4). | Esfria a imagem; dessatura; escurece (cinza opaco). |
| **violeta** | `#8b5cf6` | Adiciona delay com feedback longo e espacial (Etereo: 0.7). | Overlay violeta; ativa dissolução/campo (radial blur). |
| **esmeralda** | `#10b981` | Vibrato aberto e alegre (Joy: 0.5). | Overlay verde esmeralda; contraste elevado. |
| **turquesa** | `#06b6d4` | Eleva pitch secundário (Coldness: 0.5). | Overlay turquesa; esfria a cor geral. |
| **cobre** | `#ca8a04` | Aquece timbre (Warmth: 0.5); adiciona granulado (Roughness: 0.4). | Overlay acobreado; adiciona granulado sutil (trama). |
| **prata** | `#cbd5e1` | Eleva pitch (Coldness: 0.6); reduz Q do filtro (Transparency: 0.5). | Tonalidade metálica fria; reduz opacidade. |
| **bronze** | `#b45309` | Adiciona distorção granulada média (Roughness: 0.5). | Overlay bronze; textura áspera visível (trama). |
| **ocre** | `#d97706` | Baixa freq base, aumenta grave (Density: 0.4). | Overlay ocre terroso; comprime escala física do nó. |
| **mostarda** | `#eab308` | Aquece o timbre do filtro (Warmth: 0.4). | Overlay dourado mostarda; aquece tom. |
| **índigo** | `#4f46e5` | Rarefaz e desacelera volume (Sadness: 0.4). | Overlay azul índigo; desatura e escurece. |
| **carvão** | `#1f2937` | Baixa freq base (Density: 0.9); distorção áspera (Roughness: 0.7). | Escurece intensamente; adiciona granulado áspero (trama). |

---

## 2. Elementos

Os quatro elementos clássicos estabelecem os estados fundamentais do campo de forças e som.

| Elemento | Atuação no Som | Atuação na Imagem |
| :--- | :--- | :--- |
| **água** | Eleva pitch secundário (Coldness: 0.6); fecha filtro e suaviza (Softness: 0.8). | Overlay azul; esfria a cor; suaviza bordas com desfoque leve. |
| **fogo** | Baixa pitch base, abre filtro (Warmth: 1.0); aumenta volume/amplitude (Expansion: 0.6). | Overlay vermelho; aquece cor; aumenta escala física do nó. |
| **ar** | Delay com feedback longo e espacial (Etereo: 0.9); volume sobe (Expansion: 0.7); reduz Q do filtro (Transparency: 0.8). | Ativa dissolução/névoa radial; reduz opacidade; aumenta escala física. |
| **terra** | Baixa frequência base, aumenta volume do grave (Density: 1.0); distorção granulada (Roughness: 0.6). | Comprime escala física do nó; escurece; adiciona granulado denso. |

---

## 3. Natureza

Elementos da natureza que adicionam texturas, espaços ou dinâmicas materiais.

| Item da Natureza | Atuação no Som | Atuação na Imagem |
| :--- | :--- | :--- |
| **pedra** | Baixa freq base, aumenta grave (Density: 0.9); distorção áspera (Roughness: 0.8). | Comprime escala física; adiciona granulado trama forte. |
| **barro** | Baixa freq base (Density: 0.7); aquece sutilmente (Warmth: 0.2). | Comprime escala física; aquece sutilmente o tom de cor. |
| **fumaça** | Delay com feedback longo (Etereo: 0.8); aumenta volume (Expansion: 0.5). | Dissolve bordas externas; aumenta escala física. |
| **planta** | Vibrato alegre (Joy: 0.4); suaviza filtro (Softness: 0.5). | Aumenta contraste levemente; suaviza bordas da imagem. |
| **metal** | Baixa freq base (Density: 0.9); eleva pitch secundário (Coldness: 0.6). | Comprime escala física; esfria tom cromático. |
| **névoa** | Delay longo (Etereo: 0.9); eleva pitch (Coldness: 0.4); reduz Q do filtro (Transparency: 0.6). | Ativa desfoque radial (blur); reduz opacidade global; esfria. |
| **poeira** | Distorção granulada sutil (Roughness: 0.5). | Adiciona ruído granulado fino. |
| **sal** | Distorção granulada média (Roughness: 0.7). | Adiciona ruído granulado médio. |
| **sangue** | Aquece tom (Warmth: 0.6); sobe pitch base. | Overlay vermelho vibrante; aquece tom cromático. |
| **ruína** | Rarefaz, baixa freq (Sadness: 0.6); distorção áspera (Roughness: 0.8). | Desatura e escurece; adiciona granulado áspero (trama). |

---

## 4. Sons (Nós Geradores de Áudio)

Estes nós são os corpos geradores de áudio no canvas. Eles **não modulam** outros nós por proximidade, mas **recebem** modulações dos nós ao seu redor.

| Nó de Som | Descrição do Comportamento Sonoro | Atuação na Imagem |
| :--- | :--- | :--- |
| **pulso** | Sintetizador de onda quadrada pulsada a 2.5Hz (LFO). Timbre grave/médio encorpado. | *(Nó gerador de som; sem efeito de modulação direta)* |
| **grave seco** | Oscilador duplo (triangle + sine) com detune sutil (1.009). Som sub-bass firme e saturado. | *(Nó gerador de som; sem efeito de modulação direta)* |
| **sopro** | Ruído branco com filtro passa-faixa modulado por LFO lento (0.2Hz), simulando vento. | *(Nó gerador de som; sem efeito de modulação direta)* |
| **fricção** | Ruído modulador de onda dente de serra (sawtooth) com LFO rápido (30Hz), gerando atrito áspero. | *(Nó gerador de som; sem efeito de modulação direta)* |
| **ruído fino** | Ruído branco de alta frequência filtrado para agudos finos e sibilantes. | *(Nó gerador de som; sem efeito de modulação direta)* |
| **ressonância curta** | Chime ressonante de alta frequência com fator Q de filtro extremamente alto (8.0). | *(Nó gerador de som; sem efeito de modulação direta)* |
| **silêncio ativo** | Onda senoidal pura de frequência sub-grave extremamente baixa (36.7Hz) e volume quase nulo. | *(Nó gerador de som; sem efeito de modulação direta)* |

---

## 5. Texturas

As texturas modificam os contornos e a aspereza do áudio e geram filtros gráficos pontilhados ou de difusão na imagem.

| Textura | Atuação no Som | Atuação na Imagem |
| :--- | :--- | :--- |
| **lisa** | Remove distorções; suaviza filtros passa-baixa (Softness: 1.0). | Suaviza bordas e contornos com blur leve (Softness). |
| **áspera** | Adiciona distorção harmônica e saturação (Roughness: 1.0). | Ativa halftone/dithering pontilhado circular (Roughness). |
| **porosa** | Distorção granulada (Roughness: 0.6); reduz Q do filtro (Transparency: 0.3). | Adiciona granulado trama; reduz levemente opacidade. |
| **fibrosa** | Distorção de grão sutil (Roughness: 0.5). | Adiciona granulado textura fibrosa. |
| **rachada** | Distorção granulada pesada (Roughness: 0.9). | Adiciona granulado de ruído áspero muito forte. |
| **aveludada** | Suaviza filtro (Softness: 0.9); aquece sutilmente (Warmth: 0.3). | Suaviza contorno; aquece tom sutilmente. |
| **granulada** | Distorção granulada média-alta (Roughness: 0.7). | Ativa trama/halftone de dither pontilhado. |
| **úmida** | Suaviza filtro (Softness: 0.5); esfria sutilmente (Coldness: 0.1). | Suaviza contornos; esfria levemente a cor. |
| **seca** | Distorção granulada sutil (Roughness: 0.4). | Granulado sutil e opaco. |
| **enrugada** | Distorção granulada média (Roughness: 0.6). | Granulado trama médio. |
| **estriada** | Distorção granulada sutil (Roughness: 0.4). | Granulado trama leve. |
| **escamosa** | Distorção granulada média-alta (Roughness: 0.7). | Halftone pontilhado médio. |
| **espinhosa** | Distorção granulada pesada (Roughness: 0.9); distorção e volume agressivos (Anger: 0.4). | Trama de alta frequência + glitch de deslocamento horizontal de pixels. |
| **pegajosa** | Baixa freq base (Density: 0.6). | Comprime escala física da imagem. |
| **gelada** | Eleva pitch, fecha filtro/escurece muito (Coldness: 1.0). | Esfria cor (tons azuis marcados); desatura. |
| **cristalina** | Reduz Q do filtro (Transparency: 0.9); eleva pitch secundário (Coldness: 0.4). | Reduz opacidade global (translúcido); esfria cor. |

---

## 6. Temperamentos

Os quatro temperamentos humanos agem como grandes moduladores afetivos do campo.

| Temperamento | Atuação no Som | Atuação na Imagem |
| :--- | :--- | :--- |
| **sanguíneo** | Eleva pitch de vibrato a 6Hz; abre filtro passa-baixa; aumenta volume (Joy/Expansion: 0.5). | Satura fortemente a cor; aumenta contraste/brilho; aumenta escala. |
| **colérico** | Adiciona distorção pesada (distortion: 100); aumenta volume (+0.35) (Anger/Expansion: 0.6). | Satura tons vermelhos; gera glitch de deslocamento de pixels; endurece bordas. |
| **melancólico** | Baixa pitch base; delay longo com feedback pesado (delayFeedback: 0.5) (Sadness/Contraction: 0.6). | Desatura totalmente (preto e branco); escurece; comprime escala física. |
| **fleumático** | Suaviza filtros (Softness: 0.5); cancela distorções e reduz volume sutilmente. | Suaviza imagem com desfoque; reduz tremores e acalma pixels. |

---

## 7. Atributos

Atributos abstratos ou conceituais que modulam as propriedades físicas dos corpos no Ateliê.

| Atributo | Atuação no Som | Atuação na Imagem |
| :--- | :--- | :--- |
| **quente** | Aquece timbre, baixa pitch base, abre filtro (Warmth: 1.0). | Overlay vermelho/quente; aumenta temperatura de cor. |
| **frio** | Esfria timbre, eleva pitch, fecha filtro (Coldness: 1.0). | Overlay azul/frio; desatura; azula. |
| **seco** | Distorção granulada sutil (Roughness: 0.5). | Granulado de ruído leve. |
| **úmido** | Suaviza filtro (Softness: 0.5). | Suaviza contornos (Softness). |
| **áspero** | Adiciona distorção harmônica e saturação (Roughness: 1.0). | Ativa halftone/dithering pontilhado. |
| **liso** | Remove distorção, suaviza filtros (Softness: 1.0). | Suaviza bordas com blur leve. |
| **denso** | Baixa freq base (Density: 1.0), aumenta volume do grave. | Comprime escala global (nó fica menor); escurece tons. |
| **rarefeito** | Delay com feedback alto e longo (Etereo: 1.0). | Dissolve bordas progressivamente (radial blur). |
| **opaco** | Baixa freq base (Density: 0.8). | Comprime escala física sutilmente; escurece. |
| **translúcido** | Reduz Q do filtro (Transparency: 1.0). | Reduz opacidade da imagem, sobrepondo com o fundo. |
| **sagrado** | Delay com feedback muito alto (0.6) e tempo longo (0.55), aumenta volume (0.3). | Limpa ruídos, clareia centro; desenha molduras geométricas concêntricas. |
| **erótico** | Volume pulsa senoidalmente (3.5Hz), fecha filtro levemente. | Aquece cor; aumenta saturação; suaviza contornos. |
| **infantil** | Adiciona vibrato rápido de pitch (15Hz), abre filtro levemente. | Satura cores; aumenta brilho geral. |
| **terroso** | Baixa pitch (Density: 0.7), distorção granulada (Roughness: 0.5). | Comprime escala; adiciona granulado trama. |
| **etéreo** | Delay longo (Etereo: 1.0). | Ativa campo (radial blur nas bordas), dissolve a imagem. |
| **delicado** | Suaviza contornos/filtro (Softness: 0.8). | Suaviza bordas com blur suave. |
| **bruto** | Distorção granulada (Roughness: 0.9), baixa freq e aumenta grave (Density: 0.8). | Comprime escala; adiciona granulado denso. |
| **ritual** | Delay longo, limpa ruídos (Sagrado: 0.8). | Desenha círculos e retângulos concêntricos geométricos translúcidos por cima da imagem. |
| **sombrio** | Rarefaz, desacelera (Sadness: 0.5), baixa pitch base (Density: 0.6). | Desatura; escurece. |
| **luminoso** | Vibrato alegre (Joy: 0.6), reduz Q do filtro (Transparency: 0.5). | Satura cor; clareia; reduz opacidade levemente. |

---

## 8. Forças

As forças impulsionam vetores físicos de deformação, deslocamento e dinâmica energética.

| Força | Atuação no Som | Atuação na Imagem |
| :--- | :--- | :--- |
| **expansão** | Aumenta volume (+0.45); delay feedback aumenta (+0.4). | Propaga expansão de escala se aplicável. |
| **contração** | Volume cai vertiginosamente (-0.85). | Encolhe/comprime a escala física do nó da imagem. |
| **elevação** | Transpõe a frequência base para cima (+0.8). | *Nenhuma atuação direta* |
| **descida** | Transpõe a frequência base para baixo (-0.5). | *Nenhuma atuação direta* |
| **dissolução** | Delay com feedback alto e longo (Etereo: 0.8). | Ativa dissolução/névoa radial progressiva nas bordas. |
| **condensação** | Baixa freq base, aumenta grave (Density: 0.8). | Comprime escala; escurece. |
| **fricção** | Adiciona distorção harmônica e FM jitter (timbre oscila a 30Hz). | Ativa horizontal glitch slicing; endurece bordas da imagem. |
| **fusão** | Suaviza filtro (Softness: 0.5). | Suaviza contorno. |
| **ruptura** | Distorção granulada (Roughness: 0.7); jitter FM (Fricção: 0.5). | Glitch de deslocamento horizontal e granulado trama combinados. |
| **sustentação** | Baixa freq base (Density: 0.6). | Comprime escala física. |
| **germinação** | Vibrato alegre (Joy: 0.4). | Aumenta contraste e brilho. |
| **combustão** | Baixa pitch base (Warmth: 0.8); aumenta volume (Expansion: 0.8). | Aquece o tom (overlay vermelho); aumenta escala física. |

---

## 9. Relações

As relações descrevem a ponte entre múltiplos corpos e como eles dialogam ou ressoam.

| Relação | Atuação no Som | Atuação na Imagem |
| :--- | :--- | :--- |
| **ressonância** | Aumenta fator Q do filtro (+15.0); eleva pitch sutilmente (+0.05). | *Nenhuma atuação direta* |
| **eco** | Delay longo com feedback alto e tempo estendido. | Desenha duplicatas/rastros translúcidos deslocados nas laterais (ghost trails). |
| **afinidade** | Sobe pitch base em 1.5x (quinta justa ou oitava). | *Nenhuma atuação direta* |
| **contraste** | Sobe pitch base em 1.05x (desafinação microtonal sutil). | *Nenhuma atuação direta* |
| **continuidade** | Aumenta feedback do delay (+0.4); aumenta volume (+0.2). | *Nenhuma atuação direta* |
| **atravessamento** | Adiciona distorção harmônica pesada (distortion: 120). | Ativa horizontal glitch slicing forte. |

---

## 10. Encarnações

As encarnações representam o suporte físico ou destino de manifestação da criação.

| Encarnação | Atuação no Som | Atuação na Imagem |
| :--- | :--- | :--- |
| **jardim** | Sobe pitch base (0.9x); abre muito o filtro passa-baixa (mínimo 2500Hz). | *Nenhuma atuação direta* |
| **paisagem visual** | Aumenta tempo do delay (+0.5). | *Nenhuma atuação direta* |
| **ambiência sonora** | Aumenta feedback do delay (+0.5); aumenta volume (+0.25). | *Nenhuma atuação direta* |
| **joia** | Fator Q do filtro sobe a 20.0, abre filtro a 3000Hz (ressonância metálica cristalina). | *Nenhuma atuação direta* |
| **objeto** | Zera/cancela feedback do delay. | *Nenhuma atuação direta* |
| **espaço** | Delay longo (delayTime + 0.85). | *Nenhuma atuação direta* |
| **ritual** | Baixa pitch base (-0.2); fecha filtro (-0.4). | Desenha círculos e retângulos concêntricos geométricos translúcidos por cima da imagem. |
| **direção criativa** | Filtro passa-baixa oscila senoidalmente a 1.5Hz. | *Nenhuma atuação direta* |

---

## 11. Emoções (Famílias e Sub-emoções)

As emoções são divididas em 4 grandes grupos "Mãe" (Alegria, Tristeza, Raiva, Medo). Cada grupo tem um mapeamento ativo no som e na imagem. Cada uma das **80 sub-emoções** listadas abaixo herda integralmente a atuação da respectiva emoção mãe à qual pertence no Ateliê.

| Emoção Mãe | Sub-emoções Pertencentes | Atuação no Som | Atuação na Imagem |
| :--- | :--- | :--- | :--- |
| **alegria** (Joy) | *euforia, entusiasmo, satisfação, otimismo, contentamento, orgulho, alívio, serenidade, fascínio, júbilo, gratidão, ternura, admiração, afeto, esperança, compaixão, vitalidade, brilho, deleite, êxtase* | Sobe o pitch base; abre o filtro passa-baixa; aumenta o volume (+0.25); adiciona vibrato senoidal (8Hz) e brilho. | Aumenta brilho e contraste de forma radiante; satura cores quentes (vermelho/ouro). |
| **tristeza** (Sadness) | *melancolia, desalento, solidão, pesar, angústia, nostalgia, amargura, luto, desânimo, tédio, desamparo, apatia, frustração, abandono, rejeição, culpa, piedade, mágoa, arrependimento, vazio* | Baixa o pitch base; fecha o filtro passa-baixa (escurece); diminui o volume geral; aumenta o feedback do delay (espacialidade profunda). | Dessaturação progressiva (preto e branco); escurecimento geral; blur suave de contorno/ radial. |
| **raiva** (Anger) | *fúria, ira, indignação, irritação, ressentimento, desprezo, hostilidade, aversão, ciúme, inveja, ódio, impaciência, rancor, agressividade, tensão, repulsa, despeito, revolta, fricção interna, indignado* | Adiciona distorção harmônica pesada; aumenta volume geral; abre o filtro passa-baixa. | Glitch horizontal de fatias de pixels (deslocamento); saturação cromática de tons vermelhos; endurecimento/secamento de bordas. |
| **medo** (Fear) | *pânico, terror, ansiedade, pavor, apreensão, desconfiança, insegurança, fobia, aflição, paralisia, susto, nervosismo, vulnerabilidade, sombra, receio, hesitação, timidez, desassossego, inquietude, pavoroso* | Eleva o pitch base; aumenta muito o fator Q do filtro (ressonância metálica fina); adiciona jitter de frequência rápido (40Hz); diminui volume. | Tremor físico do nó no canvas; deslocamento trêmulo e caótico de pixels individuais. |
