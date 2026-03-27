import { useMemo } from 'react';
import { useStorage } from '../storage/StorageContext';
import { abaixoDoMinimo, valorTotalItem } from '../utils';
import { CATEGORIAS_LIQUIDOS } from '../constants';

/**
 * Hook para consumir e derivar dados do estoque.
 * Encapsula lógica de alertas, totais e achatamento de produtos.
 */
export function useEstoque() {
  const storage = useStorage();
  const { adubos, liquidos } = storage;

  // Lista achatada de todos os produtos líquidos com metadados de categoria
  const todosProdutosLiquidos = useMemo(() => {
    const lista = [];
    for (const cat of CATEGORIAS_LIQUIDOS) {
      for (const p of liquidos[cat.key] || []) {
        lista.push({
          ...p,
          categoria: cat.key,
          categoriaLabel: cat.label,
          cor: cat.cor,
          uid: `${cat.key}_${p.id}`,
        });
      }
    }
    return lista;
  }, [liquidos]);

  // Produtos com estoque abaixo do mínimo
  const alertasAdubos = useMemo(
    () => adubos.filter(abaixoDoMinimo),
    [adubos]
  );

  const alertasLiquidos = useMemo(
    () => todosProdutosLiquidos.filter(abaixoDoMinimo),
    [todosProdutosLiquidos]
  );

  const totalAlertas = alertasAdubos.length + alertasLiquidos.length;

  // Valor total de todos os itens com custo cadastrado
  const valorTotalEstoque = useMemo(() => {
    let total = 0;
    for (const a of adubos) {
      const v = valorTotalItem(a);
      if (v) total += v;
    }
    for (const p of todosProdutosLiquidos) {
      const v = valorTotalItem(p);
      if (v) total += v;
    }
    return Math.round(total * 100) / 100;
  }, [adubos, todosProdutosLiquidos]);

  return {
    ...storage,
    todosProdutosLiquidos,
    alertasAdubos,
    alertasLiquidos,
    totalAlertas,
    valorTotalEstoque,
  };
}
