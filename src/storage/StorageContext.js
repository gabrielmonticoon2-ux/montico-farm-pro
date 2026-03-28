import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import { db } from '../config/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useFarm } from './FarmContext';

const StorageContext = createContext(null);

// Incrementar sempre que o shape dos dados mudar de forma incompatível
const SCHEMA_VERSION = 2;

const KEYS = {
  ADUBOS:   '@roca:adubos',
  LIQUIDOS: '@roca:liquidos',
  TALHOES:  '@roca:talhoes',
  SEMENTES: '@roca:sementes',
  SCHEMA:   '@roca:schemaVersion',
};

const LIQUIDOS_PADRAO = {
  herbicidas:  [],
  adjuvantes:  [],
  fungicidas:  [],
  inseticidas: [],
  foliares:    [],
};

const SEMENTES_PADRAO = {
  milho:  [],
  soja:   [],
  trigo:  [],
  feijao: [],
};

// ─── MIGRAÇÕES ──────────────────────────────────────────────────────────────

const MIGRACOES = {
  2: (dados) => ({
    ...dados,
    talhoes: dados.talhoes.map(t => {
      if (t.culturas) return t;
      const registros = t.registros || [];
      const nomeCultura = t.cultura;
      const culturas = nomeCultura
        ? [{ id: `${t.id}_c1`, nome: nomeCultura, registros }]
        : registros.length > 0
          ? [{ id: `${t.id}_c1`, nome: 'Geral', registros }]
          : [];
      return { id: t.id, nome: t.nome, hectares: t.hectares || null, culturas };
    }),
  }),
};

async function aplicarMigracoes(versaoSalva, dadosAtuais) {
  let { adubos, liquidos, talhoes } = dadosAtuais;
  let versao = versaoSalva;

  while (versao < SCHEMA_VERSION) {
    const proxima = versao + 1;
    const migrar = MIGRACOES[proxima];
    if (migrar) {
      ({ adubos, liquidos, talhoes } = migrar({ adubos, liquidos, talhoes }));
    }
    versao = proxima;
  }

  return { adubos, liquidos, talhoes, versaoFinal: versao };
}

// ─── PROVIDER ───────────────────────────────────────────────────────────────

export function StorageProvider({ children }) {
  const { farmCode } = useFarm();

  const [adubos, setAdubosState]   = useState([]);
  const [liquidos, setLiquidosState] = useState(LIQUIDOS_PADRAO);
  const [talhoes, setTalhoesState]  = useState([]);
  const [sementes, setSementesState] = useState(SEMENTES_PADRAO);
  const [loading, setLoading]       = useState(true);
  const [erro, setErro]             = useState(null);
  const [isSyncing, setIsSyncing]   = useState(false);

  const unsubscribeRef = useRef(null);

  // ─── CARREGAMENTO INICIAL + LISTENER FIRESTORE ──────────────────────────

  useEffect(() => {
    if (!farmCode) return;

    // 1. Carrega cache local imediatamente (sem esperar o Firestore)
    loadFromAsyncStorage();

    // 2. Inscreve no Firestore para sync em tempo real
    setIsSyncing(true);
    const farmRef = doc(db, 'farms', farmCode);

    const unsubscribe = onSnapshot(
      farmRef,
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const novosAdubos   = data.adubos   ?? [];
          const novosLiquidos = { ...LIQUIDOS_PADRAO, ...(data.liquidos  ?? {}) };
          const novosTalhoes  = data.talhoes  ?? [];
          const novasSementes = { ...SEMENTES_PADRAO, ...(data.sementes ?? {}) };

          setAdubosState(novosAdubos);
          setLiquidosState(novosLiquidos);
          setTalhoesState(novosTalhoes);
          setSementesState(novasSementes);

          // Atualiza cache local com os dados mais recentes do servidor
          await Promise.all([
            AsyncStorage.setItem(KEYS.ADUBOS,   JSON.stringify(novosAdubos)),
            AsyncStorage.setItem(KEYS.LIQUIDOS,  JSON.stringify(novosLiquidos)),
            AsyncStorage.setItem(KEYS.TALHOES,   JSON.stringify(novosTalhoes)),
            AsyncStorage.setItem(KEYS.SEMENTES,  JSON.stringify(novasSementes)),
          ]);
        }
        setLoading(false);
        setIsSyncing(false);
      },
      (error) => {
        console.warn('Firestore sync error:', error);
        setIsSyncing(false);
        setLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;
    return () => unsubscribe();
  }, [farmCode]);

  async function loadFromAsyncStorage() {
    setErro(null);
    try {
      const [versaoStr, a, l, t, s] = await Promise.all([
        AsyncStorage.getItem(KEYS.SCHEMA),
        AsyncStorage.getItem(KEYS.ADUBOS),
        AsyncStorage.getItem(KEYS.LIQUIDOS),
        AsyncStorage.getItem(KEYS.TALHOES),
        AsyncStorage.getItem(KEYS.SEMENTES),
      ]);

      const versaoSalva = versaoStr ? parseInt(versaoStr, 10) : SCHEMA_VERSION;

      const dadosBrutos = {
        adubos:   a ? JSON.parse(a) : [],
        liquidos: l ? JSON.parse(l) : LIQUIDOS_PADRAO,
        talhoes:  t ? JSON.parse(t) : [],
        sementes: s ? JSON.parse(s) : SEMENTES_PADRAO,
      };

      dadosBrutos.liquidos = { ...LIQUIDOS_PADRAO, ...dadosBrutos.liquidos };
      dadosBrutos.sementes = { ...SEMENTES_PADRAO, ...dadosBrutos.sementes };

      if (versaoSalva < SCHEMA_VERSION) {
        const { adubos: a2, liquidos: l2, talhoes: t2, versaoFinal } =
          await aplicarMigracoes(versaoSalva, dadosBrutos);
        dadosBrutos.adubos   = a2;
        dadosBrutos.liquidos = l2;
        dadosBrutos.talhoes  = t2;
        await Promise.all([
          AsyncStorage.setItem(KEYS.ADUBOS,   JSON.stringify(a2)),
          AsyncStorage.setItem(KEYS.LIQUIDOS,  JSON.stringify(l2)),
          AsyncStorage.setItem(KEYS.TALHOES,   JSON.stringify(t2)),
          AsyncStorage.setItem(KEYS.SCHEMA,    String(versaoFinal)),
        ]);
      } else if (!versaoStr) {
        await AsyncStorage.setItem(KEYS.SCHEMA, String(SCHEMA_VERSION));
      }

      setAdubosState(dadosBrutos.adubos);
      setLiquidosState(dadosBrutos.liquidos);
      setTalhoesState(dadosBrutos.talhoes);
      setSementesState(dadosBrutos.sementes);
    } catch (e) {
      console.error('Erro ao carregar dados locais:', e);
      setErro('Não foi possível carregar os dados. Tente reiniciar o aplicativo.');
    } finally {
      setLoading(false);
    }
  }

  // ─── FUNÇÕES BASE DE ESCRITA (AsyncStorage + Firestore) ─────────────────

  async function salvarAdubos(novos) {
    setAdubosState(novos);
    await AsyncStorage.setItem(KEYS.ADUBOS, JSON.stringify(novos));
    if (farmCode) {
      try {
        await updateDoc(doc(db, 'farms', farmCode), { adubos: novos });
      } catch (e) {
        console.warn('Firestore write (adubos) queued:', e.code);
      }
    }
  }

  async function salvarLiquidos(novos) {
    setLiquidosState(novos);
    await AsyncStorage.setItem(KEYS.LIQUIDOS, JSON.stringify(novos));
    if (farmCode) {
      try {
        await updateDoc(doc(db, 'farms', farmCode), { liquidos: novos });
      } catch (e) {
        console.warn('Firestore write (liquidos) queued:', e.code);
      }
    }
  }

  async function salvarSementes(novos) {
    setSementesState(novos);
    await AsyncStorage.setItem(KEYS.SEMENTES, JSON.stringify(novos));
    if (farmCode) {
      try {
        await updateDoc(doc(db, 'farms', farmCode), { sementes: novos });
      } catch (e) {
        console.warn('Firestore write (sementes) queued:', e.code);
      }
    }
  }

  async function salvarTalhoes(novos) {
    setTalhoesState(novos);
    await AsyncStorage.setItem(KEYS.TALHOES, JSON.stringify(novos));
    if (farmCode) {
      try {
        await updateDoc(doc(db, 'farms', farmCode), { talhoes: novos });
      } catch (e) {
        console.warn('Firestore write (talhoes) queued:', e.code);
      }
    }
  }

  // ─── ADUBOS ───────────────────────────────────────────────────────────────

  async function adicionarAdubo(npk, quantidade, unidade = 'kg') {
    const existente = adubos.find(a => a.npk === npk);
    let novos;
    if (existente) {
      novos = adubos.map(a =>
        a.npk === npk ? { ...a, quantidade, unidade } : a
      );
    } else {
      novos = [...adubos, { id: Date.now().toString(), npk, quantidade, unidade }];
    }
    await salvarAdubos(novos);
  }

  async function removerAdubo(id) {
    await salvarAdubos(adubos.filter(a => a.id !== id));
  }

  async function atualizarConfigAdubo(id, { estoqueMinimo, custoPorUnidade }) {
    await salvarAdubos(adubos.map(a =>
      a.id === id ? { ...a, estoqueMinimo, custoPorUnidade } : a
    ));
  }

  async function adicionarMovimentacaoAdubo(id, { tipo, quantidade, motivo }) {
    const novos = adubos.map(a => {
      if (a.id !== id) return a;
      const novaQtd =
        tipo === 'entrada'
          ? (a.quantidade || 0) + quantidade
          : Math.max(0, (a.quantidade || 0) - quantidade);
      const mov = {
        id: Date.now().toString(),
        data: new Date().toISOString(),
        tipo,
        quantidade,
        motivo: motivo || '',
      };
      return { ...a, quantidade: novaQtd, movimentacoes: [mov, ...(a.movimentacoes || [])] };
    });
    await salvarAdubos(novos);
  }

  // ─── LÍQUIDOS ─────────────────────────────────────────────────────────────

  async function adicionarLiquido(categoria, nome, quantidade, unidade = 'L') {
    await salvarLiquidos({
      ...liquidos,
      [categoria]: [...liquidos[categoria], { id: Date.now().toString(), nome, quantidade, unidade }],
    });
  }

  async function removerLiquido(categoria, id) {
    await salvarLiquidos({
      ...liquidos,
      [categoria]: liquidos[categoria].filter(p => p.id !== id),
    });
  }

  async function atualizarLiquido(categoria, id, nome, quantidade, unidade) {
    await salvarLiquidos({
      ...liquidos,
      [categoria]: liquidos[categoria].map(p =>
        p.id === id ? { ...p, nome, quantidade, unidade } : p
      ),
    });
  }

  async function atualizarConfigLiquido(categoria, id, { estoqueMinimo, custoPorUnidade }) {
    await salvarLiquidos({
      ...liquidos,
      [categoria]: liquidos[categoria].map(p =>
        p.id === id ? { ...p, estoqueMinimo, custoPorUnidade } : p
      ),
    });
  }

  async function adicionarMovimentacaoLiquido(categoria, id, { tipo, quantidade, motivo }) {
    await salvarLiquidos({
      ...liquidos,
      [categoria]: liquidos[categoria].map(p => {
        if (p.id !== id) return p;
        const novaQtd =
          tipo === 'entrada'
            ? (p.quantidade || 0) + quantidade
            : Math.max(0, (p.quantidade || 0) - quantidade);
        const mov = {
          id: Date.now().toString(),
          data: new Date().toISOString(),
          tipo,
          quantidade,
          motivo: motivo || '',
        };
        return { ...p, quantidade: novaQtd, movimentacoes: [mov, ...(p.movimentacoes || [])] };
      }),
    });
  }

  // ─── SEMENTES ─────────────────────────────────────────────────────────────

  async function adicionarSemente(categoria, nome, quantidade, unidade = 'sc', sementesPorSaco = null) {
    await salvarSementes({
      ...sementes,
      [categoria]: [...sementes[categoria], { id: Date.now().toString(), nome, quantidade, unidade, sementesPorSaco }],
    });
  }

  async function removerSemente(categoria, id) {
    await salvarSementes({ ...sementes, [categoria]: sementes[categoria].filter(s => s.id !== id) });
  }

  async function atualizarConfigSemente(categoria, id, { estoqueMinimo, custoPorUnidade, sementesPorSaco }) {
    await salvarSementes({
      ...sementes,
      [categoria]: sementes[categoria].map(s =>
        s.id === id ? { ...s, estoqueMinimo, custoPorUnidade, sementesPorSaco } : s
      ),
    });
  }

  async function adicionarMovimentacaoSemente(categoria, id, { tipo, quantidade, motivo }) {
    await salvarSementes({
      ...sementes,
      [categoria]: sementes[categoria].map(s => {
        if (s.id !== id) return s;
        const novaQtd = tipo === 'entrada'
          ? (s.quantidade || 0) + quantidade
          : Math.max(0, (s.quantidade || 0) - quantidade);
        const mov = { id: Date.now().toString(), data: new Date().toISOString(), tipo, quantidade, motivo: motivo || '' };
        return { ...s, quantidade: novaQtd, movimentacoes: [mov, ...(s.movimentacoes || [])] };
      }),
    });
  }

  // ─── TALHÕES ──────────────────────────────────────────────────────────────

  async function adicionarTalhao(nome, hectares) {
    await salvarTalhoes([
      ...talhoes,
      { id: Date.now().toString(), nome, hectares: hectares || null, cultura: '', registros: [] },
    ]);
  }

  async function atualizarHectaresTalhao(id, hectares) {
    await salvarTalhoes(talhoes.map(t => t.id === id ? { ...t, hectares: hectares || null } : t));
  }

  async function removerTalhao(id) {
    await salvarTalhoes(talhoes.filter(t => t.id !== id));
  }

  async function adicionarCulturaTalhao(talhaoId, nome) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return { ...t, culturas: [...(t.culturas || []), { id: Date.now().toString(), nome, registros: [] }] };
    }));
  }

  async function removerCulturaTalhao(talhaoId, culturaId) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return { ...t, culturas: t.culturas.filter(c => c.id !== culturaId) };
    }));
  }

  async function atualizarHectaresCultura(talhaoId, culturaId, hectares) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return { ...t, culturas: t.culturas.map(c => c.id !== culturaId ? c : { ...c, hectares }) };
    }));
  }

  async function atualizarMudasCultura(talhaoId, culturaId, mudas) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return { ...t, culturas: t.culturas.map(c => c.id !== culturaId ? c : { ...c, mudas }) };
    }));
  }

  async function adicionarVariedadeCouve(talhaoId, culturaId, { nome, mudas, dataPlantio }) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          const novaVar = { id: Date.now().toString(), nome, mudas: mudas || null, dataPlantio, registros: [] };
          return { ...c, variedades: [...(c.variedades || []), novaVar] };
        }),
      };
    }));
  }

  async function atualizarVariedadeCouve(talhaoId, culturaId, variedadeId, { nome, mudas, dataPlantio }) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          return {
            ...c,
            variedades: (c.variedades || []).map(v =>
              v.id !== variedadeId ? v : { ...v, nome, mudas: mudas || null, dataPlantio: dataPlantio ?? v.dataPlantio }
            ),
          };
        }),
      };
    }));
  }

  async function removerVariedadeCouve(talhaoId, culturaId, variedadeId) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          return { ...c, variedades: (c.variedades || []).filter(v => v.id !== variedadeId) };
        }),
      };
    }));
  }

  async function adicionarRegistroVariedade(talhaoId, culturaId, variedadeId, registro) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          return {
            ...c,
            variedades: (c.variedades || []).map(v => {
              if (v.id !== variedadeId) return v;
              return { ...v, registros: [{ id: Date.now().toString(), ...registro }, ...(v.registros || [])] };
            }),
          };
        }),
      };
    }));
  }

  // Salva o registro na variedade E no geral da cultura atomicamente
  async function adicionarRegistroVariedadeEGeral(talhaoId, culturaId, variedadeId, variedadeNome, registro) {
    const novoId = Date.now().toString();
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          const novoRegistroGeral = { id: novoId, ...registro, variedadeOrigem: variedadeNome };
          const novasVariedades = (c.variedades || []).map(v => {
            if (v.id !== variedadeId) return v;
            return { ...v, registros: [{ id: `${novoId}_var`, culturaRegistroId: novoId, ...registro }, ...(v.registros || [])] };
          });
          return { ...c, registros: [novoRegistroGeral, ...(c.registros || [])], variedades: novasVariedades };
        }),
      };
    }));
  }

  async function atualizarRegistroVariedade(talhaoId, culturaId, variedadeId, registroId, dados) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          return {
            ...c,
            variedades: (c.variedades || []).map(v => {
              if (v.id !== variedadeId) return v;
              return { ...v, registros: (v.registros || []).map(r => r.id === registroId ? { ...r, ...dados } : r) };
            }),
          };
        }),
      };
    }));
  }

  async function removerRegistroVariedade(talhaoId, culturaId, variedadeId, registroId) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          return {
            ...c,
            variedades: (c.variedades || []).map(v => {
              if (v.id !== variedadeId) return v;
              return { ...v, registros: (v.registros || []).filter(r => r.id !== registroId) };
            }),
          };
        }),
      };
    }));
  }

  async function adicionarRegistroColheita(talhaoId, culturaId, registro) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          const colheita = c.colheita || { registros: [], concluida: false, precoVendaSaco: null };
          return { ...c, colheita: { ...colheita, registros: [{ id: Date.now().toString(), ...registro }, ...colheita.registros] } };
        }),
      };
    }));
  }

  async function removerRegistroColheita(talhaoId, culturaId, registroId) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          const colheita = c.colheita || { registros: [] };
          return { ...c, colheita: { ...colheita, registros: colheita.registros.filter(r => r.id !== registroId) } };
        }),
      };
    }));
  }

  async function marcarColheitaConcluida(talhaoId, culturaId, concluida) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          const colheita = c.colheita || { registros: [] };
          return { ...c, colheita: { ...colheita, concluida } };
        }),
      };
    }));
  }

  async function atualizarPrecoColheita(talhaoId, culturaId, precoVendaSaco) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          const colheita = c.colheita || { registros: [] };
          return { ...c, colheita: { ...colheita, precoVendaSaco } };
        }),
      };
    }));
  }

  async function adicionarRegistroColheitaCouve(talhaoId, culturaId, registro) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          const colheitaCouve = c.colheitaCouve || { registros: [] };
          return { ...c, colheitaCouve: { ...colheitaCouve, registros: [{ id: Date.now().toString(), ...registro }, ...colheitaCouve.registros] } };
        }),
      };
    }));
  }

  async function atualizarPrecoColheitaCouve(talhaoId, culturaId, precoPorCabeca) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          const colheitaCouve = c.colheitaCouve || { registros: [] };
          return { ...c, colheitaCouve: { ...colheitaCouve, precoPorCabeca } };
        }),
      };
    }));
  }

  async function removerRegistroColheitaCouve(talhaoId, culturaId, registroId) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          const colheitaCouve = c.colheitaCouve || { registros: [] };
          return { ...c, colheitaCouve: { ...colheitaCouve, registros: colheitaCouve.registros.filter(r => r.id !== registroId) } };
        }),
      };
    }));
  }

  async function adicionarRegistroCultura(talhaoId, culturaId, registro) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          return { ...c, registros: [{ id: Date.now().toString(), ...registro }, ...(c.registros || [])] };
        }),
      };
    }));
  }

  // Versão atômica: salva o registro geral + replica nas variedades em uma única operação
  async function adicionarRegistroCulturaEVariedades(talhaoId, culturaId, registro, nomesVariedades) {
    const novoId = Date.now().toString();
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          const novosRegistros = [{ id: novoId, ...registro }, ...(c.registros || [])];
          const novasVariedades = (c.variedades || []).map((v, vi) => {
            if (!nomesVariedades.includes(v.nome)) return v;
            // culturaRegistroId permite encontrar e apagar estes registros ao apagar o geral
            return { ...v, registros: [{ id: `${novoId}_v${vi}`, culturaRegistroId: novoId, ...registro }, ...(v.registros || [])] };
          });
          return { ...c, registros: novosRegistros, variedades: novasVariedades };
        }),
      };
    }));
  }

  // Confirma (pendente: false) o registro geral E todos os registros vinculados nas variedades
  async function confirmarRegistroCulturaEVariedades(talhaoId, culturaId, registroId) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          const novosRegistros = (c.registros || []).map(r =>
            r.id === registroId ? { ...r, pendente: false } : r
          );
          const novasVariedades = (c.variedades || []).map(v => ({
            ...v,
            registros: (v.registros || []).map(r =>
              r.culturaRegistroId === registroId ? { ...r, pendente: false } : r
            ),
          }));
          return { ...c, registros: novosRegistros, variedades: novasVariedades };
        }),
      };
    }));
  }

  // Remove o registro geral da cultura E os registros replicados nas variedades
  async function removerRegistroCulturaEVariedades(talhaoId, culturaId, registroId) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          const novosRegistros = (c.registros || []).filter(r => r.id !== registroId);
          const novasVariedades = (c.variedades || []).map(v => ({
            ...v,
            registros: (v.registros || []).filter(r => r.culturaRegistroId !== registroId),
          }));
          return { ...c, registros: novosRegistros, variedades: novasVariedades };
        }),
      };
    }));
  }

  async function removerRegistroCultura(talhaoId, culturaId, registroId) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          return { ...c, registros: c.registros.filter(r => r.id !== registroId) };
        }),
      };
    }));
  }

  async function atualizarRegistroCultura(talhaoId, culturaId, registroId, dados) {
    await salvarTalhoes(talhoes.map(t => {
      if (t.id !== talhaoId) return t;
      return {
        ...t,
        culturas: t.culturas.map(c => {
          if (c.id !== culturaId) return c;
          return { ...c, registros: c.registros.map(r => r.id === registroId ? { ...r, ...dados } : r) };
        }),
      };
    }));
  }

  // ─── EXPORTAÇÃO ───────────────────────────────────────────────────────────

  async function exportarDados() {
    try {
      const backup = {
        app: 'Montico Farm Pro',
        schemaVersion: SCHEMA_VERSION,
        exportadoEm: new Date().toISOString(),
        dados: { adubos, liquidos, talhoes },
      };
      await Share.share({
        title: 'Backup Montico Farm Pro',
        message: JSON.stringify(backup, null, 2),
      });
    } catch (e) {
      console.error('Erro ao exportar dados:', e);
      setErro('Não foi possível exportar os dados.');
    }
  }

  function limparErro() {
    setErro(null);
  }

  return (
    <StorageContext.Provider
      value={{
        loading,
        erro,
        isSyncing,
        farmCode,
        limparErro,
        adubos,
        liquidos,
        talhoes,
        sementes,
        adicionarAdubo,
        removerAdubo,
        atualizarConfigAdubo,
        adicionarMovimentacaoAdubo,
        adicionarLiquido,
        removerLiquido,
        atualizarLiquido,
        atualizarConfigLiquido,
        adicionarMovimentacaoLiquido,
        adicionarSemente,
        removerSemente,
        atualizarConfigSemente,
        adicionarMovimentacaoSemente,
        adicionarTalhao,
        atualizarHectaresTalhao,
        removerTalhao,
        adicionarCulturaTalhao,
        removerCulturaTalhao,
        atualizarHectaresCultura,
        atualizarMudasCultura,
        adicionarVariedadeCouve,
        atualizarVariedadeCouve,
        removerVariedadeCouve,
        adicionarRegistroVariedade,
        adicionarRegistroVariedadeEGeral,
        atualizarRegistroVariedade,
        removerRegistroVariedade,
        adicionarRegistroColheita,
        removerRegistroColheita,
        marcarColheitaConcluida,
        atualizarPrecoColheita,
        adicionarRegistroColheitaCouve,
        atualizarPrecoColheitaCouve,
        removerRegistroColheitaCouve,
        adicionarRegistroCultura,
        adicionarRegistroCulturaEVariedades,
        removerRegistroCultura,
        removerRegistroCulturaEVariedades,
        confirmarRegistroCulturaEVariedades,
        atualizarRegistroCultura,
        exportarDados,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
}

export function useStorage() {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error('useStorage deve ser usado dentro de StorageProvider');
  return ctx;
}
