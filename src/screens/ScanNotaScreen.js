import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useStorage } from '../storage/StorageContext';
import { extrairTextoDaImagem } from '../services/ocrService';
import { parsearProdutos } from '../services/danfeParser';
import Card from '../components/Card';
import Button from '../components/Button';
import { PRIMARY, ACCENT, DANGER } from '../constants';
import { parseQuantidade } from '../utils';

const TIPO_LABELS = {
  adubo:       { label: 'Adubo',    cor: '#2D6A4F' },
  liquido:     { label: 'Líquido',  cor: '#1565C0' },
  semente:     { label: 'Semente',  cor: '#F59E0B' },
  desconhecido:{ label: '?',        cor: '#9CA3AF' },
};

const UNIDADES_POR_TIPO = {
  adubo:   ['kg', 'sc', 't'],
  liquido: ['L', 'kg'],
  semente: ['bag', 'kg', 'sc'],
  desconhecido: ['kg', 'L', 'sc', 'bag'],
};

export default function ScanNotaScreen({ navigation, route }) {
  const tipoInicial = route?.params?.tipoInicial || null;

  const {
    adicionarAdubo, adicionarLiquido, adicionarSemente,
  } = useStorage();

  const [momento, setMomento]         = useState('captura'); // 'captura' | 'revisao'
  const [progressoTxt, setProgressoTxt] = useState(null);
  const [produtos, setProdutos]       = useState([]);

  // ─── captura ────────────────────────────────────────────────────────────────

  async function abrirSeletor(tipo) {
    let result;
    if (tipo === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'O app precisa da câmera para fotografar notas fiscais.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({ quality: 0.8, base64: true });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'O app precisa acessar suas fotos para importar notas fiscais.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, base64: true, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    }
    if (!result.canceled && result.assets?.[0]?.base64) {
      processarImagem(result.assets[0].base64);
    }
  }

  async function processarImagem(base64) {
    setProgressoTxt('Carregando motor de leitura...');
    try {
      setProgressoTxt('Analisando a imagem...');
      const texto = await extrairTextoDaImagem(base64);
      setProgressoTxt('Identificando produtos...');
      const encontrados = parsearProdutos(texto);
      if (encontrados.length === 0) {
        Alert.alert(
          'Nenhum produto encontrado',
          'Não foi possível identificar produtos na nota. Você pode adicionar manualmente no estoque.',
          [{ text: 'OK' }]
        );
        setProgressoTxt(null);
        return;
      }
      setProdutos(encontrados.map((p, i) => ({ ...p, uid: String(i) })));
      setMomento('revisao');
    } catch (err) {
      Alert.alert('Erro ao ler nota', err.message || 'Tente novamente.');
    } finally {
      setProgressoTxt(null);
    }
  }

  // ─── revisão ────────────────────────────────────────────────────────────────

  function atualizarProduto(uid, campo, valor) {
    setProdutos(prev => prev.map(p => p.uid === uid ? { ...p, [campo]: valor } : p));
  }

  function removerProduto(uid) {
    setProdutos(prev => prev.filter(p => p.uid !== uid));
  }

  async function adicionarTodos() {
    let erros = 0;
    for (const p of produtos) {
      const qtd = parseQuantidade(p.quantidade);
      if (isNaN(qtd) || qtd <= 0 || !p.nome.trim()) { erros++; continue; }
      try {
        if (p.tipoSugerido === 'adubo') {
          await adicionarAdubo({ npk: p.nome.trim(), unidade: p.unidade, quantidade: qtd });
        } else if (p.tipoSugerido === 'liquido') {
          await adicionarLiquido('foliares', { nome: p.nome.trim(), unidade: p.unidade, quantidade: qtd });
        } else if (p.tipoSugerido === 'semente') {
          await adicionarSemente('milho', { nome: p.nome.trim(), unidade: p.unidade, quantidade: qtd });
        } else {
          // desconhecido: adiciona como adubo para não perder
          await adicionarAdubo({ npk: p.nome.trim(), unidade: p.unidade, quantidade: qtd });
        }
      } catch {
        erros++;
      }
    }
    if (erros > 0) {
      Alert.alert('Atenção', `${erros} produto(s) não puderam ser adicionados. Verifique os dados e tente novamente.`);
    } else {
      Alert.alert('Sucesso', 'Todos os produtos foram adicionados ao estoque!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  }

  // ─── render ─────────────────────────────────────────────────────────────────

  if (progressoTxt !== null) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingTxt}>{progressoTxt}</Text>
      </View>
    );
  }

  if (momento === 'captura') {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.voltarBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitulo}>Importar nota fiscal</Text>
        </View>

        <View style={styles.capturaBox}>
          <Ionicons name="document-text-outline" size={64} color={PRIMARY} style={{ marginBottom: 16 }} />
          <Text style={styles.capturaTitle}>Fotografe ou escolha uma nota fiscal</Text>
          <Text style={styles.capturaSub}>
            O app vai identificar os produtos, quantidades e unidades automaticamente.
          </Text>

          <TouchableOpacity style={styles.capturaBtnPrimario} onPress={() => abrirSeletor('camera')}>
            <Ionicons name="camera-outline" size={22} color="#fff" />
            <Text style={styles.capturaBtnTxt}>Tirar foto da nota</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.capturaBtnSecundario} onPress={() => abrirSeletor('galeria')}>
            <Ionicons name="images-outline" size={22} color={PRIMARY} />
            <Text style={[styles.capturaBtnTxt, { color: PRIMARY }]}>Escolher da galeria</Text>
          </TouchableOpacity>

          <Text style={styles.capturaAviso}>
            O texto é lido diretamente no seu dispositivo.{'\n'}
            Nenhuma imagem é enviada para servidores externos.
          </Text>
        </View>
      </View>
    );
  }

  // momento === 'revisao'
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMomento('captura')} style={styles.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitulo}>Revisar produtos ({produtos.length})</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {produtos.length === 0 && (
          <Card style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={32} color="#27AE60" />
            <Text style={styles.emptyTxt}>Todos os produtos foram removidos</Text>
          </Card>
        )}

        {produtos.map(p => {
          const tipoInfo = TIPO_LABELS[p.tipoSugerido] || TIPO_LABELS.desconhecido;
          const unidades = UNIDADES_POR_TIPO[p.tipoSugerido] || UNIDADES_POR_TIPO.desconhecido;
          return (
            <Card key={p.uid} style={styles.produtoCard}>
              {/* Linha superior: tipo + remover */}
              <View style={styles.produtoTop}>
                <View style={[styles.tipoBadge, { backgroundColor: tipoInfo.cor + '20' }]}>
                  <Text style={[styles.tipoBadgeTxt, { color: tipoInfo.cor }]}>{tipoInfo.label}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  {/* Seletor de tipo */}
                  <View style={styles.tipoSeletorRow}>
                    {Object.entries(TIPO_LABELS).filter(([k]) => k !== 'desconhecido').map(([k, v]) => (
                      <TouchableOpacity
                        key={k}
                        style={[styles.tipoSeletorBtn, p.tipoSugerido === k && { backgroundColor: v.cor }]}
                        onPress={() => atualizarProduto(p.uid, 'tipoSugerido', k)}
                      >
                        <Text style={[styles.tipoSeletorTxt, p.tipoSugerido === k && { color: '#fff' }]}>{v.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity onPress={() => removerProduto(p.uid)}>
                    <Ionicons name="trash-outline" size={20} color={DANGER} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Nome */}
              <Text style={styles.fieldLabel}>Nome do produto</Text>
              <TextInput
                style={styles.nomeInput}
                value={p.nome}
                onChangeText={v => atualizarProduto(p.uid, 'nome', v)}
                placeholder="Nome do produto"
                placeholderTextColor="#9CA3AF"
              />

              {/* Quantidade + unidade */}
              <View style={styles.qtdRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Quantidade</Text>
                  <TextInput
                    style={styles.qtdInput}
                    value={String(p.quantidade)}
                    onChangeText={v => atualizarProduto(p.uid, 'quantidade', v)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Unidade</Text>
                  <View style={styles.unidadeRow}>
                    {unidades.map(u => (
                      <TouchableOpacity
                        key={u}
                        style={[styles.unidadeBtn, p.unidade === u && styles.unidadeBtnAtivo]}
                        onPress={() => atualizarProduto(p.uid, 'unidade', u)}
                      >
                        <Text style={[styles.unidadeTxt, p.unidade === u && styles.unidadeTxtAtivo]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </Card>
          );
        })}
      </ScrollView>

      {produtos.length > 0 && (
        <View style={styles.bottomBar}>
          <Button
            label={`Adicionar ${produtos.length} produto${produtos.length !== 1 ? 's' : ''} ao estoque`}
            onPress={adicionarTodos}
            variant="primary"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#F8F6F1' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, backgroundColor: '#F8F6F1' },
  loadingTxt: { fontFamily: 'Inter_500Medium', fontSize: 16, color: '#6B7280' },

  header: {
    backgroundColor: PRIMARY,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  voltarBtn:    { padding: 4 },
  headerTitulo: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#fff', flex: 1 },

  capturaBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  capturaTitle:       { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#1A1A1A', textAlign: 'center' },
  capturaSub:         { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  capturaBtnPrimario: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', justifyContent: 'center' },
  capturaBtnSecundario: { borderWidth: 2, borderColor: PRIMARY, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', justifyContent: 'center' },
  capturaBtnTxt:      { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#fff' },
  capturaAviso:       { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 16, marginTop: 8 },

  emptyCard: { alignItems: 'center', gap: 8, padding: 24 },
  emptyTxt:  { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#6B7280' },

  produtoCard: { padding: 14, gap: 10 },
  produtoTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tipoBadge:   { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  tipoBadgeTxt:{ fontFamily: 'Inter_700Bold', fontSize: 12 },

  tipoSeletorRow: { flexDirection: 'row', gap: 4 },
  tipoSeletorBtn: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#F3F4F6' },
  tipoSeletorTxt: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#6B7280' },

  fieldLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#6B7280', marginBottom: 4 },
  nomeInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#1A1A1A',
    backgroundColor: '#F9FAFB',
  },

  qtdRow:   { flexDirection: 'row', gap: 12 },
  qtdInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#1A1A1A',
    backgroundColor: '#F9FAFB',
  },
  unidadeRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  unidadeBtn:       { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent' },
  unidadeBtnAtivo:  { backgroundColor: PRIMARY + '18', borderColor: PRIMARY },
  unidadeTxt:       { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#6B7280' },
  unidadeTxtAtivo:  { color: PRIMARY, fontFamily: 'Inter_700Bold' },

  bottomBar: { padding: 16, paddingBottom: 32, backgroundColor: '#F8F6F1', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
});
