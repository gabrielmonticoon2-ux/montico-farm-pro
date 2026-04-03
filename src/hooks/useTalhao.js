import { useMemo } from 'react';
import { useStorage } from '../storage/StorageContext';
import { mesAno } from '../utils';
import { TIPOS_REGISTRO_TALHAO } from '../constants';

/**
 * Hook para derivar dados e helpers relacionados a talhões.
 */
export function useTalhao() {
  const storage = useStorage();
  const { talhoes } = storage;

  // Todos os registros achatados com nome do talhão, ordenados por data desc
  const todosRegistros = useMemo(() => {
    const lista = [];
    for (const t of talhoes) {
      for (const c of (t.culturas || [])) {
        for (const r of (c.registros || [])) {
          lista.push({ ...r, talhaoNome: t.nome, talhaoId: t.id, culturaNome: c.nome });
        }
      }
    }
    return lista.sort((a, b) => new Date(b.data) - new Date(a.data));
  }, [talhoes]);

  // Registros agrupados por mês
  function agruparPorMes(registros) {
    const map = new Map();
    for (const r of registros) {
      const chave = mesAno(r.data);
      if (!map.has(chave)) map.set(chave, []);
      map.get(chave).push(r);
    }
    return [...map.entries()]; // [[mesAno, [registros]], ...]
  }

  // Info de tipo de registro por key
  function infoTipo(key) {
    return TIPOS_REGISTRO_TALHAO.find(t => t.key === key) ?? TIPOS_REGISTRO_TALHAO[3];
  }

  // Total de registros em todos os talhões
  const totalRegistros = useMemo(
    () => talhoes.reduce((s, t) =>
      s + (t.culturas || []).reduce((sc, c) => sc + (c.registros || []).length, 0), 0),
    [talhoes]
  );

  return {
    ...storage,
    todosRegistros,
    totalRegistros,
    agruparPorMes,
    infoTipo,
  };
}
