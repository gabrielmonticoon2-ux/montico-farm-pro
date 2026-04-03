// Funções puras utilitárias — sem dependências de React ou estado

/**
 * Formata uma string ISO para data no padrão DD/MM/AAAA.
 * @param {string} iso
 * @returns {string}
 */
export function formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

/**
 * Retorna "MM/AAAA" de uma string ISO, útil para agrupar por mês.
 * @param {string} iso
 * @returns {string}
 */
export function mesAno(iso) {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * Parseia um número de uma string aceita vírgula ou ponto como decimal.
 * Retorna NaN se inválido.
 * @param {string} str
 * @returns {number}
 */
export function parseDecimal(str) {
  return parseFloat((str ?? '').replace(',', '.'));
}

/**
 * Normaliza e valida NPK no formato "N/P/K".
 * Aceita separadores / ou -.
 * @param {string} str
 * @returns {{ ok: boolean, npk: string, erro?: string }}
 */
export function normalizarNpk(str) {
  const partes = str.trim().split(/[\/\-]/).map(p => p.trim());
  if (partes.length !== 3) {
    return { ok: false, npk: '', erro: 'NPK deve estar no formato N/P/K. Ex: 4/14/0' };
  }
  for (const p of partes) {
    if (isNaN(Number(p))) {
      return { ok: false, npk: '', erro: `"${p}" não é um número válido no NPK.` };
    }
  }
  return { ok: true, npk: partes.join('/') };
}

/**
 * Calcula dose de produto por tanque.
 * @param {number} doseHa - dose em L ou kg por hectare
 * @param {number} volCalda - volume de calda em L/ha
 * @param {number} volTanque - volume do tanque em L
 * @returns {number} dose por tanque, arredondada a 2 casas
 */
export function calcularDosePorTanque(doseHa, volCalda, volTanque) {
  if (!doseHa || !volCalda || !volTanque) return 0;
  return Math.round((doseHa / volCalda) * volTanque * 100) / 100;
}

/**
 * Calcula número de tanques para cobrir uma área.
 * @param {number} areaHa
 * @param {number} volCalda - L/ha
 * @param {number} volTanque - L
 * @returns {number} arredondado a 1 casa decimal
 */
export function calcularNumTanques(areaHa, volCalda, volTanque) {
  if (!areaHa || !volCalda || !volTanque) return 0;
  return Math.round((areaHa * volCalda) / volTanque * 10) / 10;
}

/**
 * Converte valor entre unidades de massa/volume comuns.
 * Suportado: kg↔t, L (sem conversão entre massa e volume).
 * @param {number} valor
 * @param {string} de - unidade de origem
 * @param {string} para - unidade destino
 * @returns {number|null} null se conversão não suportada
 */
export function converterUnidade(valor, de, para) {
  if (de === para) return valor;
  if (de === 'kg' && para === 't') return valor / 1000;
  if (de === 't' && para === 'kg') return valor * 1000;
  if (de === 'sc' && para === 'kg') return valor * 60; // saca padrão 60 kg
  if (de === 'kg' && para === 'sc') return valor / 60;
  return null;
}

/**
 * Verifica se um item de estoque está abaixo do mínimo configurado.
 * @param {{ quantidade: number, estoqueMinimo?: number }} item
 * @returns {boolean}
 */
export function abaixoDoMinimo(item) {
  return (
    item.estoqueMinimo != null &&
    item.estoqueMinimo > 0 &&
    (item.quantidade || 0) < item.estoqueMinimo
  );
}

/**
 * Parseia quantidade aceitando ponto de milhar e vírgula como decimal.
 * Ex: "1.500,5" → 1500.5
 * @param {string|number} valor
 * @returns {number}
 */
export function parseQuantidade(valor) {
  return parseFloat(String(valor).replace(/\./g, '').replace(',', '.'));
}

/**
 * Calcula valor total de um item de estoque.
 * @param {{ quantidade: number, custoPorUnidade?: number }} item
 * @returns {number|null}
 */
export function valorTotalItem(item) {
  if (!item.custoPorUnidade || !item.quantidade) return null;
  return Math.round(item.custoPorUnidade * item.quantidade * 100) / 100;
}

/**
 * Formata valor em reais.
 * @param {number} valor
 * @returns {string} ex: "R$ 1.234,56"
 */
export function formatarReais(valor) {
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
