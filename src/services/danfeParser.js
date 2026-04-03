/**
 * Parser de texto extraído de DANFE / Nota Fiscal.
 * Identifica produtos, quantidades, unidades e tipo sugerido.
 */

import { parseQuantidade } from '../utils';

// Padrões de unidade reconhecidos
const UNIDADES_VALIDAS = ['KG', 'L', 'LT', 'SC', 'BAG', 'T', 'UN', 'CX', 'FR'];

// Padrões NPK detectam adubos: números separados por / ou -
const REGEX_NPK = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/;

// Palavras-chave que sugerem líquidos (defensivos)
const PALAVRAS_LIQUIDO = [
  'herbicida', 'fungicida', 'inseticida', 'adjuvante', 'foliar',
  'roundup', 'glifosato', 'atrazina', 'azoxistrobina', 'lambda',
  'óleo', 'espalhante', 'surfactante',
];

// Palavras-chave que sugerem sementes
const PALAVRAS_SEMENTE = [
  'semente', 'soja', 'milho', 'trigo', 'feijão', 'feijao',
  'híbrido', 'hibrido', 'cultivar', 'variedade',
];

// Palavras-chave que sugerem adubos
const PALAVRAS_ADUBO = [
  'adubo', 'fertilizante', 'ureia', 'uréia', 'superfosfato',
  'cloreto', 'sulfato', 'calcário', 'calcario', 'npk', 'map', 'dap',
];

/**
 * Detecta o tipo sugerido com base no nome e contexto.
 * @param {string} nome
 * @param {string} contexto - linhas ao redor do produto
 * @returns {'adubo'|'liquido'|'semente'|'desconhecido'}
 */
function detectarTipo(nome, contexto) {
  const texto = (nome + ' ' + contexto).toLowerCase();

  if (REGEX_NPK.test(nome)) return 'adubo';

  for (const p of PALAVRAS_ADUBO) {
    if (texto.includes(p)) return 'adubo';
  }
  for (const p of PALAVRAS_SEMENTE) {
    if (texto.includes(p)) return 'semente';
  }
  for (const p of PALAVRAS_LIQUIDO) {
    if (texto.includes(p)) return 'liquido';
  }
  return 'desconhecido';
}

/**
 * Normaliza unidade para o padrão do app.
 * @param {string} unidade
 * @returns {string}
 */
function normalizarUnidade(unidade) {
  const u = unidade.toUpperCase();
  if (u === 'LT') return 'L';
  if (u === 'UN' || u === 'CX' || u === 'FR') return 'un';
  return u.toLowerCase() === u ? u : u.charAt(0) + u.slice(1).toLowerCase();
}

/**
 * Parseia o texto extraído de uma nota fiscal ou DANFE.
 * Retorna lista de produtos identificados.
 *
 * @param {string} texto - texto bruto extraído por OCR
 * @returns {Array<{ nome: string, quantidade: number, unidade: string, tipoSugerido: string }>}
 */
export function parsearProdutos(texto) {
  if (!texto || !texto.trim()) return [];

  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
  const produtos = [];

  // Regex: captura número (com . ou , como separador) seguido de unidade conhecida
  const REGEX_QTD_UNIDADE = new RegExp(
    `(\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d+)?)\\s*(${UNIDADES_VALIDAS.join('|')})\\b`,
    'gi'
  );

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const matches = [...linha.matchAll(REGEX_QTD_UNIDADE)];

    for (const match of matches) {
      const quantidade = parseQuantidade(match[1]);
      if (isNaN(quantidade) || quantidade <= 0) continue;

      const unidade = normalizarUnidade(match[2]);

      // Tenta encontrar o nome do produto nas linhas anteriores/posteriores
      const contexto = [
        linhas[i - 2] || '',
        linhas[i - 1] || '',
        linha,
        linhas[i + 1] || '',
      ].join(' ');

      // Remove números e unidades para extrair o nome candidato
      const nomeCandidato = (linhas[i - 1] || linha)
        .replace(REGEX_QTD_UNIDADE, '')
        .replace(/\d+[.,]?\d*/g, '')
        .replace(/[^a-zA-ZÀ-ú\s\/\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const nome = nomeCandidato.length > 3 ? nomeCandidato : linha
        .replace(REGEX_QTD_UNIDADE, '')
        .replace(/\d+/g, '')
        .trim() || 'Produto';

      const tipoSugerido = detectarTipo(nome, contexto);

      produtos.push({
        nome: nome.slice(0, 60),
        quantidade,
        unidade,
        tipoSugerido,
      });
    }
  }

  // Remove duplicatas óbvias (mesmo nome e quantidade)
  const vistos = new Set();
  return produtos.filter(p => {
    const chave = `${p.nome}_${p.quantidade}_${p.unidade}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}
