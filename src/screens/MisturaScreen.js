import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Share,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStorage } from '../storage/StorageContext';
import {
  calcularPhIdeal,
  verificarIncompatibilidades,
  calcularOrdemMistura,
  CATEGORIAS_INFO,
} from '../data/incompatibilidades';
import Card from '../components/Card';
import Button from '../components/Button';
import SectionHeader from '../components/SectionHeader';
import Input from '../components/Input';

const PRIMARY = '#1B4332';

const PRESETS_TANQUE = [
  { label: '20 L\ncostal', valor: 20 },
  { label: '400 L',        valor: 400 },
  { label: '600 L',        valor: 600 },
  { label: '800 L',        valor: 800 },
  { label: '1200 L',       valor: 1200 },
  { label: '2000 L',       valor: 2000 },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function dataParaISO(dataBR) {
  const [dia, mes, ano] = dataBR.split('/');
  const d = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function formatarDataInput(text) {
  const nums = text.replace(/\D/g, '').slice(0, 8);
  if (nums.length <= 2) return nums;
  if (nums.length <= 4) return nums.slice(0, 2) + '/' + nums.slice(2);
  return nums.slice(0, 2) + '/' + nums.slice(2, 4) + '/' + nums.slice(4);
}

// ─── Item de produto selecionável ────────────────────────────────────────────

function ItemProduto({ produto, selecionado, onToggle }) {
  return (
    <TouchableOpacity
      style={[styles.itemProduto, selecionado && { borderColor: produto.cor, backgroundColor: produto.cor + '12' }]}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      <View style={[styles.checkBox, selecionado && { backgroundColor: produto.cor, borderColor: produto.cor }]}>
        {selecionado && <Ionicons name="checkmark" size={13} color="#fff" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemNome}>{produto.nome}</Text>
        <Text style={styles.itemInfo}>{produto.quantidade} {produto.unidade}  ·  {produto.categoriaLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────

export default function MisturaScreen() {
  const { liquidos, talhoes, adicionarRegistroTalhao } = useStorage();

  const [selecionados, setSelecionados]         = useState({});
  const [mostrarResultado, setMostrarResultado] = useState(false);
  const [volTanque, setVolTanque]               = useState('');
  const [volHa, setVolHa]                       = useState('');
  const [areaHa, setAreaHa]                     = useState('');
  const [doses, setDoses]                       = useState({});

  // Erros de validação inline
  const [erroTanque, setErroTanque] = useState('');
  const [erroCalda, setErroCalda]   = useState('');

  // Modal registrar no talhão
  const [modalTalhao, setModalTalhao]       = useState(false);
  const [talhaoSelecionadoId, setTalhaoId]  = useState('');
  const [dataAplicacao, setDataAplicacao]   = useState('');
  const [obsAplicacao, setObsAplicacao]     = useState('');

  const todosProdutos = useMemo(() => {
    const lista = [];
    for (const [cat, produtos] of Object.entries(liquidos)) {
      const catInfo = CATEGORIAS_INFO[cat];
      for (const p of produtos) {
        lista.push({
          id: `${cat}_${p.id}`,
          nome: p.nome,
          quantidade: p.quantidade,
          unidade: p.unidade,
          categoria: cat,
          categoriaLabel: catInfo?.label ?? cat,
          cor: catInfo?.cor ?? '#888',
        });
      }
    }
    return lista;
  }, [liquidos]);

  const produtosSelecionados = useMemo(
    () => todosProdutos.filter(p => selecionados[p.id]),
    [todosProdutos, selecionados]
  );

  function toggleProduto(id) {
    setSelecionados(prev => ({ ...prev, [id]: !prev[id] }));
    setMostrarResultado(false);
  }

  function setDoseProduto(id, campo, valor) {
    setDoses(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }));
    setMostrarResultado(false);
  }

  function calcular() {
    if (produtosSelecionados.length < 1) return;

    let hasError = false;
    if (volTanque !== '') {
      const v = parseFloat(volTanque.replace(',', '.'));
      if (isNaN(v) || v <= 0) { setErroTanque('Informe um valor maior que zero.'); hasError = true; }
      else setErroTanque('');
    }
    if (volHa !== '') {
      const v = parseFloat(volHa.replace(',', '.'));
      if (isNaN(v) || v <= 0) { setErroCalda('Informe um valor maior que zero.'); hasError = true; }
      else setErroCalda('');
    }
    if (!hasError) setMostrarResultado(true);
  }

  function confirmarLimpar() {
    Alert.alert(
      'Limpar mistura',
      'Deseja limpar todos os produtos e parâmetros selecionados?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Limpar', style: 'destructive', onPress: limpar },
      ]
    );
  }

  function limpar() {
    setSelecionados({});
    setMostrarResultado(false);
    setDoses({});
    setVolTanque('');
    setVolHa('');
    setAreaHa('');
    setErroTanque('');
    setErroCalda('');
  }

  const parametrosCalda = useMemo(() => {
    const tanque = parseFloat(volTanque.replace(',', '.'));
    const calda  = parseFloat(volHa.replace(',', '.'));
    const area   = parseFloat(areaHa.replace(',', '.'));
    if (!tanque || !calda || tanque <= 0 || calda <= 0) return null;
    const numTanques = !isNaN(area) && area > 0 ? (area * calda) / tanque : null;
    const dosesPorTanque = produtosSelecionados.map(p => {
      const d = doses[p.id];
      const doseVal = d ? parseFloat((d.dose || '').replace(',', '.')) : NaN;
      const unidade = d?.unidade ?? p.unidade ?? 'L';
      if (isNaN(doseVal) || doseVal <= 0) return { ...p, doseTanque: null, doseHa: null, unidade };
      return { ...p, doseHa: doseVal, doseTanque: Math.round((doseVal / calda) * tanque * 100) / 100, unidade };
    });
    return { tanque, calda, area: isNaN(area) ? null : area, numTanques, dosesPorTanque };
  }, [volTanque, volHa, areaHa, produtosSelecionados, doses]);

  const resultado = useMemo(() => {
    if (!mostrarResultado || produtosSelecionados.length === 0) return null;
    return {
      ordem: calcularOrdemMistura(produtosSelecionados),
      incompatibilidades: verificarIncompatibilidades(produtosSelecionados),
      ph: calcularPhIdeal(produtosSelecionados),
      calda: parametrosCalda,
    };
  }, [mostrarResultado, produtosSelecionados, parametrosCalda]);

  async function compartilharReceita() {
    if (!resultado) return;
    const data = new Date().toLocaleDateString('pt-BR');
    let texto = `🌱 RECEITA DE CALDA — Montico Farm Pro\n📅 ${data}\n\n`;
    if (resultado.calda) {
      const c = resultado.calda;
      texto += `⚙️ PARÂMETROS DO TANQUE\n`;
      texto += `• Volume do tanque: ${c.tanque} L\n• Volume de calda: ${c.calda} L/ha\n`;
      if (c.area) texto += `• Área a tratar: ${c.area} ha\n`;
      if (c.numTanques) texto += `• Número de tanques: ${c.numTanques.toFixed(1)}\n`;
      texto += '\n';
    }
    texto += `📦 PRODUTOS E DOSES\n`;
    for (const p of produtosSelecionados) {
      const dp = resultado.calda?.dosesPorTanque?.find(d => d.id === p.id);
      texto += dp?.doseTanque
        ? `• ${p.nome}: ${dp.doseHa} ${dp.unidade}/ha → ${dp.doseTanque} ${dp.unidade}/tanque\n`
        : `• ${p.nome}\n`;
    }
    texto += `\n💧 pH IDEAL: ${resultado.ph.ideal.toFixed(1)} (faixa: ${resultado.ph.min.toFixed(1)}–${resultado.ph.max.toFixed(1)})\n`;
    if (resultado.incompatibilidades.length > 0) {
      texto += `\n⚠️ INCOMPATIBILIDADES:\n`;
      for (const inc of resultado.incompatibilidades) {
        texto += `${inc.nivel === 'grave' ? '⛔' : '⚠️'} ${inc.mensagem}\n`;
      }
    }
    texto += `\n📋 ORDEM DE ADIÇÃO\n`;
    for (const inst of resultado.ordem) texto += `${inst.passo}. ${inst.acao}\n`;
    texto += '\n— Montico Farm Pro';
    await Share.share({ message: texto, title: 'Receita de Calda' });
  }

  function abrirModalTalhao() {
    const hoje = new Date();
    setDataAplicacao(
      `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`
    );
    setTalhaoId(talhoes.length > 0 ? talhoes[0].id : '');
    setObsAplicacao('');
    setModalTalhao(true);
  }

  async function salvarAplicacaoNoTalhao() {
    if (!talhaoSelecionadoId || !dataAplicacao || dataAplicacao.length < 10) {
      Alert.alert('Atenção', 'Selecione o talhão e informe a data completa.');
      return;
    }
    const talhao = talhoes.find(t => t.id === talhaoSelecionadoId);
    const nomesProdutos = produtosSelecionados.map(p => p.nome).join(' + ');
    const descricao = parametrosCalda
      ? `${nomesProdutos} — ${parametrosCalda.calda} L/ha em tanque de ${parametrosCalda.tanque} L${obsAplicacao ? '\n' + obsAplicacao : ''}`
      : `${nomesProdutos}${obsAplicacao ? '\n' + obsAplicacao : ''}`;
    await adicionarRegistroTalhao(talhaoSelecionadoId, {
      tipo: 'aplicacao',
      data: dataParaISO(dataAplicacao),
      descricao,
      produtos: produtosSelecionados.map(p => p.nome),
      calda: parametrosCalda,
      observacao: obsAplicacao,
    });
    setModalTalhao(false);
    setTalhaoId('');
    setDataAplicacao('');
    setObsAplicacao('');
    Alert.alert('Aplicação registrada', `Salvo no talhão "${talhao.nome}" com sucesso.`, [{ text: 'OK' }]);
  }

  const categorias = ['herbicidas', 'fungicidas', 'inseticidas', 'adjuvantes', 'foliares'];
  const mostrarCalda = produtosSelecionados.length > 0;
  const mostrarDoses = mostrarCalda && volTanque !== '' && volHa !== '';

  return (
    <View style={styles.root}>
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Seleção de produtos ───────────────────────────────── */}
        <View style={styles.secao}>

          {/* Header com contador — Parte 3.3 */}
          <View style={styles.secaoHeaderRow}>
            <Text style={styles.secaoTitulo}>Selecione os produtos</Text>
            {produtosSelecionados.length > 0 && (
              <View style={styles.contadorBadge}>
                <Text style={styles.contadorTxt}>{produtosSelecionados.length}</Text>
              </View>
            )}
          </View>

          {todosProdutos.length === 0 && (
            <Card style={styles.avisoCard}>
              <Ionicons name="flask-outline" size={32} color="#D1D5DB" />
              <Text style={styles.avisoTxt}>
                Nenhum produto cadastrado ainda.{'\n'}Adicione na aba Estoque.
              </Text>
            </Card>
          )}

          {categorias.map(cat => {
            const prods = todosProdutos.filter(p => p.categoria === cat);
            if (prods.length === 0) return null;
            const catInfo = CATEGORIAS_INFO[cat];
            return (
              <View key={cat} style={{ gap: 6 }}>
                <Text style={[styles.catHeader, { color: catInfo.cor }]}>{catInfo.label}</Text>
                {prods.map(p => (
                  <ItemProduto
                    key={p.id}
                    produto={p}
                    selecionado={!!selecionados[p.id]}
                    onToggle={() => toggleProduto(p.id)}
                  />
                ))}
              </View>
            );
          })}
        </View>

        {/* ── Parâmetros da calda ───────────────────────────────── */}
        {mostrarCalda && (
          <View style={styles.secao}>
            <SectionHeader title="Parâmetros da calda" />
            <Card style={{ padding: 16, gap: 12 }}>
              {/* Presets tanque */}
              <Text style={styles.fieldLabel}>Volume do tanque</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {PRESETS_TANQUE.map(p => (
                  <TouchableOpacity
                    key={p.valor}
                    style={[styles.presetBtn, volTanque === String(p.valor) && styles.presetBtnAtivo]}
                    onPress={() => { setVolTanque(String(p.valor)); setMostrarResultado(false); setErroTanque(''); }}
                  >
                    <Text style={[styles.presetTxt, volTanque === String(p.valor) && styles.presetTxtAtivo]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput
                style={[styles.input, erroTanque ? styles.inputErro : null]}
                placeholder="Ou digite o volume (L)"
                value={volTanque}
                onChangeText={v => { setVolTanque(v); setMostrarResultado(false); if (erroTanque) setErroTanque(''); }}
                keyboardType="decimal-pad"
                placeholderTextColor="#9CA3AF"
              />
              {!!erroTanque && <Text style={styles.erroTxt}>{erroTanque}</Text>}

              <Text style={styles.fieldLabel}>Volume de calda (L/ha)</Text>
              <TextInput
                style={[styles.input, erroCalda ? styles.inputErro : null]}
                placeholder="Ex: 200"
                value={volHa}
                onChangeText={v => { setVolHa(v); setMostrarResultado(false); if (erroCalda) setErroCalda(''); }}
                keyboardType="decimal-pad"
                placeholderTextColor="#9CA3AF"
              />
              {!!erroCalda && <Text style={styles.erroTxt}>{erroCalda}</Text>}

              <Text style={styles.fieldLabel}>Área a tratar — opcional (ha)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 10"
                value={areaHa}
                onChangeText={v => { setAreaHa(v); setMostrarResultado(false); }}
                keyboardType="decimal-pad"
                placeholderTextColor="#9CA3AF"
              />

              {/* Doses por produto */}
              {mostrarDoses && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Dose por produto</Text>
                  {produtosSelecionados.map(p => {
                    const d = doses[p.id] ?? {};
                    const unidade = d.unidade ?? p.unidade ?? 'L';
                    return (
                      <View key={p.id} style={styles.doseRow}>
                        <View style={[styles.doseColorDot, { backgroundColor: p.cor }]} />
                        <Text style={styles.doseNome} numberOfLines={1}>{p.nome}</Text>
                        <TextInput
                          style={styles.doseInput}
                          placeholder="Dose"
                          value={d.dose ?? ''}
                          onChangeText={v => setDoseProduto(p.id, 'dose', v)}
                          keyboardType="decimal-pad"
                          placeholderTextColor="#9CA3AF"
                        />
                        <TouchableOpacity
                          style={[styles.doseUnidadeBtn, { backgroundColor: p.cor }]}
                          onPress={() => setDoseProduto(p.id, 'unidade', unidade === 'L' ? 'kg' : 'L')}
                        >
                          <Text style={styles.doseUnidadeTxt}>{unidade}/ha</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </>
              )}
            </Card>
          </View>
        )}

        {/* ── Botões ───────────────────────────────────────────── */}
        {todosProdutos.length > 0 && (
          <View style={styles.botoesRow}>
            <Button label="Limpar" onPress={confirmarLimpar} variant="secondary" style={{ flex: 1 }} />
            <Button
              label={`Calcular (${produtosSelecionados.length})`}
              onPress={calcular}
              variant="primary"
              icon="flask"
              disabled={produtosSelecionados.length === 0}
              style={{ flex: 2, opacity: produtosSelecionados.length === 0 ? 0.4 : 1 }}
            />
          </View>
        )}

        {/* ── Botão registrar no talhão — Parte 2 ─────────────── */}
        {resultado !== null && talhoes.length > 0 && (
          <TouchableOpacity style={styles.btnRegistrarTalhao} onPress={abrirModalTalhao} activeOpacity={0.85}>
            <Ionicons name="map-outline" size={20} color="#fff" />
            <Text style={styles.btnRegistrarTalhaoTxt}>Registrar como aplicação no talhão</Text>
          </TouchableOpacity>
        )}

        {/* ── Resultados ───────────────────────────────────────── */}
        {resultado && (
          <View style={styles.secao}>
            <Button
              label="Compartilhar Receita"
              onPress={compartilharReceita}
              variant="accent"
              icon="share-social-outline"
            />

            {/* Doses por tanque */}
            {resultado.calda && (
              <Card style={{ padding: 16, gap: 10 }}>
                <View style={styles.blocoHeader}>
                  <Ionicons name="beaker-outline" size={18} color={PRIMARY} />
                  <Text style={[styles.blocoTitulo, { color: PRIMARY }]}>Dose por Tanque</Text>
                </View>
                <View style={styles.metricsRow}>
                  <View style={[styles.metricBox, { backgroundColor: PRIMARY + '12' }]}>
                    <Text style={[styles.metricValor, { color: PRIMARY }]}>{resultado.calda.tanque} L</Text>
                    <Text style={styles.metricLabel}>Tanque</Text>
                  </View>
                  <View style={[styles.metricBox, { backgroundColor: PRIMARY + '12' }]}>
                    <Text style={[styles.metricValor, { color: PRIMARY }]}>{resultado.calda.calda} L/ha</Text>
                    <Text style={styles.metricLabel}>Calda</Text>
                  </View>
                  {resultado.calda.numTanques && (
                    <View style={[styles.metricBox, { backgroundColor: PRIMARY + '12' }]}>
                      <Text style={[styles.metricValor, { color: PRIMARY }]}>{resultado.calda.numTanques.toFixed(1)}</Text>
                      <Text style={styles.metricLabel}>Tanques</Text>
                    </View>
                  )}
                </View>
                {resultado.calda.dosesPorTanque.map(dp => (
                  <View key={dp.id} style={styles.doseTanqueRow}>
                    <View style={[styles.doseTanqueBarra, { backgroundColor: dp.cor }]} />
                    <Text style={styles.doseTanqueNome}>{dp.nome}</Text>
                    {dp.doseTanque !== null ? (
                      <Text style={[styles.doseTanqueValor, { color: dp.cor }]}>
                        {dp.doseTanque} {dp.unidade}
                      </Text>
                    ) : (
                      <Text style={styles.doseTanqueSem}>sem dose</Text>
                    )}
                  </View>
                ))}
              </Card>
            )}

            {/* Incompatibilidades */}
            {resultado.incompatibilidades.length > 0 ? (
              <Card style={{ padding: 16, gap: 8 }}>
                <View style={styles.blocoHeader}>
                  <Ionicons name="warning" size={18} color="#C0392B" />
                  <Text style={[styles.blocoTitulo, { color: '#C0392B' }]}>Incompatibilidades</Text>
                </View>
                {resultado.incompatibilidades.map((inc, i) => (
                  <View key={i} style={[styles.incCard, { borderLeftColor: inc.nivel === 'grave' ? '#C0392B' : '#D97706' }]}>
                    <Text style={[styles.incNivel, { color: inc.nivel === 'grave' ? '#C0392B' : '#D97706' }]}>
                      {inc.nivel === 'grave' ? '⛔ GRAVE' : '⚠️ ATENÇÃO'}
                    </Text>
                    <Text style={styles.incMensagem}>{inc.mensagem}</Text>
                  </View>
                ))}
              </Card>
            ) : (
              <Card style={[styles.compatCard]}>
                <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
                <Text style={styles.compatTxt}>Nenhuma incompatibilidade detectada</Text>
              </Card>
            )}

            {/* pH */}
            <Card style={{ padding: 16, gap: 10 }}>
              <View style={styles.blocoHeader}>
                <Ionicons name="water" size={18} color={PRIMARY} />
                <Text style={[styles.blocoTitulo, { color: PRIMARY }]}>pH da Água</Text>
              </View>
              <View style={styles.phRow}>
                <View style={styles.phBox}>
                  <Text style={styles.phLabel}>Mínimo</Text>
                  <Text style={[styles.phValor, { color: PRIMARY }]}>{resultado.ph.min.toFixed(1)}</Text>
                </View>
                <View style={[styles.phBox, styles.phIdealBox]}>
                  <Text style={[styles.phLabel, { color: 'rgba(255,255,255,0.8)' }]}>Ideal</Text>
                  <Text style={[styles.phValor, { color: '#fff', fontSize: 26 }]}>{resultado.ph.ideal.toFixed(1)}</Text>
                </View>
                <View style={styles.phBox}>
                  <Text style={styles.phLabel}>Máximo</Text>
                  <Text style={[styles.phValor, { color: PRIMARY }]}>{resultado.ph.max.toFixed(1)}</Text>
                </View>
              </View>
              {resultado.ph.obs.map((o, i) => (
                <Text key={i} style={styles.phObs}>• {o}</Text>
              ))}
            </Card>

            {/* Ordem */}
            <Card style={{ padding: 16, gap: 10 }}>
              <View style={styles.blocoHeader}>
                <Ionicons name="list-outline" size={18} color={PRIMARY} />
                <Text style={[styles.blocoTitulo, { color: PRIMARY }]}>Ordem de Adição</Text>
              </View>
              {resultado.ordem.map((inst, i) => (
                <View key={i} style={styles.ordemItem}>
                  <View style={styles.ordemNum}>
                    <Text style={styles.ordemNumTxt}>{inst.passo}</Text>
                  </View>
                  <Text style={styles.ordemAcao}>{inst.acao}</Text>
                </View>
              ))}
            </Card>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Modal registrar no talhão ─────────────────────────── */}
      <Modal visible={modalTalhao} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalBox}>
            <Text style={styles.modalTitulo}>Registrar aplicação</Text>

            <Text style={styles.fieldLabel}>Talhão</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {talhoes.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.talhaoChip, talhaoSelecionadoId === t.id && styles.talhaoChipAtivo]}
                  onPress={() => setTalhaoId(t.id)}
                >
                  <Text style={[styles.talhaoChipTxt, talhaoSelecionadoId === t.id && styles.talhaoChipTxtAtivo]}>
                    {t.nome}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Input
              label="Data (DD/MM/AAAA)"
              value={dataAplicacao}
              onChangeText={t => setDataAplicacao(formatarDataInput(t))}
              placeholder="Ex: 15/03/2026"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              autoCapitalize="none"
              thousands={false}
            />
            <Input
              label="Observação (opcional)"
              value={obsAplicacao}
              onChangeText={setObsAplicacao}
              placeholder="Ex: Clima nublado, umidade 70%"
              multiline
            />

            <View style={styles.modalAcoes}>
              <Button label="Cancelar" onPress={() => setModalTalhao(false)} variant="secondary" style={{ flex: 1 }} />
              <Button label="Salvar aplicação" onPress={salvarAplicacaoNoTalhao} variant="primary" style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F6F1' },
  secao: { padding: 16, gap: 12 },

  // Section header com contador
  secaoHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  secaoTitulo: { fontFamily: 'Inter_700Bold', fontSize: 16, color: PRIMARY },
  contadorBadge: { backgroundColor: PRIMARY, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  contadorTxt: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#fff' },

  // Aviso vazio
  avisoCard: { alignItems: 'center', padding: 32, gap: 10 },
  avisoTxt: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },

  // Categoria
  catHeader: { fontFamily: 'Inter_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },

  // Item produto
  itemProduto: {
    backgroundColor: '#fff', borderRadius: 14, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  checkBox: {
    width: 24, height: 24, borderRadius: 7,
    borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  itemNome: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#1A1A1A' },
  itemInfo: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  // Calda form
  fieldLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    fontFamily: 'Inter_400Regular', fontSize: 15, color: '#1A1A1A',
    backgroundColor: '#FAFAF8',
  },
  inputErro: { borderColor: '#C0392B' },
  erroTxt: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#C0392B', marginTop: -6 },

  presetBtn: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff', minWidth: 56, alignItems: 'center',
  },
  presetBtnAtivo: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  presetTxt: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#6B7280', textAlign: 'center' },
  presetTxtAtivo: { color: '#fff' },

  // Dose row
  doseRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doseColorDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  doseNome: { fontFamily: 'Inter_500Medium', flex: 1, fontSize: 13, color: '#374151' },
  doseInput: {
    width: 72, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 7, fontFamily: 'Inter_400Regular',
    fontSize: 14, textAlign: 'right', backgroundColor: '#FAFAF8', color: '#1A1A1A',
  },
  doseUnidadeBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  doseUnidadeTxt: { fontFamily: 'Inter_700Bold', color: '#fff', fontSize: 12 },

  // Botões
  botoesRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 4 },

  // Botão registrar no talhão
  btnRegistrarTalhao: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
  },
  btnRegistrarTalhaoTxt: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#fff' },

  // Resultado blocos
  blocoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  blocoTitulo: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#1A1A1A' },

  metricsRow: { flexDirection: 'row', gap: 8 },
  metricBox: { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  metricValor: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  metricLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#6B7280', marginTop: 2 },

  doseTanqueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  doseTanqueBarra: { width: 4, height: 28, borderRadius: 2 },
  doseTanqueNome: { fontFamily: 'Inter_500Medium', flex: 1, fontSize: 13, color: '#374151' },
  doseTanqueValor: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  doseTanqueSem: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#D1D5DB', fontStyle: 'italic' },

  incCard: { borderLeftWidth: 4, paddingLeft: 12, paddingVertical: 8 },
  incNivel: { fontFamily: 'Inter_700Bold', fontSize: 12, marginBottom: 3 },
  incMensagem: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#374151', lineHeight: 18 },

  compatCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: '#D1FAE5' },
  compatTxt: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#065F46' },

  phRow: { flexDirection: 'row', gap: 8 },
  phBox: { flex: 1, alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 12 },
  phIdealBox: { backgroundColor: PRIMARY, flex: 1.4 },
  phLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase' },
  phValor: { fontFamily: 'Inter_700Bold', fontSize: 20, marginTop: 4 },
  phObs: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6B7280', lineHeight: 17 },

  ordemItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ordemNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ordemNumTxt: { fontFamily: 'Inter_700Bold', color: '#fff', fontSize: 13 },
  ordemAcao: { fontFamily: 'Inter_400Regular', flex: 1, fontSize: 14, color: '#374151', lineHeight: 20, paddingTop: 4 },

  // Modal registrar aplicação
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 12,
  },
  modalTitulo: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#1A1A1A', marginBottom: 4 },
  modalAcoes: { flexDirection: 'row', gap: 10, marginTop: 4 },

  // Chips de talhão
  talhaoChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff',
  },
  talhaoChipAtivo: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  talhaoChipTxt: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#6B7280' },
  talhaoChipTxtAtivo: { color: '#fff' },
});
