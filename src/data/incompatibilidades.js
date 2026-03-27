// Funções de cálculo — dados estáticos vivem em incompatibilidades.json
import BASE from './incompatibilidades.json';

// Re-exporta as constantes direto do JSON para quem precisar
export const VERSAO_BASE = BASE.versao;
export const ULTIMA_ATUALIZACAO = BASE.ultimaAtualizacao;
export const CATEGORIAS_INFO = BASE.categorias;
export const ORDEM_FORMULACAO = BASE.ordemFormulacao;
export const REGRAS_INCOMPATIBILIDADE = BASE.regrasCategorias;
export const INCOMPATIBILIDADES_PRODUTO = BASE.regrasProdutos;
export const PH_CATEGORIAS = BASE.phCategorias;
export const PH_PRODUTO = BASE.phProdutos;
export const PRODUTOS_CONHECIDOS = BASE.produtos;

/**
 * Retorna metadados de um produto pelo nome (busca parcial, case-insensitive).
 * Útil para exibir carência, classe toxicológica e modo de ação na UI.
 * @param {string} nome
 * @returns {object|null}
 */
export function buscarMetadadosProduto(nome) {
  const nomeMin = nome.toLowerCase();
  return (
    BASE.produtos.find(
      p =>
        nomeMin.includes(p.nomeComercial.toLowerCase()) ||
        nomeMin.includes(p.principioAtivo.toLowerCase())
    ) ?? null
  );
}

/**
 * Calcula o pH ideal da calda para uma lista de produtos selecionados.
 * Prioriza regras por nome; cai para regra de categoria se não houver match.
 * @param {Array<{nome: string, categoria: string}>} produtosSelecionados
 * @returns {{ min: number, max: number, ideal: number, obs: string[] }}
 */
export function calcularPhIdeal(produtosSelecionados) {
  let minPh = 4.0;
  let maxPh = 7.5;
  const obs = [];

  for (const prod of produtosSelecionados) {
    const nomeMin = prod.nome.toLowerCase();

    // 1. Regra específica por nome de produto
    const regraNome = PH_PRODUTO.find(r => nomeMin.includes(r.nome.toLowerCase()));
    if (regraNome) {
      minPh = Math.max(minPh, regraNome.min);
      maxPh = Math.min(maxPh, regraNome.max);
      obs.push(regraNome.obs);
      continue;
    }

    // 2. Metadados do produto conhecido
    const meta = buscarMetadadosProduto(prod.nome);
    if (meta) {
      minPh = Math.max(minPh, meta.phMin);
      maxPh = Math.min(maxPh, meta.phMax);
      continue;
    }

    // 3. Fallback: regra de categoria
    const catRegra = PH_CATEGORIAS[prod.categoria];
    if (catRegra) {
      minPh = Math.max(minPh, catRegra.min);
      maxPh = Math.min(maxPh, catRegra.max);
    }
  }

  // Evitar intervalo negativo caso haja restrições conflitantes
  const maxFinal = maxPh > minPh ? maxPh : minPh + 0.5;
  const ideal = Math.round(((minPh + maxFinal) / 2) * 10) / 10;

  return {
    min: minPh,
    max: maxFinal,
    ideal,
    obs: [...new Set(obs)],
  };
}

/**
 * Verifica incompatibilidades entre os produtos selecionados.
 * Checa regras por categoria e por nome de produto.
 * @param {Array<{nome: string, categoria: string}>} produtosSelecionados
 * @returns {Array<{nivel: string, mensagem: string}>}
 */
export function verificarIncompatibilidades(produtosSelecionados) {
  const avisos = [];
  const categoriasUsadas = [...new Set(produtosSelecionados.map(p => p.categoria))];

  // Regras entre categorias
  for (const regra of REGRAS_INCOMPATIBILIDADE) {
    const [c1, c2] = regra.categorias;
    if (c1 === c2) {
      const count = produtosSelecionados.filter(p => p.categoria === c1).length;
      if (count >= 2) {
        avisos.push({ nivel: regra.nivel, mensagem: regra.mensagem });
      }
    } else if (categoriasUsadas.includes(c1) && categoriasUsadas.includes(c2)) {
      avisos.push({ nivel: regra.nivel, mensagem: regra.mensagem });
    }
  }

  // Regras por nome de produto
  for (const regra of INCOMPATIBILIDADES_PRODUTO) {
    const produtosNaRegra = produtosSelecionados.filter(p =>
      regra.produtos.some(r => p.nome.toLowerCase().includes(r.toLowerCase()))
    );
    if (produtosNaRegra.length === 0) continue;

    const incompativeisSelecionados = produtosSelecionados.filter(p =>
      regra.incompativel_com.some(
        r => r === 'qualquer' || p.nome.toLowerCase().includes(r.toLowerCase())
      )
    );

    if (incompativeisSelecionados.length > 0) {
      const nomes = [...produtosNaRegra, ...incompativeisSelecionados]
        .map(p => p.nome)
        .join(' + ');
      avisos.push({
        nivel: regra.nivel,
        mensagem: `[${nomes}]: ${regra.mensagem}`,
      });
    }
  }

  return avisos;
}

/**
 * Calcula a ordem recomendada de adição dos produtos no tanque do pulverizador.
 * @param {Array<{nome: string, categoria: string}>} produtosSelecionados
 * @returns {Array<{passo: number, acao: string, produto?: object}>}
 */
export function calcularOrdemMistura(produtosSelecionados) {
  const ORDEM_CATEGORIA = {
    fungicidas:  2,
    foliares:    2,
    inseticidas: 3,
    herbicidas:  3,
    adjuvantes:  5,
  };

  const DESCRICAO_CATEGORIA = {
    fungicidas:  'pó / suspensão — adicione cedo',
    foliares:    'pó / suspensão — adicione cedo',
    inseticidas: 'líquido / emulsão — adicione após pós e suspensões',
    herbicidas:  'líquido / emulsão — adicione após pós e suspensões',
    adjuvantes:  'adjuvante — adicione por último',
  };

  const ordenados = [...produtosSelecionados]
    .map(p => ({ ...p, ordem: ORDEM_CATEGORIA[p.categoria] ?? 3 }))
    .sort((a, b) => a.ordem - b.ordem);

  const instrucoes = [
    { passo: 1, acao: 'Encha o tanque com metade da água necessária' },
    { passo: 2, acao: 'Ligue o agitador' },
  ];

  let passo = 3;
  for (const prod of ordenados) {
    const desc = DESCRICAO_CATEGORIA[prod.categoria] ?? 'adicione com agitação';
    instrucoes.push({
      passo,
      acao: `Adicione: ${prod.nome} (${desc})`,
      produto: prod,
    });
    passo++;
  }

  instrucoes.push({
    passo,
    acao: 'Complete com o restante da água e mantenha agitação constante durante toda a aplicação',
  });

  return instrucoes;
}
