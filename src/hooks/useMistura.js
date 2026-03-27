import { useState, useMemo } from 'react';
import {
  calcularPhIdeal,
  verificarIncompatibilidades,
  calcularOrdemMistura,
} from '../data/incompatibilidades';
import { parseDecimal, calcularDosePorTanque, calcularNumTanques } from '../utils';
import { useEstoque } from './useEstoque';

/**
 * Hook que encapsula todo o estado e lógica da calculadora de mistura.
 */
export function useMistura() {
  const { todosProdutosLiquidos } = useEstoque();

  const [selecionados, setSelecionados] = useState({});
  const [mostrarResultado, setMostrarResultado] = useState(false);
  const [volTanque, setVolTanqueRaw] = useState('');
  const [volHa, setVolHaRaw] = useState('');
  const [areaHa, setAreaHaRaw] = useState('');
  const [doses, setDoses] = useState({});

  const produtosSelecionados = useMemo(
    () => todosProdutosLiquidos.filter(p => selecionados[p.uid]),
    [todosProdutosLiquidos, selecionados]
  );

  function toggleProduto(uid) {
    setSelecionados(prev => ({ ...prev, [uid]: !prev[uid] }));
    setMostrarResultado(false);
  }

  function setDoseProduto(uid, campo, valor) {
    setDoses(prev => ({ ...prev, [uid]: { ...prev[uid], [campo]: valor } }));
    setMostrarResultado(false);
  }

  function setVolTanque(v) { setVolTanqueRaw(v); setMostrarResultado(false); }
  function setVolHa(v)     { setVolHaRaw(v);     setMostrarResultado(false); }
  function setAreaHa(v)    { setAreaHaRaw(v);     setMostrarResultado(false); }

  function calcular() {
    if (produtosSelecionados.length > 0) setMostrarResultado(true);
  }

  function limpar() {
    setSelecionados({});
    setMostrarResultado(false);
    setDoses({});
    setVolTanqueRaw('');
    setVolHaRaw('');
    setAreaHaRaw('');
  }

  // Parâmetros numéricos da calda
  const parametrosCalda = useMemo(() => {
    const tanque = parseDecimal(volTanque);
    const calda  = parseDecimal(volHa);
    const area   = parseDecimal(areaHa);

    if (!tanque || !calda || tanque <= 0 || calda <= 0) return null;

    const numTanques = !isNaN(area) && area > 0
      ? calcularNumTanques(area, calda, tanque)
      : null;

    const dosesPorTanque = produtosSelecionados.map(p => {
      const d = doses[p.uid];
      const doseHa  = d ? parseDecimal(d.dose ?? '') : NaN;
      const unidade = d?.unidade ?? p.unidade ?? 'L';
      const doseTanque = !isNaN(doseHa) && doseHa > 0
        ? calcularDosePorTanque(doseHa, calda, tanque)
        : null;
      return { ...p, doseHa: isNaN(doseHa) ? null : doseHa, doseTanque, unidade };
    });

    return { tanque, calda, area: isNaN(area) ? null : area, numTanques, dosesPorTanque };
  }, [volTanque, volHa, areaHa, produtosSelecionados, doses]);

  // Resultados finais calculados
  const resultado = useMemo(() => {
    if (!mostrarResultado || produtosSelecionados.length === 0) return null;
    return {
      ordem:              calcularOrdemMistura(produtosSelecionados),
      incompatibilidades: verificarIncompatibilidades(produtosSelecionados),
      ph:                 calcularPhIdeal(produtosSelecionados),
      calda:              parametrosCalda,
    };
  }, [mostrarResultado, produtosSelecionados, parametrosCalda]);

  return {
    todosProdutos: todosProdutosLiquidos,
    selecionados,
    produtosSelecionados,
    mostrarResultado,
    volTanque,
    volHa,
    areaHa,
    doses,
    parametrosCalda,
    resultado,
    toggleProduto,
    setDoseProduto,
    setVolTanque,
    setVolHa,
    setAreaHa,
    calcular,
    limpar,
  };
}
