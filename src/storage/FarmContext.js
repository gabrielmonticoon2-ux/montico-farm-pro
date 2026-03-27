import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const FarmContext = createContext(null);

const FARM_CODE_KEY = '@roca:farmCode';
const FARM_NAME_KEY = '@roca:farmName';

function gerarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function FarmProvider({ children }) {
  const [farmCode, setFarmCode]   = useState(null);
  const [farmName, setFarmName]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [erro, setErro]           = useState(null);

  useEffect(() => {
    async function carregarFarmSalvo() {
      try {
        const [code, name] = await Promise.all([
          AsyncStorage.getItem(FARM_CODE_KEY),
          AsyncStorage.getItem(FARM_NAME_KEY),
        ]);
        if (code) {
          setFarmCode(code);
          setFarmName(name);
        }
      } catch (e) {
        console.error('Erro ao carregar farm code:', e);
      } finally {
        setLoading(false);
      }
    }
    carregarFarmSalvo();
  }, []);

  async function criarFazenda(nome) {
    setErro(null);
    let code;
    let tentativas = 0;

    // Gera código único (colisão é rara mas verificamos)
    while (tentativas < 5) {
      code = gerarCodigo();
      const snap = await getDoc(doc(db, 'farms', code));
      if (!snap.exists()) break;
      tentativas++;
    }

    const dadosIniciais = {
      nomeFazenda:   nome || 'Minha Fazenda',
      schemaVersion: 2,
      criadoEm:      serverTimestamp(),
      adubos:        [],
      liquidos: {
        herbicidas:  [],
        adjuvantes:  [],
        fungicidas:  [],
        inseticidas: [],
        foliares:    [],
      },
      talhoes:  [],
      sementes: {
        milho:  [],
        soja:   [],
        trigo:  [],
        feijao: [],
      },
    };

    await setDoc(doc(db, 'farms', code), dadosIniciais);
    // Não entra no app ainda — deixa FarmSetupScreen mostrar o código primeiro
    return { code, nome: nome || 'Minha Fazenda' };
  }

  // Chamado após o usuário ver e copiar o código
  async function confirmarEntrada(code, nome) {
    await Promise.all([
      AsyncStorage.setItem(FARM_CODE_KEY, code),
      AsyncStorage.setItem(FARM_NAME_KEY, nome || 'Minha Fazenda'),
    ]);
    setFarmCode(code);
    setFarmName(nome || 'Minha Fazenda');
  }

  async function entrarFazenda(code) {
    setErro(null);
    const codeUpper = code.trim().toUpperCase();

    if (codeUpper.length !== 6) {
      setErro('O código deve ter exatamente 6 caracteres.');
      return false;
    }

    const snap = await getDoc(doc(db, 'farms', codeUpper));
    if (!snap.exists()) {
      setErro('Fazenda não encontrada. Verifique o código e tente novamente.');
      return false;
    }

    const nome = snap.data().nomeFazenda || '';
    await Promise.all([
      AsyncStorage.setItem(FARM_CODE_KEY, codeUpper),
      AsyncStorage.setItem(FARM_NAME_KEY, nome),
    ]);

    setFarmCode(codeUpper);
    setFarmName(nome);
    return true;
  }

  async function sairFazenda() {
    await Promise.all([
      AsyncStorage.removeItem(FARM_CODE_KEY),
      AsyncStorage.removeItem(FARM_NAME_KEY),
    ]);
    setFarmCode(null);
    setFarmName(null);
  }

  return (
    <FarmContext.Provider value={{ farmCode, farmName, loading, erro, criarFazenda, confirmarEntrada, entrarFazenda, sairFazenda }}>
      {children}
    </FarmContext.Provider>
  );
}

export function useFarm() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error('useFarm deve ser usado dentro de FarmProvider');
  return ctx;
}
