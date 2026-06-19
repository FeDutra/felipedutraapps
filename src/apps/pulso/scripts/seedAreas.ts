import { Area } from '../types/pulso.types';

/**
 * seedAreas.ts
 * Arquivo de dry-run para sugerir a criação das 11 áreas da vida como Sessões da PULSO.
 * Este script NÃO será executado automaticamente. 
 * Serve como base para ingestão no Firestore quando aprovado.
 */

export const candidateAreas: Partial<Area>[] = [
  {
    id: 'area_casa_jardim',
    name: 'Casa / Jardim / Obra',
    slug: 'casa-jardim-obra',
    type: 'infrastructure',
    status: 'active',
    priority: 'high',
    aliases: ['casa', 'jardim', 'obra', 'deck', 'reforma', 'construção'],
    keywords: ['cimento', 'tinta', 'pedreiro', 'plantas', 'grama', 'telhado', 'manutenção'],
    contextHints: ['A obra do deck está em andamento', 'Casa principal e anexo'],
    visibility: 'private'
  },
  {
    id: 'area_familia',
    name: 'Família',
    slug: 'familia',
    type: 'family',
    status: 'active',
    priority: 'critical',
    aliases: ['família', 'meninas', 'esposa', 'filhas'],
    keywords: ['escola', 'médico', 'viagem em família', 'passeio'],
    contextHints: ['Prioridade máxima na agenda'],
    visibility: 'private'
  },
  {
    id: 'area_vida_rotina',
    name: 'Vida e rotina',
    slug: 'vida-e-rotina',
    type: 'personal',
    status: 'active',
    priority: 'medium',
    aliases: ['vida', 'rotina', 'dia a dia', 'tarefas diárias'],
    keywords: ['mercado', 'compras', 'limpeza', 'organização'],
    contextHints: ['Manutenção básica da máquina da vida'],
    visibility: 'private'
  },
  {
    id: 'area_saude',
    name: 'Saúde',
    slug: 'saude',
    type: 'health',
    status: 'active',
    priority: 'high',
    aliases: ['saúde', 'médico', 'exames', 'treino'],
    keywords: ['pressão', 'tireoide', 'sangue', 'consulta', 'academia', 'dieta'],
    contextHints: ['Acompanhamento contínuo de tireoide e pressão'],
    visibility: 'private'
  },
  {
    id: 'area_financeiro_familiar',
    name: 'Financeiro familiar',
    slug: 'financeiro-familiar',
    type: 'financial',
    status: 'active',
    priority: 'high',
    aliases: ['financeiro', 'dinheiro', 'contas', 'pagamentos'],
    keywords: ['boleto', 'transferência', 'banco', 'imposto', 'fatura'],
    contextHints: ['Gestão de caixa da família'],
    visibility: 'private'
  },
  {
    id: 'area_modu',
    name: 'MODÚ',
    slug: 'modu',
    type: 'business',
    status: 'active',
    priority: 'high',
    aliases: ['modú', 'empresa', 'negócio'],
    keywords: ['cliente', 'reunião', 'proposta', 'contrato', 'sócio'],
    contextHints: ['Negócio principal'],
    visibility: 'shared'
  },
  {
    id: 'area_despertar',
    name: 'Despertar',
    slug: 'despertar',
    type: 'personal',
    status: 'active',
    priority: 'medium',
    aliases: ['espiritualidade', 'meditação', 'despertar'],
    keywords: ['reflexão', 'insight', 'silêncio', 'prática'],
    contextHints: ['Evolução pessoal e consciência'],
    visibility: 'private'
  },
  {
    id: 'area_projetos_autorais',
    name: 'Projetos autorais',
    slug: 'projetos-autorais',
    type: 'creative',
    status: 'active',
    priority: 'medium',
    aliases: ['projetos', 'autoral', 'criação', 'escrita'],
    keywords: ['ideia', 'livro', 'artigo', 'rascunho'],
    contextHints: ['Projetos fora do escopo corporativo'],
    visibility: 'private'
  },
  {
    id: 'area_pulso_ia',
    name: 'PULSO / IA / Tecnologia',
    slug: 'pulso-ia-tecnologia',
    type: 'hybrid',
    status: 'active',
    priority: 'critical',
    aliases: ['pulso', 'ia', 'lótus', 'openclaw', 'tecnologia', 'sistema'],
    keywords: ['código', 'bug', 'deploy', 'firestore', 'prompt', 'motor', 'agente'],
    contextHints: ['Desenvolvimento da própria interface e infraestrutura de IA'],
    visibility: 'private'
  },
  {
    id: 'area_relacoes',
    name: 'Relações / Pessoas',
    slug: 'relacoes-pessoas',
    type: 'personal',
    status: 'active',
    priority: 'medium',
    aliases: ['relações', 'pessoas', 'networking', 'amigos'],
    keywords: ['encontro', 'aniversário', 'conversa', 'contato'],
    contextHints: ['Gestão de relacionamentos e CRM pessoal'],
    visibility: 'private'
  },
  {
    id: 'area_arca',
    name: 'Pesquisa viva / ARCA',
    slug: 'pesquisa-viva-arca',
    type: 'creative',
    status: 'active',
    priority: 'medium',
    aliases: ['pesquisa', 'arca', 'referências', 'estudos'],
    keywords: ['link', 'artigo', 'vídeo', 'curso', 'aprender', 'salvar'],
    contextHints: ['Base de conhecimento e referências acumuladas'],
    visibility: 'private'
  }
];

export const dryRunSeed = () => {
  console.log("Dry run das áreas candidatas para a PULSO:");
  candidateAreas.forEach(area => {
    console.log(`- [${area.type}] ${area.name}`);
    console.log(`  Aliases: ${area.aliases?.join(', ')}`);
    console.log(`  Keywords: ${area.keywords?.join(', ')}\n`);
  });
};
