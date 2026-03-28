import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStorage } from '../storage/StorageContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import SectionHeader from '../components/SectionHeader';

const PRIMARY       = '#1B4332';
const DANGER        = '#C0392B';
const SACOS_PARA_KG = 60;

const GRAOS_NOMES = ['soja', 'milho', 'trigo', 'feijão', 'feijao'];

const CULTURAS_INFO = {
  soja:   { cor: '#84CC16', icone: 'leaf' },
  milho:  { cor: '#F59E0B', icone: 'sunny' },
  trigo:  { cor: '#D97706', icone: 'albums-outline' },
  'feijão': { cor: '#A16207', icone: 'egg-outline' },
  feijao: { cor: '#A16207', icone: 'egg-outline' },
  couve:  { cor: '#16A34A', icone: 'flower-outline' },
};

function getCulturaInfo(nome) {
  return CULTURAS_INFO[nome.toLowerCase()] || { cor: '#6B7280', icone: 'leaf-outline' };
}

function isGrao(nome) {
  return GRAOS_NOMES.includes(nome.toLowerCase());
}

function formatarDataInput(texto) {
  const digits = texto.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
}

function formatarData(isoString) {
  return new Date(isoString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataHoje() {
  const hoje = new Date();
  return `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
}

// ─── ColheitaGraosDetalhe ──────────────────────────────────────────────────

function ColheitaGraosDetalhe({ talhao, cultura, corCultura, onVoltar }) {
  const {
    adicionarRegistroColheita, removerRegistroColheita,
    marcarColheitaConcluida, atualizarPrecoColheita,
    adubos, liquidos,
  } = useStorage();

  const colheita = cultura.colheita || { registros: [], concluida: false, precoVendaSaco: null };
  const registros = colheita.registros || [];

  const [modalVisible, setModalVisible]   = useState(false);
  const [unidade, setUnidade]             = useState('sacos');
  const [quantidade, setQuantidade]       = useState('');
  const [dataTexto, setDataTexto]         = useState('');
  const [modalPreco, setModalPreco]       = useState(false);
  const [precoTemp, setPrecoTemp]         = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const totalSacos = registros.reduce((s, r) => s + (r.sacos || 0), 0);
  const totalKg    = totalSacos * SACOS_PARA_KG;

  const custoTotal = (() => {
    let total = 0;
    for (const r of (cultura.registros || [])) {
      for (const p of (r.produtosUsados || [])) {
        if (p.tipo === 'adubo') {
          const a = adubos.find(x => x.id === p.id);
          if (a?.custoPorUnidade) total += a.custoPorUnidade * p.quantidade;
        } else if (p.tipo === 'liquido') {
          const cat = liquidos[p.categoria] || [];
          const prod = cat.find(x => x.id === p.id);
          if (prod?.custoPorUnidade) total += prod.custoPorUnidade * p.quantidade;
        }
      }
    }
    return total;
  })();

  const receita = colheita.precoVendaSaco ? totalSacos * colheita.precoVendaSaco : null;
  const lucro   = receita !== null ? receita - custoTotal : null;

  function abrirModal() {
    setDataTexto(dataHoje());
    setQuantidade('');
    setUnidade('sacos');
    setModalVisible(true);
  }

  async function salvar() {
    const qtd = parseFloat(quantidade.replace(',', '.'));
    if (isNaN(qtd) || qtd <= 0) { Alert.alert('Informe a quantidade'); return; }
    const [dia, mes, ano] = dataTexto.split('/');
    const dataObj = new Date(Number(ano), Number(mes) - 1, Number(dia));
    const dataISO = !isNaN(dataObj.getTime()) ? dataObj.toISOString() : new Date().toISOString();
    const sacos = unidade === 'sacos' ? qtd : qtd / SACOS_PARA_KG;
    await adicionarRegistroColheita(talhao.id, cultura.id, { data: dataISO, sacos, quilos: sacos * SACOS_PARA_KG });
    setModalVisible(false);
  }

  async function salvarPreco() {
    const preco = parseFloat(precoTemp.replace(',', '.'));
    await atualizarPrecoColheita(talhao.id, cultura.id, isNaN(preco) || preco <= 0 ? null : preco);
    setModalPreco(false);
  }

  const qtdInput = parseFloat(quantidade.replace(',', '.'));
  const calculado = !isNaN(qtdInput) && qtdInput > 0
    ? (unidade === 'sacos'
        ? `= ${(qtdInput * SACOS_PARA_KG).toLocaleString('pt-BR')} kg`
        : `= ${(qtdInput / SACOS_PARA_KG).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} sacos`)
    : null;

  return (
    <View style={styles.root}>
      <View style={[styles.detalheHeader, { backgroundColor: corCultura }]}>
        <TouchableOpacity onPress={onVoltar} style={styles.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.detalheSubtitulo}>{talhao.nome}</Text>
          <Text style={styles.detalheTitulo}>{cultura.nome} — Colheita</Text>
        </View>
        {colheita.concluida && (
          <View style={styles.concluidaBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
            <Text style={styles.concluidaTxt}>Concluída</Text>
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Resumo */}
        <View style={styles.resumoGrid}>
          <View style={[styles.resumoCard, { borderLeftColor: corCultura }]}>
            <Text style={styles.resumoLabel}>Total Sacos</Text>
            <Text style={styles.resumoValor}>{totalSacos.toLocaleString('pt-BR')}</Text>
            <Text style={styles.resumoSub}>sc de 60 kg</Text>
          </View>
          <View style={[styles.resumoCard, { borderLeftColor: '#6B7280' }]}>
            <Text style={styles.resumoLabel}>Total KG</Text>
            <Text style={styles.resumoValor}>{totalKg.toLocaleString('pt-BR')}</Text>
            <Text style={styles.resumoSub}>quilogramas</Text>
          </View>
          <View style={[styles.resumoCard, { borderLeftColor: '#D97706' }]}>
            <Text style={styles.resumoLabel}>Custo</Text>
            <Text style={[styles.resumoValor, { fontSize: 14 }]}>{custoTotal > 0 ? formatMoeda(custoTotal) : '—'}</Text>
            <Text style={styles.resumoSub}>produtos usados</Text>
          </View>
          <View style={[styles.resumoCard, { borderLeftColor: lucro !== null ? (lucro >= 0 ? '#16A34A' : DANGER) : '#E5E7EB' }]}>
            <Text style={styles.resumoLabel}>Lucro</Text>
            <Text style={[styles.resumoValor, { fontSize: 14, color: lucro !== null ? (lucro >= 0 ? '#16A34A' : DANGER) : '#9CA3AF' }]}>
              {lucro !== null ? formatMoeda(lucro) : '—'}
            </Text>
            <Text style={styles.resumoSub}>{receita !== null ? `Rec: ${formatMoeda(receita)}` : 'sem preço'}</Text>
          </View>
        </View>

        {/* Ações */}
        <View style={styles.acoesRow}>
          <TouchableOpacity
            style={styles.acaoBtn}
            onPress={() => {
              setPrecoTemp(colheita.precoVendaSaco ? String(colheita.precoVendaSaco).replace('.', ',') : '');
              setModalPreco(true);
            }}
          >
            <Ionicons name="cash-outline" size={18} color={PRIMARY} />
            <Text style={styles.acaoBtnTxt}>
              {colheita.precoVendaSaco ? `R$ ${colheita.precoVendaSaco}/sc` : 'Definir preço/saco'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acaoBtn, colheita.concluida && styles.acaoBtnConcluida]}
            onPress={() => marcarColheitaConcluida(talhao.id, cultura.id, !colheita.concluida)}
          >
            <Ionicons name={colheita.concluida ? 'checkmark-circle' : 'checkmark-circle-outline'} size={18} color={colheita.concluida ? '#fff' : PRIMARY} />
            <Text style={[styles.acaoBtnTxt, colheita.concluida && { color: '#fff' }]}>
              {colheita.concluida ? 'Colheita concluída' : 'Marcar como concluída'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.secao}>
          <SectionHeader title={`Registros (${registros.length})`} />
          {registros.length === 0 && (
            <Card style={styles.emptyCard}>
              <Ionicons name="basket-outline" size={32} color="#D1D5DB" />
              <Text style={styles.emptyTxt}>Nenhum registro de colheita</Text>
              <Text style={styles.emptySub}>Toque em + para adicionar</Text>
            </Card>
          )}
          {registros.map((r, idx) => (
            <View key={r.id} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineDot, { backgroundColor: corCultura }]}>
                  <Ionicons name="basket-outline" size={13} color="#fff" />
                </View>
                {idx < registros.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <Card style={styles.registroCard}>
                <View style={styles.registroTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.registroTitulo}>{r.sacos?.toLocaleString('pt-BR')} sc  ·  {(r.sacos * SACOS_PARA_KG).toLocaleString('pt-BR')} kg</Text>
                    {colheita.precoVendaSaco ? (
                      <Text style={[styles.registroSub, { color: '#16A34A' }]}>
                        {formatMoeda(r.sacos * colheita.precoVendaSaco)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.registroData}>{formatarData(r.data)}</Text>
                </View>
                <View style={styles.registroAcoes}>
                  <TouchableOpacity onPress={() => setPendingDelete(r.id)} style={{ padding: 10 }}>
                    <Ionicons name="trash-outline" size={20} color={DANGER} />
                  </TouchableOpacity>
                </View>
              </Card>
            </View>
          ))}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { backgroundColor: corCultura }]} onPress={abrirModal} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal novo registro */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Nova Colheita — {cultura.nome}</Text>
            <Input label="Data (DD/MM/AAAA)" value={dataTexto} onChangeText={t => setDataTexto(formatarDataInput(t))} keyboardType="numeric" placeholder="Ex: 14/03/2026" maxLength={10} />
            <Text style={styles.fieldLabel}>Registrar em</Text>
            <View style={styles.unidadeRow}>
              {[{ key: 'sacos', label: 'Sacos (60 kg)' }, { key: 'kg', label: 'Quilogramas' }].map(u => (
                <TouchableOpacity
                  key={u.key}
                  style={[styles.unidadeChip, unidade === u.key && { backgroundColor: corCultura, borderColor: corCultura }]}
                  onPress={() => setUnidade(u.key)}
                >
                  <Text style={[styles.unidadeChipTxt, unidade === u.key && { color: '#fff' }]}>{u.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Input
              label={unidade === 'sacos' ? 'Quantidade de sacos' : 'Quantidade em kg'}
              value={quantidade}
              onChangeText={setQuantidade}
              keyboardType="decimal-pad"
              thousands
              placeholder="0"
            />
            {calculado && (
              <View style={styles.calculoBox}>
                <Ionicons name="calculator-outline" size={16} color="#6B7280" />
                <Text style={styles.calculoTxt}>{calculado}</Text>
              </View>
            )}
            <View style={styles.modalAcoes}>
              <Button label="Cancelar" onPress={() => setModalVisible(false)} variant="secondary" style={{ flex: 1 }} />
              <Button label="Salvar" onPress={salvar} variant="primary" style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal preço */}
      <Modal visible={modalPreco} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Preço por saco (R$)</Text>
            <Input label="Valor por saco" value={precoTemp} onChangeText={setPrecoTemp} keyboardType="decimal-pad" placeholder="Ex: 120,00" autoFocus />
            <View style={styles.modalAcoes}>
              <Button label="Cancelar" onPress={() => setModalPreco(false)} variant="secondary" style={{ flex: 1 }} />
              <Button label="Salvar" onPress={salvarPreco} variant="primary" style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!pendingDelete} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconBox}><Ionicons name="trash-outline" size={28} color={DANGER} /></View>
            <Text style={styles.confirmTitulo}>Remover registro?</Text>
            <Text style={styles.confirmMsg}>Este registro será removido permanentemente.</Text>
            <View style={styles.confirmAcoes}>
              <TouchableOpacity style={styles.confirmBtnCancelar} onPress={() => setPendingDelete(null)}>
                <Text style={styles.confirmBtnCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtnExcluir} onPress={() => { removerRegistroColheita(talhao.id, cultura.id, pendingDelete); setPendingDelete(null); }}>
                <Text style={styles.confirmBtnExcluirTxt}>Remover</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── ColheitaCouveDetalhe ──────────────────────────────────────────────────

function ColheitaCouveDetalhe({ talhao, cultura, corCultura, onVoltar }) {
  const { adicionarRegistroColheitaCouve, removerRegistroColheitaCouve } = useStorage();

  const colheitaCouve = cultura.colheitaCouve || { registros: [] };
  const registros     = colheitaCouve.registros || [];

  const [modalVisible, setModalVisible]   = useState(false);
  const [dataTexto, setDataTexto]         = useState('');
  const [cabecas, setCabecas]             = useState('');
  const [fornecedor, setFornecedor]       = useState('');
  const [preco, setPreco]                 = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const totalCabecas = registros.reduce((s, r) => s + (r.cabecas || 0), 0);
  const totalVenda   = registros.reduce((s, r) => s + (r.preco && r.cabecas ? r.cabecas * r.preco : 0), 0);
  const temReceita   = registros.some(r => r.preco);

  function abrirModal() {
    setDataTexto(dataHoje());
    setCabecas('');
    setFornecedor('');
    setPreco('');
    setModalVisible(true);
  }

  async function salvar() {
    const qtd = parseInt(cabecas);
    if (isNaN(qtd) || qtd <= 0) { Alert.alert('Informe a quantidade de cabeças'); return; }
    const [dia, mes, ano] = dataTexto.split('/');
    const dataObj = new Date(Number(ano), Number(mes) - 1, Number(dia));
    const dataISO = !isNaN(dataObj.getTime()) ? dataObj.toISOString() : new Date().toISOString();
    const precoVal = parseFloat(preco.replace(',', '.'));
    await adicionarRegistroColheitaCouve(talhao.id, cultura.id, {
      data: dataISO,
      cabecas: qtd,
      fornecedor: fornecedor.trim(),
      preco: isNaN(precoVal) || precoVal <= 0 ? null : precoVal,
    });
    setModalVisible(false);
  }

  return (
    <View style={styles.root}>
      <View style={[styles.detalheHeader, { backgroundColor: corCultura }]}>
        <TouchableOpacity onPress={onVoltar} style={styles.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.detalheSubtitulo}>{talhao.nome}</Text>
          <Text style={styles.detalheTitulo}>Couve — Colheita</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.resumoGrid}>
          <View style={[styles.resumoCard, { borderLeftColor: corCultura }]}>
            <Text style={styles.resumoLabel}>Total Colhido</Text>
            <Text style={styles.resumoValor}>{totalCabecas.toLocaleString('pt-BR')}</Text>
            <Text style={styles.resumoSub}>cabeças de couve</Text>
          </View>
          <View style={[styles.resumoCard, { borderLeftColor: '#16A34A' }]}>
            <Text style={styles.resumoLabel}>Total Venda</Text>
            <Text style={[styles.resumoValor, { fontSize: 14, color: temReceita ? '#16A34A' : '#9CA3AF' }]}>
              {temReceita ? formatMoeda(totalVenda) : '—'}
            </Text>
            <Text style={styles.resumoSub}>soma dos registros</Text>
          </View>
        </View>

        <View style={styles.secao}>
          <SectionHeader title={`Registros (${registros.length})`} />
          {registros.length === 0 && (
            <Card style={styles.emptyCard}>
              <Ionicons name="basket-outline" size={32} color="#D1D5DB" />
              <Text style={styles.emptyTxt}>Nenhum registro de colheita</Text>
              <Text style={styles.emptySub}>Toque em + para adicionar</Text>
            </Card>
          )}
          {registros.map((r, idx) => (
            <View key={r.id} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineDot, { backgroundColor: corCultura }]}>
                  <Ionicons name="basket-outline" size={13} color="#fff" />
                </View>
                {idx < registros.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <Card style={styles.registroCard}>
                <View style={styles.registroTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.registroTitulo}>{r.cabecas?.toLocaleString('pt-BR')} cabeças</Text>
                    {r.fornecedor ? <Text style={styles.registroSub}>Fornecedor: {r.fornecedor}</Text> : null}
                    {r.preco ? (
                      <Text style={[styles.registroSub, { color: '#16A34A' }]}>
                        R$ {r.preco}/cab  ·  {formatMoeda(r.cabecas * r.preco)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.registroData}>{formatarData(r.data)}</Text>
                </View>
                <View style={styles.registroAcoes}>
                  <TouchableOpacity onPress={() => setPendingDelete(r.id)} style={{ padding: 10 }}>
                    <Ionicons name="trash-outline" size={20} color={DANGER} />
                  </TouchableOpacity>
                </View>
              </Card>
            </View>
          ))}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { backgroundColor: corCultura }]} onPress={abrirModal} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Nova Colheita — Couve</Text>
            <Input label="Data (DD/MM/AAAA)" value={dataTexto} onChangeText={t => setDataTexto(formatarDataInput(t))} keyboardType="numeric" placeholder="Ex: 14/03/2026" maxLength={10} />
            <Input label="Cabeças de couve" value={cabecas} onChangeText={setCabecas} keyboardType="number-pad" placeholder="Ex: 200" autoFocus />
            <Input label="Fornecedor / Destino" value={fornecedor} onChangeText={setFornecedor} placeholder="Ex: Mercado São Paulo" />
            <Input label="Preço por cabeça (R$)" value={preco} onChangeText={setPreco} keyboardType="decimal-pad" placeholder="Ex: 3,50 (opcional)" />
            <View style={styles.modalAcoes}>
              <Button label="Cancelar" onPress={() => setModalVisible(false)} variant="secondary" style={{ flex: 1 }} />
              <Button label="Salvar" onPress={salvar} variant="primary" style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!pendingDelete} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconBox}><Ionicons name="trash-outline" size={28} color={DANGER} /></View>
            <Text style={styles.confirmTitulo}>Remover registro?</Text>
            <Text style={styles.confirmMsg}>Este registro será removido permanentemente.</Text>
            <View style={styles.confirmAcoes}>
              <TouchableOpacity style={styles.confirmBtnCancelar} onPress={() => setPendingDelete(null)}>
                <Text style={styles.confirmBtnCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtnExcluir} onPress={() => { removerRegistroColheitaCouve(talhao.id, cultura.id, pendingDelete); setPendingDelete(null); }}>
                <Text style={styles.confirmBtnExcluirTxt}>Remover</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── ColheitaScreen ─────────────────────────────────────────────────────────

export default function ColheitaScreen() {
  const { talhoes } = useStorage();
  const [selecionado, setSelecionado] = useState(null); // { talhaoId, culturaId }

  if (selecionado) {
    const talhao  = talhoes.find(t => t.id === selecionado.talhaoId);
    const cultura = talhao?.culturas?.find(c => c.id === selecionado.culturaId);
    if (!talhao || !cultura) {
      setSelecionado(null);
      return null;
    }
    const info = getCulturaInfo(cultura.nome);
    if (isGrao(cultura.nome)) {
      return (
        <ColheitaGraosDetalhe
          talhao={talhao}
          cultura={cultura}
          corCultura={info.cor}
          onVoltar={() => setSelecionado(null)}
        />
      );
    }
    return (
      <ColheitaCouveDetalhe
        talhao={talhao}
        cultura={cultura}
        corCultura={info.cor}
        onVoltar={() => setSelecionado(null)}
      />
    );
  }

  const talhoesComCulturas = talhoes
    .map(t => ({
      ...t,
      culturas: (t.culturas || []).filter(c => {
        const n = c.nome.toLowerCase();
        return GRAOS_NOMES.includes(n) || n === 'couve';
      }),
    }))
    .filter(t => t.culturas.length > 0);

  return (
    <View style={styles.root}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {talhoesComCulturas.length === 0 && (
          <View style={styles.emptyRoot}>
            <Ionicons name="basket-outline" size={52} color="#D1D5DB" />
            <Text style={styles.emptyTxt}>Nenhum talhão disponível</Text>
            <Text style={styles.emptySub}>Cadastre talhões com Soja, Milho, Trigo, Feijão ou Couve na aba Talhão</Text>
          </View>
        )}
        {talhoesComCulturas.map(talhao => (
          <View key={talhao.id} style={styles.secao}>
            <View style={styles.talhaoHeader}>
              <Ionicons name="map-outline" size={16} color={PRIMARY} />
              <Text style={styles.talhaoNome}>{talhao.nome}</Text>
              {talhao.hectares ? <Text style={styles.talhaoHa}>{talhao.hectares} ha</Text> : null}
            </View>
            {talhao.culturas.map(cultura => {
              const info  = getCulturaInfo(cultura.nome);
              const colh  = cultura.colheita || {};
              const colhC = cultura.colheitaCouve || {};
              const totalReg   = isGrao(cultura.nome) ? (colh.registros?.length || 0) : (colhC.registros?.length || 0);
              const totalSacos = isGrao(cultura.nome) ? (colh.registros || []).reduce((s, r) => s + (r.sacos || 0), 0) : null;
              return (
                <TouchableOpacity key={cultura.id} activeOpacity={0.8} onPress={() => setSelecionado({ talhaoId: talhao.id, culturaId: cultura.id })}>
                  <Card style={[styles.culturaCard, { borderLeftColor: info.cor }]}>
                    <View style={[styles.culturaIconBox, { backgroundColor: info.cor + '22' }]}>
                      <Ionicons name={info.icone} size={22} color={info.cor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.culturaNome}>{cultura.nome}</Text>
                        {isGrao(cultura.nome) && colh.concluida && (
                          <View style={[styles.concluidaBadgeSmall, { backgroundColor: info.cor }]}>
                            <Text style={styles.concluidaTxtSmall}>Concluída</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.culturaInfo}>
                        {totalReg} registro(s)
                        {totalSacos !== null && totalSacos > 0
                          ? `  ·  ${totalSacos.toLocaleString('pt-BR')} sc  ·  ${(totalSacos * SACOS_PARA_KG).toLocaleString('pt-BR')} kg`
                          : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

// ─── estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F6F1' },
  secao: { padding: 16, gap: 12, paddingBottom: 8 },

  emptyRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12, marginTop: 80 },
  emptyCard: { alignItems: 'center', padding: 32, gap: 8 },
  emptyTxt: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#9CA3AF', textAlign: 'center' },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#D1D5DB', textAlign: 'center' },

  talhaoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
  talhaoNome: { fontFamily: 'Inter_700Bold', fontSize: 16, color: PRIMARY, flex: 1 },
  talhaoHa: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#9CA3AF' },

  culturaCard: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderLeftWidth: 4 },
  culturaIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  culturaNome: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#1A1A1A' },
  culturaInfo: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#9CA3AF', marginTop: 2 },

  concluidaBadgeSmall: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  concluidaTxtSmall: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#fff' },

  // Detalhe header
  detalheHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  voltarBtn: { padding: 4 },
  detalheSubtitulo: { fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 2 },
  detalheTitulo: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#fff' },
  concluidaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  concluidaTxt: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#fff' },

  // Resumo
  resumoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 },
  resumoCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 14, padding: 14, borderLeftWidth: 4, gap: 2 },
  resumoLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4 },
  resumoValor: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#1A1A1A' },
  resumoSub: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF' },

  // Ações
  acoesRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 4 },
  acaoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 10, backgroundColor: '#fff',
  },
  acaoBtnTxt: { fontFamily: 'Inter_500Medium', fontSize: 13, color: PRIMARY, flexShrink: 1 },
  acaoBtnConcluida: { backgroundColor: '#16A34A', borderColor: '#16A34A' },

  // Timeline
  timelineItem: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  timelineLeft: { alignItems: 'center', width: 32 },
  timelineDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#E5E7EB', marginTop: 4, minHeight: 20 },
  registroCard: { flex: 1, padding: 12, gap: 4, marginBottom: 0 },
  registroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  registroTitulo: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#1A1A1A' },
  registroSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B7280', marginTop: 2 },
  registroData: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#9CA3AF' },
  registroAcoes: { flexDirection: 'row', alignSelf: 'flex-end' },

  // Unidade chip
  unidadeRow: { flexDirection: 'row', gap: 8 },
  unidadeChip: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff',
  },
  unidadeChipTxt: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#6B7280' },

  // Cálculo
  calculoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12,
  },
  calculoTxt: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#16A34A' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitulo: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#1A1A1A', marginBottom: 4 },
  modalAcoes: { flexDirection: 'row', gap: 10, marginTop: 4 },
  fieldLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 },

  // Confirm
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  confirmBox: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', alignItems: 'center', gap: 10 },
  confirmIconBox: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  confirmTitulo: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#1A1A1A' },
  confirmMsg: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  confirmAcoes: { flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' },
  confirmBtnCancelar: { flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  confirmBtnCancelarTxt: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#6B7280' },
  confirmBtnExcluir: { flex: 1, backgroundColor: DANGER, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  confirmBtnExcluirTxt: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#fff' },

  // FAB
  fab: {
    position: 'absolute', right: 16, bottom: 24,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
});
