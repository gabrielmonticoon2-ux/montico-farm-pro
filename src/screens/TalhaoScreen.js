import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, Modal, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStorage } from '../storage/StorageContext';
import { CATEGORIAS_LIQUIDOS } from '../constants';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Input from '../components/Input';
import SectionHeader from '../components/SectionHeader';

const PRIMARY = '#1B4332';
const MARROM  = '#5D4037';
const DANGER  = '#C0392B';

const TIPOS_REGISTRO = [
  { key: 'aplicacao', label: 'Aplicação Defensivo', icone: 'flask-outline',         cor: '#1565C0' },
  { key: 'adubacao',  label: 'Adubação',            icone: 'bag-outline',           cor: '#2D6A4F' },
  { key: 'plantio',   label: 'Plantio',             icone: 'leaf-outline',          cor: '#27AE60' },
  { key: 'anotacao',  label: 'Anotação',            icone: 'document-text-outline', cor: '#6B7280' },
];

const CORES_CULTURA = ['#27AE60', '#1565C0', '#D97706', '#9B59B6', '#C0392B', '#2D6A4F'];

// Culturas que têm sementes no estoque
const CULTURAS_SEMENTES_MAP = { 'Milho': 'milho', 'Soja': 'soja', 'Feijão': 'feijao' };
// Espaçamento entre carreiros: 45 cm → 1 ha = 10000 m² → linhas por ha = 10000/0.45
const SEMENTE_FATOR_HA = 10000 / 0.45; // ≈ 22222 linhas/ha

const CULTURAS_PREDEFINIDAS = [
  { nome: 'Soja',   icone: 'leaf',          cor: '#84CC16' },
  { nome: 'Milho',  icone: 'sunny',         cor: '#F59E0B' },
  { nome: 'Trigo',  icone: 'albums-outline',cor: '#D97706' },
  { nome: 'Feijão', icone: 'egg-outline',   cor: '#A16207' },
  { nome: 'Couve',  icone: 'flower-outline',cor: '#16A34A' },
];

function formatarDataInput(texto) {
  const digits = texto.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
}

function formatarData(isoString) {
  return new Date(isoString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function tipoInfo(key) {
  return TIPOS_REGISTRO.find(t => t.key === key) || TIPOS_REGISTRO[3];
}

// ─── CulturaDetalhe ──────────────────────────────────────────────────────────

function CulturaDetalhe({ talhao, cultura, onVoltar, corCultura }) {
  const {
    adicionarRegistroCultura, removerRegistroCultura, atualizarRegistroCultura,
    adubos, liquidos, sementes, adicionarMovimentacaoAdubo, adicionarMovimentacaoLiquido,
    adicionarMovimentacaoSemente, atualizarHectaresCultura,
  } = useStorage();

  const [editandoHa, setEditandoHa]             = useState(false);
  const [haTemp, setHaTemp]                     = useState(cultura.hectares ? String(cultura.hectares) : '');
  const [pendingDelete, setPendingDelete]        = useState(null);
  const [modalVisible, setModalVisible]         = useState(false);
  const [tipoRegistro, setTipoRegistro]         = useState('aplicacao');
  const [descricao, setDescricao]               = useState('');
  const [dataTexto, setDataTexto]               = useState('');
  const [modoEdicao, setModoEdicao]             = useState(false);
  const [registroEditando, setRegistroEditando] = useState(null);
  const [produtosUsados, setProdutosUsados]     = useState([]);
  const [modalProduto, setModalProduto]         = useState(false);
  const [pendente, setPendente]                 = useState(false);

  function abrirModal() {
    setModoEdicao(false); setRegistroEditando(null);
    setDescricao(''); setProdutosUsados([]);
    const hoje = new Date();
    setDataTexto(`${String(hoje.getDate()).padStart(2,'0')}/${String(hoje.getMonth()+1).padStart(2,'0')}/${hoje.getFullYear()}`);
    setTipoRegistro('aplicacao'); setPendente(false); setModalVisible(true);
  }

  function abrirEdicao(registro) {
    setModoEdicao(true); setRegistroEditando(registro);
    setTipoRegistro(registro.tipo); setDescricao(registro.descricao);
    setProdutosUsados(registro.produtosUsados || []);
    setPendente(registro.pendente || false);
    const d = new Date(registro.data);
    setDataTexto(`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`);
    setModalVisible(true);
  }

  function fecharModal() {
    setModalVisible(false); setModoEdicao(false);
    setRegistroEditando(null); setProdutosUsados([]); setPendente(false);
  }

  function getProdutosDisponiveis() {
    const jaAdicionados = new Set(produtosUsados.map(p => p.uid));
    if (tipoRegistro === 'aplicacao') {
      const lista = [];
      for (const cat of CATEGORIAS_LIQUIDOS) {
        for (const p of (liquidos[cat.key] || [])) {
          const uid = `${cat.key}_${p.id}`;
          if (!jaAdicionados.has(uid))
            lista.push({ uid, id: p.id, nome: p.nome, unidade: p.unidade, tipo: 'liquido', categoria: cat.key, categoriaLabel: cat.label, quantidade: '', estoqueAtual: p.quantidade ?? 0 });
        }
      }
      return lista;
    }
    if (tipoRegistro === 'adubacao') {
      return adubos
        .filter(a => !jaAdicionados.has(a.id))
        .map(a => ({ uid: a.id, id: a.id, nome: a.npk, unidade: a.unidade, tipo: 'adubo', quantidade: '', estoqueAtual: a.quantidade ?? 0 }));
    }
    if (tipoRegistro === 'plantio') {
      const catKey = CULTURAS_SEMENTES_MAP[cultura.nome];
      if (!catKey) return [];
      return (sementes[catKey] || [])
        .filter(s => !jaAdicionados.has(`semente_${catKey}_${s.id}`))
        .map(s => ({
          uid: `semente_${catKey}_${s.id}`,
          id: s.id, nome: s.nome, unidade: s.unidade,
          tipo: 'semente', categoria: catKey,
          quantidade: '', sementesPorMetro: '', estoqueAtual: s.quantidade ?? 0,
          sementesPorSaco: s.sementesPorSaco || null,
        }));
    }
    return [];
  }

  function adicionarProduto(produto) { setProdutosUsados(prev => [...prev, produto]); setModalProduto(false); }

  function atualizarDoseProduto(uid, valor) {
    setProdutosUsados(prev => prev.map(p => {
      if (p.uid !== uid) return p;
      const dose = parseFloat(valor.replace(',', '.'));
      const ha = cultura.hectares;
      const quantidade = (!isNaN(dose) && dose > 0 && ha) ? String(+(dose * ha).toFixed(2)) : '';
      return { ...p, dose: valor, quantidade };
    }));
  }

  function atualizarQtdProduto(uid, valor) {
    setProdutosUsados(prev => prev.map(p => p.uid === uid ? { ...p, quantidade: valor, dose: '' } : p));
  }

  function removerProdutoUsado(uid) { setProdutosUsados(prev => prev.filter(p => p.uid !== uid)); }

  function atualizarSementesPorMetro(uid, valor) {
    setProdutosUsados(prev => prev.map(p => {
      if (p.uid !== uid) return p;
      const spm = parseFloat(valor.replace(',', '.'));
      let quantidade = p.quantidade;
      if (!isNaN(spm) && spm > 0 && cultura.hectares && p.sementesPorSaco > 0 && p.unidade === 'sc') {
        const semHa = Math.round(spm * SEMENTE_FATOR_HA);
        const semTotal = Math.round(semHa * cultura.hectares);
        quantidade = String(Math.ceil(semTotal / p.sementesPorSaco));
      }
      return { ...p, sementesPorMetro: valor, quantidade };
    }));
  }

  async function salvarRegistro() {
    const [dia, mes, ano] = dataTexto.split('/');
    const data = new Date(Number(ano), Number(mes) - 1, Number(dia));
    const dataISO = isNaN(data.getTime()) ? new Date().toISOString() : data.toISOString();

    const produtosValidos = produtosUsados
      .filter(p => { const q = parseFloat(String(p.quantidade).replace(',', '.')); return !isNaN(q) && q > 0; })
      .map(p => ({ ...p, quantidade: parseFloat(String(p.quantidade).replace(',', '.')) }));

    if (modoEdicao && registroEditando) {
      await atualizarRegistroCultura(talhao.id, cultura.id, registroEditando.id, {
        tipo: tipoRegistro, descricao: descricao.trim(), data: dataISO, produtosUsados: produtosValidos, pendente,
      });
    } else {
      await adicionarRegistroCultura(talhao.id, cultura.id, {
        tipo: tipoRegistro, descricao: descricao.trim(), data: dataISO, produtosUsados: produtosValidos, pendente,
      });
      if (!pendente) {
        for (const p of produtosValidos) {
          const motivo = `${talhao.nome} - ${cultura.nome}`;
          if (p.tipo === 'liquido')
            await adicionarMovimentacaoLiquido(p.categoria, p.id, { tipo: 'saida', quantidade: p.quantidade, motivo });
          else if (p.tipo === 'adubo')
            await adicionarMovimentacaoAdubo(p.id, { tipo: 'saida', quantidade: p.quantidade, motivo });
          else if (p.tipo === 'semente')
            await adicionarMovimentacaoSemente(p.categoria, p.id, { tipo: 'saida', quantidade: p.quantidade, motivo });
        }
      }
    }
    fecharModal();
  }

  function confirmarRemoverRegistro(registro) {
    setPendingDelete({ id: registro.id, label: registro.descricao || '(sem descrição)', tipo: 'registro', registro });
  }

  async function confirmarPendencia(registro) {
    const motivo = `${talhao.nome} - ${cultura.nome}`;
    for (const p of (registro.produtosUsados || [])) {
      if (p.tipo === 'liquido')
        await adicionarMovimentacaoLiquido(p.categoria, p.id, { tipo: 'saida', quantidade: p.quantidade, motivo });
      else if (p.tipo === 'adubo')
        await adicionarMovimentacaoAdubo(p.id, { tipo: 'saida', quantidade: p.quantidade, motivo });
      else if (p.tipo === 'semente')
        await adicionarMovimentacaoSemente(p.categoria, p.id, { tipo: 'saida', quantidade: p.quantidade, motivo });
    }
    await atualizarRegistroCultura(talhao.id, cultura.id, registro.id, { ...registro, pendente: false });
  }

  const registros = [...(cultura.registros || [])].sort((a, b) => new Date(b.data) - new Date(a.data));

  async function salvarHaCultura() {
    const ha = parseFloat(haTemp.replace(',', '.'));
    const valor = (isNaN(ha) || ha < 0) ? null : ha === 0 ? (talhao.hectares || null) : ha;
    await atualizarHectaresCultura(talhao.id, cultura.id, valor);
    setEditandoHa(false);
  }

  return (
    <View style={styles.root}>
      <View style={[styles.detalheHeader, { backgroundColor: corCultura }]}>
        <TouchableOpacity onPress={onVoltar} style={styles.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.detalheSubtitulo}>{talhao.nome}</Text>
          <Text style={styles.detalheTitulo} numberOfLines={1}>{cultura.nome}</Text>
        </View>
        {editandoHa ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TextInput
              style={styles.haInput}
              value={haTemp}
              onChangeText={setHaTemp}
              keyboardType="decimal-pad"
              placeholder="ha"
              placeholderTextColor="rgba(255,255,255,0.6)"
              autoFocus
            />
            <Text style={{ color: '#fff', fontFamily: 'Inter_500Medium', fontSize: 13 }}>ha</Text>
            <TouchableOpacity onPress={salvarHaCultura} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="checkmark-circle" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => { setHaTemp(cultura.hectares ? String(cultura.hectares) : ''); setEditandoHa(true); }}
            style={styles.haBtn}
          >
            <Ionicons name="resize-outline" size={14} color="rgba(255,255,255,0.9)" />
            <Text style={styles.haBtnTxt}>{cultura.hectares ? `${cultura.hectares} ha` : '+ área'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.secao}>
          {registros.length === 0 && (
            <Card style={styles.emptyCard}>
              <Ionicons name="document-text-outline" size={32} color="#D1D5DB" />
              <Text style={styles.emptyTxt}>Nenhum registro ainda</Text>
              <Text style={styles.emptySub}>Toque em + para adicionar</Text>
            </Card>
          )}
          {registros.map((r, index) => {
            const info = tipoInfo(r.tipo);
            const isLast = index === registros.length - 1;
            return (
              <View key={r.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, { backgroundColor: r.pendente ? '#F59E0B' : info.cor }]}>
                    <Ionicons name={r.pendente ? 'time-outline' : info.icone} size={13} color="#fff" />
                  </View>
                  {!isLast && <View style={styles.timelineLine} />}
                </View>
                <Card style={[styles.registroCard, r.pendente && styles.registroCardPendente]}>
                  <View style={styles.registroTop}>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      <Badge label={info.label} variant="muted" />
                      {r.pendente && <View style={styles.pendenteBadge}><Text style={styles.pendenteBadgeTxt}>Pendente</Text></View>}
                    </View>
                    <Text style={styles.registroData}>{formatarData(r.data)}</Text>
                  </View>
                  <Text style={styles.registroDesc}>{r.descricao}</Text>
                  {r.produtosUsados?.length > 0 && (
                    <View style={{ gap: 2, marginTop: 4 }}>
                      {r.produtosUsados.map(p => (
                        <Text key={p.uid} style={styles.registroProduto}>· {p.nome}: {p.quantidade} {p.unidade}</Text>
                      ))}
                    </View>
                  )}
                  {r.pendente && (
                    <TouchableOpacity style={styles.confirmarPendenciaBtn} onPress={() => confirmarPendencia(r)}>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                      <Text style={styles.confirmarPendenciaTxt}>Confirmar — descontar do estoque</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.registroAcoes}>
                    <TouchableOpacity onPress={() => abrirEdicao(r)} style={{ padding: 10 }}>
                      <Ionicons name="pencil-outline" size={20} color="#6B7280" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmarRemoverRegistro(r)} style={{ padding: 10 }}>
                      <Ionicons name="trash-outline" size={20} color={DANGER} />
                    </TouchableOpacity>
                  </View>
                </Card>
              </View>
            );
          })}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { backgroundColor: corCultura }]} onPress={abrirModal} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal novo/editar registro */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalBox}>
              <Text style={styles.modalTitulo}>{modoEdicao ? 'Editar Registro' : 'Novo Registro'}</Text>
              <Text style={styles.fieldLabel}>Tipo</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {TIPOS_REGISTRO.map(t => (
                  <TouchableOpacity key={t.key} style={[styles.tipoChip, tipoRegistro === t.key && { backgroundColor: t.cor, borderColor: t.cor }]} onPress={() => setTipoRegistro(t.key)}>
                    <Ionicons name={t.icone} size={13} color={tipoRegistro === t.key ? '#fff' : '#6B7280'} />
                    <Text style={[styles.tipoChipTxt, tipoRegistro === t.key && { color: '#fff' }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Input label="Data (DD/MM/AAAA)" value={dataTexto} onChangeText={t => setDataTexto(formatarDataInput(t))} keyboardType="numeric" placeholder="Ex: 14/03/2026" maxLength={10} />
              <Input label="Descrição" value={descricao} onChangeText={setDescricao} placeholder="Ex: Aplicado Roundup 2 L/ha + Primóleo" multiline />
              {(tipoRegistro === 'aplicacao' || tipoRegistro === 'adubacao' ||
                (tipoRegistro === 'plantio' && !!CULTURAS_SEMENTES_MAP[cultura.nome])) && (
                <View style={styles.produtosSection}>
                  <Text style={styles.fieldLabel}>
                    {tipoRegistro === 'plantio' ? 'Sementes do plantio' : 'Produtos utilizados'}
                  </Text>
                  {produtosUsados.map(p => (
                    <View key={p.uid} style={styles.produtoRow}>
                      <View style={{ flex: 1, gap: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.produtoNome}>{p.nome}</Text>
                            {p.categoriaLabel && <Text style={styles.produtoCat}>{p.categoriaLabel}</Text>}
                          </View>
                          <TouchableOpacity onPress={() => removerProdutoUsado(p.uid)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close-circle" size={22} color={DANGER} />
                          </TouchableOpacity>
                        </View>
                        {p.tipo === 'semente' ? (
                          <View style={{ gap: 6 }}>
                            <View style={styles.doseRow}>
                              <TextInput style={styles.produtoQtdInput} value={String(p.sementesPorMetro || '')} onChangeText={v => atualizarSementesPorMetro(p.uid, v)} keyboardType="decimal-pad" placeholder="0" />
                              <Text style={styles.doseSep}>sem/metro</Text>
                            </View>
                            {(() => {
                              const spm = parseFloat(String(p.sementesPorMetro || '').replace(',', '.'));
                              if (!isNaN(spm) && spm > 0) {
                                const semHa = Math.round(spm * SEMENTE_FATOR_HA);
                                const semTotal = cultura.hectares ? Math.round(semHa * cultura.hectares) : null;
                                const sacosNecessarios = (semTotal && p.sementesPorSaco > 0) ? Math.ceil(semTotal / p.sementesPorSaco) : null;
                                return (
                                  <Text style={styles.sementeCalcInfo}>
                                    {'≈ ' + semHa.toLocaleString('pt-BR') + ' sem/ha'}
                                    {semTotal ? ('  ·  ' + semTotal.toLocaleString('pt-BR') + ' sem em ' + cultura.hectares + ' ha') : ''}
                                    {sacosNecessarios ? ('\n≈ ' + sacosNecessarios + ' sc necessários') : ''}
                                  </Text>
                                );
                              }
                              return null;
                            })()}
                            <Text style={[styles.fieldLabel, { marginTop: 2 }]}>Qtd. a retirar do estoque</Text>
                            <View style={styles.doseRow}>
                              <TextInput style={styles.produtoQtdInput} value={String(p.quantidade)} onChangeText={v => atualizarQtdProduto(p.uid, v)} keyboardType="decimal-pad" placeholder="0" />
                              <Text style={styles.produtoUnidade}>{p.unidade}</Text>
                            </View>
                          </View>
                        ) : cultura.hectares ? (
                          <View style={styles.doseRow}>
                            <TextInput style={styles.produtoQtdInput} value={String(p.dose || '')} onChangeText={v => atualizarDoseProduto(p.uid, v)} keyboardType="decimal-pad" placeholder="0" />
                            <Text style={styles.doseSep}>{p.unidade}/ha  ×  {cultura.hectares} ha</Text>
                            <Text style={styles.doseTotalLabel}>=</Text>
                            <Text style={styles.doseTotal}>{p.quantidade || '–'} {p.unidade}</Text>
                          </View>
                        ) : (
                          <View style={styles.doseRow}>
                            <TextInput style={styles.produtoQtdInput} value={String(p.quantidade)} onChangeText={v => atualizarQtdProduto(p.uid, v)} keyboardType="decimal-pad" placeholder="0" />
                            <Text style={styles.produtoUnidade}>{p.unidade}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addProdutoBtn} onPress={() => setModalProduto(true)}>
                    <Ionicons name="add-circle-outline" size={18} color={PRIMARY} />
                    <Text style={styles.addProdutoBtnTxt}>
                      {tipoRegistro === 'plantio' ? 'Adicionar semente' : 'Adicionar produto'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={[styles.pendenteToggle, pendente && styles.pendenteToggleAtivo]}
                onPress={() => setPendente(v => !v)}
                activeOpacity={0.8}
              >
                <Ionicons name={pendente ? 'time' : 'checkmark-circle-outline'} size={20} color={pendente ? '#D97706' : '#6B7280'} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pendenteToggleTxt, pendente && { color: '#D97706' }]}>
                    {pendente ? 'Registro pendente' : 'Registro confirmado'}
                  </Text>
                  <Text style={styles.pendenteToggleSub}>
                    {pendente ? 'Estoque não será descontado agora' : 'Estoque será descontado ao salvar'}
                  </Text>
                </View>
              </TouchableOpacity>
              <View style={styles.modalAcoes}>
                <Button label="Cancelar" onPress={fecharModal} variant="secondary" style={{ flex: 1 }} />
                <Button label={modoEdicao ? 'Atualizar' : 'Salvar'} onPress={salvarRegistro} variant="primary" style={{ flex: 1 }} />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal confirmar exclusão de registro */}
      <Modal visible={!!pendingDelete} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconBox}>
              <Ionicons name="trash-outline" size={28} color={DANGER} />
            </View>
            <Text style={styles.confirmTitulo}>Remover registro?</Text>
            <Text style={styles.confirmMsg}>"{pendingDelete?.label}" será removido.</Text>
            <View style={styles.confirmAcoes}>
              <TouchableOpacity style={styles.confirmBtnCancelar} onPress={() => setPendingDelete(null)}>
                <Text style={styles.confirmBtnCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtnExcluir} onPress={async () => {
                const reg = pendingDelete.registro;
                if (reg && !reg.pendente) {
                  const motivo = `${talhao.nome} - ${cultura.nome} (estorno)`;
                  for (const p of (reg.produtosUsados || [])) {
                    if (p.tipo === 'liquido') await adicionarMovimentacaoLiquido(p.categoria, p.id, { tipo: 'entrada', quantidade: p.quantidade, motivo });
                    else if (p.tipo === 'adubo') await adicionarMovimentacaoAdubo(p.id, { tipo: 'entrada', quantidade: p.quantidade, motivo });
                    else if (p.tipo === 'semente') await adicionarMovimentacaoSemente(p.categoria, p.id, { tipo: 'entrada', quantidade: p.quantidade, motivo });
                  }
                }
                removerRegistroCultura(talhao.id, cultura.id, pendingDelete.id);
                setPendingDelete(null);
              }}>
                <Text style={styles.confirmBtnExcluirTxt}>Remover</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal seleção de produto */}
      <Modal visible={modalProduto} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { maxHeight: '75%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.modalTitulo}>Selecionar produto</Text>
              <TouchableOpacity onPress={() => setModalProduto(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {getProdutosDisponiveis().length === 0 ? (
                <Text style={{ color: '#9CA3AF', textAlign: 'center', marginTop: 16, fontFamily: 'Inter_400Regular' }}>
                  Nenhum produto disponível no estoque
                </Text>
              ) : getProdutosDisponiveis().map(p => (
                <TouchableOpacity key={p.uid} style={styles.produtoPickerItem} onPress={() => adicionarProduto(p)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.produtoPickerNome}>{p.nome}</Text>
                    {p.categoriaLabel && <Text style={styles.produtoCat}>{p.categoriaLabel}</Text>}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text style={styles.produtoPickerEstoque}>{p.estoqueAtual} {p.unidade}</Text>
                    <Ionicons name="add-circle-outline" size={22} color={PRIMARY} />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── VariedadeDetalhe ─────────────────────────────────────────────────────────

function VariedadeDetalhe({ talhao, cultura, variedade, corCultura, onVoltar }) {
  const {
    adicionarRegistroVariedade, atualizarRegistroVariedade, removerRegistroVariedade,
    adubos, liquidos, adicionarMovimentacaoAdubo, adicionarMovimentacaoLiquido,
  } = useStorage();

  const [modalVisible, setModalVisible]   = useState(false);
  const [tipoRegistro, setTipoRegistro]   = useState('aplicacao');
  const [descricao, setDescricao]         = useState('');
  const [dataTexto, setDataTexto]         = useState('');
  const [produtosUsados, setProdutosUsados] = useState([]);
  const [modalProduto, setModalProduto]   = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendente, setPendente]           = useState(false);

  const TIPOS_VAR = TIPOS_REGISTRO.filter(t => t.key !== 'plantio');

  function abrirModal() {
    setTipoRegistro('aplicacao'); setDescricao(''); setProdutosUsados([]); setPendente(false);
    const hoje = new Date();
    setDataTexto(`${String(hoje.getDate()).padStart(2,'0')}/${String(hoje.getMonth()+1).padStart(2,'0')}/${hoje.getFullYear()}`);
    setModalVisible(true);
  }

  async function salvar() {
    const [dia, mes, ano] = dataTexto.split('/');
    const data = new Date(Number(ano), Number(mes) - 1, Number(dia));
    const dataISO = isNaN(data.getTime()) ? new Date().toISOString() : data.toISOString();
    const produtosValidos = produtosUsados
      .filter(p => { const q = parseFloat(String(p.quantidade).replace(',', '.')); return !isNaN(q) && q > 0; })
      .map(p => ({ ...p, quantidade: parseFloat(String(p.quantidade).replace(',', '.')) }));
    await adicionarRegistroVariedade(talhao.id, cultura.id, variedade.id, {
      tipo: tipoRegistro, descricao: descricao.trim(), data: dataISO, produtosUsados: produtosValidos, pendente,
    });
    if (!pendente) {
      const motivo = `${talhao.nome} - Couve/${variedade.nome}`;
      for (const p of produtosValidos) {
        if (p.tipo === 'liquido') await adicionarMovimentacaoLiquido(p.categoria, p.id, { tipo: 'saida', quantidade: p.quantidade, motivo });
        else if (p.tipo === 'adubo') await adicionarMovimentacaoAdubo(p.id, { tipo: 'saida', quantidade: p.quantidade, motivo });
      }
    }
    setModalVisible(false);
  }

  async function confirmarPendenciaVar(r) {
    const motivo = `${talhao.nome} - Couve/${variedade.nome}`;
    for (const p of (r.produtosUsados || [])) {
      if (p.tipo === 'liquido') await adicionarMovimentacaoLiquido(p.categoria, p.id, { tipo: 'saida', quantidade: p.quantidade, motivo });
      else if (p.tipo === 'adubo') await adicionarMovimentacaoAdubo(p.id, { tipo: 'saida', quantidade: p.quantidade, motivo });
    }
    await atualizarRegistroVariedade(talhao.id, cultura.id, variedade.id, r.id, { pendente: false });
  }

  const registros = [...(variedade.registros || [])].sort((a, b) => new Date(b.data) - new Date(a.data));

  return (
    <View style={styles.root}>
      <View style={[styles.detalheHeader, { backgroundColor: corCultura }]}>
        <TouchableOpacity onPress={onVoltar} style={styles.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.detalheSubtitulo}>{talhao.nome} · Couve</Text>
          <Text style={styles.detalheTitulo} numberOfLines={1}>{variedade.nome}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {variedade.mudas ? <Text style={styles.haBtnTxt}>{variedade.mudas.toLocaleString('pt-BR')} pés</Text> : null}
          {variedade.dataPlantio ? <Text style={[styles.haBtnTxt, { fontSize: 11 }]}>{formatarData(variedade.dataPlantio)}</Text> : null}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.secao}>
          {registros.length === 0 && (
            <Card style={styles.emptyCard}>
              <Ionicons name="document-text-outline" size={32} color="#D1D5DB" />
              <Text style={styles.emptyTxt}>Nenhum registro ainda</Text>
              <Text style={styles.emptySub}>Toque em + para adicionar</Text>
            </Card>
          )}
          {registros.map((r, index) => {
            const info = tipoInfo(r.tipo);
            const isLast = index === registros.length - 1;
            return (
              <View key={r.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, { backgroundColor: r.pendente ? '#F59E0B' : info.cor }]}>
                    <Ionicons name={r.pendente ? 'time-outline' : info.icone} size={13} color="#fff" />
                  </View>
                  {!isLast && <View style={styles.timelineLine} />}
                </View>
                <Card style={[styles.registroCard, r.pendente && styles.registroCardPendente]}>
                  <View style={styles.registroTop}>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      <Badge label={info.label} variant="muted" />
                      {r.pendente && <View style={styles.pendenteBadge}><Text style={styles.pendenteBadgeTxt}>Pendente</Text></View>}
                    </View>
                    <Text style={styles.registroData}>{formatarData(r.data)}</Text>
                  </View>
                  <Text style={styles.registroDesc}>{r.descricao}</Text>
                  {r.produtosUsados?.length > 0 && (
                    <View style={{ gap: 2, marginTop: 4 }}>
                      {r.produtosUsados.map(p => (
                        <Text key={p.uid} style={styles.registroProduto}>· {p.nome}: {p.quantidade} {p.unidade}</Text>
                      ))}
                    </View>
                  )}
                  {r.pendente && (
                    <TouchableOpacity style={styles.confirmarPendenciaBtn} onPress={() => confirmarPendenciaVar(r)}>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                      <Text style={styles.confirmarPendenciaTxt}>Confirmar — descontar do estoque</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.registroAcoes}>
                    <TouchableOpacity onPress={() => setPendingDelete({ id: r.id, label: r.descricao || info.label, registro: r })} style={{ padding: 10 }}>
                      <Ionicons name="trash-outline" size={20} color={DANGER} />
                    </TouchableOpacity>
                  </View>
                </Card>
              </View>
            );
          })}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { backgroundColor: corCultura }]} onPress={abrirModal} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalBox}>
              <Text style={styles.modalTitulo}>Novo Registro — {variedade.nome}</Text>
              <Text style={styles.fieldLabel}>Tipo</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {TIPOS_VAR.map(t => (
                  <TouchableOpacity key={t.key} style={[styles.tipoChip, tipoRegistro === t.key && { backgroundColor: t.cor, borderColor: t.cor }]} onPress={() => setTipoRegistro(t.key)}>
                    <Ionicons name={t.icone} size={13} color={tipoRegistro === t.key ? '#fff' : '#6B7280'} />
                    <Text style={[styles.tipoChipTxt, tipoRegistro === t.key && { color: '#fff' }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Input label="Data (DD/MM/AAAA)" value={dataTexto} onChangeText={t => setDataTexto(formatarDataInput(t))} keyboardType="numeric" placeholder="Ex: 14/03/2026" maxLength={10} />
              <Input label="Descrição" value={descricao} onChangeText={setDescricao} placeholder="Descreva o que foi feito" multiline />
              {(tipoRegistro === 'aplicacao' || tipoRegistro === 'adubacao') && (
                <View style={styles.produtosSection}>
                  <Text style={styles.fieldLabel}>Produtos utilizados</Text>
                  {produtosUsados.map(p => (
                    <View key={p.uid} style={styles.produtoRow}>
                      <View style={{ flex: 1, gap: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.produtoNome}>{p.nome}</Text>
                            {p.categoriaLabel && <Text style={styles.produtoCat}>{p.categoriaLabel}</Text>}
                          </View>
                          <TouchableOpacity onPress={() => setProdutosUsados(prev => prev.filter(x => x.uid !== p.uid))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close-circle" size={22} color={DANGER} />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.doseRow}>
                          <TextInput style={styles.produtoQtdInput} value={String(p.quantidade)} onChangeText={v => setProdutosUsados(prev => prev.map(x => x.uid === p.uid ? { ...x, quantidade: v } : x))} keyboardType="decimal-pad" placeholder="0" />
                          <Text style={styles.produtoUnidade}>{p.unidade}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addProdutoBtn} onPress={() => setModalProduto(true)}>
                    <Ionicons name="add-circle-outline" size={18} color={PRIMARY} />
                    <Text style={styles.addProdutoBtnTxt}>Adicionar produto</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity style={[styles.pendenteToggle, pendente && styles.pendenteToggleAtivo]} onPress={() => setPendente(v => !v)} activeOpacity={0.8}>
                <Ionicons name={pendente ? 'time' : 'checkmark-circle-outline'} size={20} color={pendente ? '#D97706' : '#6B7280'} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pendenteToggleTxt, pendente && { color: '#D97706' }]}>{pendente ? 'Registro pendente' : 'Registro confirmado'}</Text>
                  <Text style={styles.pendenteToggleSub}>{pendente ? 'Estoque não será descontado agora' : 'Estoque será descontado ao salvar'}</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.modalAcoes}>
                <Button label="Cancelar" onPress={() => setModalVisible(false)} variant="secondary" style={{ flex: 1 }} />
                <Button label="Salvar" onPress={salvar} variant="primary" style={{ flex: 1 }} />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalProduto} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { maxHeight: '75%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.modalTitulo}>Selecionar produto</Text>
              <TouchableOpacity onPress={() => setModalProduto(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(() => {
                const jaAdicionados = new Set(produtosUsados.map(p => p.uid));
                let lista = [];
                if (tipoRegistro === 'aplicacao') {
                  for (const cat of CATEGORIAS_LIQUIDOS) {
                    for (const p of (liquidos[cat.key] || [])) {
                      const uid = `${cat.key}_${p.id}`;
                      if (!jaAdicionados.has(uid)) lista.push({ uid, id: p.id, nome: p.nome, unidade: p.unidade, tipo: 'liquido', categoria: cat.key, categoriaLabel: cat.label, quantidade: '', estoqueAtual: p.quantidade ?? 0 });
                    }
                  }
                } else if (tipoRegistro === 'adubacao') {
                  lista = adubos.filter(a => !jaAdicionados.has(a.id)).map(a => ({ uid: a.id, id: a.id, nome: a.npk, unidade: a.unidade, tipo: 'adubo', quantidade: '', estoqueAtual: a.quantidade ?? 0 }));
                }
                if (lista.length === 0) return <Text style={{ color: '#9CA3AF', textAlign: 'center', marginTop: 16, fontFamily: 'Inter_400Regular' }}>Nenhum produto disponível</Text>;
                return lista.map(p => (
                  <TouchableOpacity key={p.uid} style={styles.produtoPickerItem} onPress={() => { setProdutosUsados(prev => [...prev, p]); setModalProduto(false); }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.produtoPickerNome}>{p.nome}</Text>
                      {p.categoriaLabel && <Text style={styles.produtoCat}>{p.categoriaLabel}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text style={styles.produtoPickerEstoque}>{p.estoqueAtual} {p.unidade}</Text>
                      <Ionicons name="add-circle-outline" size={22} color={PRIMARY} />
                    </View>
                  </TouchableOpacity>
                ));
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!pendingDelete} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconBox}><Ionicons name="trash-outline" size={28} color={DANGER} /></View>
            <Text style={styles.confirmTitulo}>Remover registro?</Text>
            <Text style={styles.confirmMsg}>"{pendingDelete?.label}" será removido.</Text>
            <View style={styles.confirmAcoes}>
              <TouchableOpacity style={styles.confirmBtnCancelar} onPress={() => setPendingDelete(null)}>
                <Text style={styles.confirmBtnCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtnExcluir} onPress={async () => {
                const reg = pendingDelete.registro;
                if (reg && !reg.pendente) {
                  const motivo = `${talhao.nome} - ${cultura.nome} / ${variedade.nome} (estorno)`;
                  for (const p of (reg.produtosUsados || [])) {
                    if (p.tipo === 'liquido') await adicionarMovimentacaoLiquido(p.categoria, p.id, { tipo: 'entrada', quantidade: p.quantidade, motivo });
                    else if (p.tipo === 'adubo') await adicionarMovimentacaoAdubo(p.id, { tipo: 'entrada', quantidade: p.quantidade, motivo });
                  }
                }
                removerRegistroVariedade(talhao.id, cultura.id, variedade.id, pendingDelete.id);
                setPendingDelete(null);
              }}>
                <Text style={styles.confirmBtnExcluirTxt}>Remover</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── CouveDetalhe ─────────────────────────────────────────────────────────────

function CouveDetalhe({ talhao, cultura, corCultura, onVoltar }) {
  const {
    atualizarMudasCultura, adicionarVariedadeCouve, atualizarVariedadeCouve, removerVariedadeCouve,
    adicionarRegistroCultura, adicionarRegistroCulturaEVariedades, removerRegistroCulturaEVariedades, atualizarRegistroCultura,
    adubos, liquidos, adicionarMovimentacaoAdubo, adicionarMovimentacaoLiquido,
  } = useStorage();

  const [variedadeSelecionada, setVariedadeSelecionada] = useState(null);
  const [editandoMudas, setEditandoMudas]     = useState(false);
  const [mudasTemp, setMudasTemp]             = useState(cultura.mudas ? String(cultura.mudas) : '');
  const [modalVisible, setModalVisible]       = useState(false);
  const [tipoRegistro, setTipoRegistro]       = useState('aplicacao');
  const [descricao, setDescricao]             = useState('');
  const [dataTexto, setDataTexto]             = useState('');
  const [variedadeNome, setVariedadeNome]     = useState('');
  const [variedadeMudas, setVariedadeMudas]   = useState('');
  const [variedadesSel, setVariedadesSel]     = useState([]);
  const [produtosUsados, setProdutosUsados]   = useState([]);
  const [modalProduto, setModalProduto]       = useState(false);
  const [pendingDelete, setPendingDelete]     = useState(null);
  const [pendente, setPendente]               = useState(false);
  const [editandoVariedade, setEditandoVariedade] = useState(null); // { id, nome, mudas }
  const [editNome, setEditNome]               = useState('');
  const [editMudas, setEditMudas]             = useState('');
  const [editData, setEditData]               = useState('');

  const variedadeAtualizada = variedadeSelecionada
    ? (cultura.variedades || []).find(v => v.id === variedadeSelecionada.id) || null
    : null;

  if (variedadeAtualizada) {
    return (
      <VariedadeDetalhe
        talhao={talhao}
        cultura={cultura}
        variedade={variedadeAtualizada}
        corCultura={corCultura}
        onVoltar={() => setVariedadeSelecionada(null)}
      />
    );
  }

  function abrirModal() {
    setTipoRegistro('aplicacao'); setDescricao(''); setProdutosUsados([]);
    setVariedadeNome(''); setVariedadeMudas(''); setVariedadesSel([]); setPendente(false);
    const hoje = new Date();
    setDataTexto(`${String(hoje.getDate()).padStart(2,'0')}/${String(hoje.getMonth()+1).padStart(2,'0')}/${hoje.getFullYear()}`);
    setModalVisible(true);
  }

  async function salvarHaCultura() {
    const m = parseInt(mudasTemp.replace(/\D/g, ''));
    await atualizarMudasCultura(talhao.id, cultura.id, isNaN(m) || m <= 0 ? null : m);
    setEditandoMudas(false);
  }

  async function salvarEdicaoVariedade() {
    if (!editNome.trim()) { Alert.alert('Informe o nome da variedade'); return; }
    const m = parseInt(editMudas.replace(/\D/g, ''));
    const [dia, mes, ano] = editData.split('/');
    const dataObj = new Date(Number(ano), Number(mes) - 1, Number(dia));
    const dataISO = editData.length === 10 && !isNaN(dataObj.getTime()) ? dataObj.toISOString() : editandoVariedade.dataPlantio;
    await atualizarVariedadeCouve(talhao.id, cultura.id, editandoVariedade.id, {
      nome: editNome.trim(),
      mudas: isNaN(m) || m <= 0 ? null : m,
      dataPlantio: dataISO,
    });
    setEditandoVariedade(null);
  }

  async function salvar() {
    const [dia, mes, ano] = dataTexto.split('/');
    const data = new Date(Number(ano), Number(mes) - 1, Number(dia));
    const dataISO = isNaN(data.getTime()) ? new Date().toISOString() : data.toISOString();
    if (tipoRegistro === 'plantio') {
      if (!variedadeNome.trim()) { Alert.alert('Informe a variedade'); return; }
      const m = parseInt(variedadeMudas);
      await adicionarVariedadeCouve(talhao.id, cultura.id, {
        nome: variedadeNome.trim(), mudas: isNaN(m) || m <= 0 ? null : m, dataPlantio: dataISO,
      });
    } else {
      const produtosValidos = produtosUsados
        .filter(p => { const q = parseFloat(String(p.quantidade).replace(',', '.')); return !isNaN(q) && q > 0; })
        .map(p => ({ ...p, quantidade: parseFloat(String(p.quantidade).replace(',', '.')) }));
      const registroGeral = {
        tipo: tipoRegistro, descricao: descricao.trim(), data: dataISO,
        produtosUsados: produtosValidos, variedadesAplicadas: variedadesSel, pendente,
      };
      await adicionarRegistroCulturaEVariedades(talhao.id, cultura.id, registroGeral, variedadesSel);

      if (!pendente) {
        const motivo = `${talhao.nome} - Couve`;
        for (const p of produtosValidos) {
          if (p.tipo === 'liquido') await adicionarMovimentacaoLiquido(p.categoria, p.id, { tipo: 'saida', quantidade: p.quantidade, motivo });
          else if (p.tipo === 'adubo') await adicionarMovimentacaoAdubo(p.id, { tipo: 'saida', quantidade: p.quantidade, motivo });
        }
      }
    }
    setModalVisible(false);
  }

  async function confirmarPendenciaCouve(r) {
    const motivo = `${talhao.nome} - Couve`;
    for (const p of (r.produtosUsados || [])) {
      if (p.tipo === 'liquido') await adicionarMovimentacaoLiquido(p.categoria, p.id, { tipo: 'saida', quantidade: p.quantidade, motivo });
      else if (p.tipo === 'adubo') await adicionarMovimentacaoAdubo(p.id, { tipo: 'saida', quantidade: p.quantidade, motivo });
    }
    await atualizarRegistroCultura(talhao.id, cultura.id, r.id, { pendente: false });
  }

  const registros = [...(cultura.registros || [])].sort((a, b) => new Date(b.data) - new Date(a.data));
  const variedades = cultura.variedades || [];

  return (
    <View style={styles.root}>
      <View style={[styles.detalheHeader, { backgroundColor: corCultura }]}>
        <TouchableOpacity onPress={onVoltar} style={styles.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.detalheSubtitulo}>{talhao.nome}</Text>
          <Text style={styles.detalheTitulo}>Couve</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.secao}>
          <SectionHeader title={`Variedades (${variedades.length})`} />
          {variedades.length === 0 && (
            <Card style={styles.emptyCard}>
              <Ionicons name="flower-outline" size={32} color="#D1D5DB" />
              <Text style={styles.emptyTxt}>Nenhuma variedade plantada</Text>
              <Text style={styles.emptySub}>Adicione um registro de Plantio</Text>
            </Card>
          )}
          {variedades.map(v => (
            <View key={v.id} style={styles.itemRow}>
              <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.8} onPress={() => setVariedadeSelecionada(v)}>
                <Card style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.culturaIconBox, { backgroundColor: corCultura + '25' }]}>
                    <Ionicons name="flower-outline" size={22} color={corCultura} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.culturaNome}>{v.nome}</Text>
                    <Text style={styles.culturaRegistroCount}>
                      {v.mudas ? `${v.mudas.toLocaleString('pt-BR')} pés` : 'sem qtd'}
                      {v.dataPlantio ? `  ·  ${formatarData(v.dataPlantio)}` : ''}
                      {`  ·  ${(v.registros || []).length} registro(s)`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                </Card>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setEditNome(v.nome); setEditMudas(v.mudas ? String(v.mudas) : ''); setEditData(v.dataPlantio ? formatarData(v.dataPlantio) : ''); setEditandoVariedade(v); }} style={[styles.deleteBtn, { marginRight: 2 }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="pencil-outline" size={20} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPendingDelete({ tipo: 'variedade', id: v.id, label: v.nome })} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={20} color={DANGER} />
              </TouchableOpacity>
            </View>
          ))}

          <SectionHeader title={`Registros gerais (${registros.length})`} />
          {registros.length === 0 && (
            <Card style={styles.emptyCard}>
              <Ionicons name="document-text-outline" size={28} color="#D1D5DB" />
              <Text style={styles.emptyTxt}>Nenhum registro geral</Text>
              <Text style={styles.emptySub}>Toque em + para adicionar</Text>
            </Card>
          )}
          {registros.map((r, index) => {
            const info = tipoInfo(r.tipo);
            const isLast = index === registros.length - 1;
            return (
              <View key={r.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, { backgroundColor: r.pendente ? '#F59E0B' : info.cor }]}>
                    <Ionicons name={r.pendente ? 'time-outline' : info.icone} size={13} color="#fff" />
                  </View>
                  {!isLast && <View style={styles.timelineLine} />}
                </View>
                <Card style={[styles.registroCard, r.pendente && styles.registroCardPendente]}>
                  <View style={styles.registroTop}>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      <Badge label={info.label} variant="muted" />
                      {r.pendente && <View style={styles.pendenteBadge}><Text style={styles.pendenteBadgeTxt}>Pendente</Text></View>}
                    </View>
                    <Text style={styles.registroData}>{formatarData(r.data)}</Text>
                  </View>
                  <Text style={styles.registroDesc}>{r.descricao}</Text>
                  {r.variedadesAplicadas?.length > 0 && (
                    <Text style={[styles.registroProduto, { marginTop: 2 }]}>Variedades: {r.variedadesAplicadas.join(', ')}</Text>
                  )}
                  {r.produtosUsados?.length > 0 && (
                    <View style={{ gap: 2, marginTop: 4 }}>
                      {r.produtosUsados.map(p => (
                        <Text key={p.uid} style={styles.registroProduto}>· {p.nome}: {p.quantidade} {p.unidade}</Text>
                      ))}
                    </View>
                  )}
                  {r.pendente && (
                    <TouchableOpacity style={styles.confirmarPendenciaBtn} onPress={() => confirmarPendenciaCouve(r)}>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                      <Text style={styles.confirmarPendenciaTxt}>Confirmar — descontar do estoque</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.registroAcoes}>
                    <TouchableOpacity onPress={() => setPendingDelete({ tipo: 'registro', id: r.id, label: r.descricao || info.label, registro: r })} style={{ padding: 10 }}>
                      <Ionicons name="trash-outline" size={20} color={DANGER} />
                    </TouchableOpacity>
                  </View>
                </Card>
              </View>
            );
          })}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { backgroundColor: corCultura }]} onPress={abrirModal} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalBox}>
              <Text style={styles.modalTitulo}>Novo Registro — Couve</Text>
              <Text style={styles.fieldLabel}>Tipo</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {TIPOS_REGISTRO.map(t => (
                  <TouchableOpacity key={t.key} style={[styles.tipoChip, tipoRegistro === t.key && { backgroundColor: t.cor, borderColor: t.cor }]} onPress={() => setTipoRegistro(t.key)}>
                    <Ionicons name={t.icone} size={13} color={tipoRegistro === t.key ? '#fff' : '#6B7280'} />
                    <Text style={[styles.tipoChipTxt, tipoRegistro === t.key && { color: '#fff' }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Input label="Data (DD/MM/AAAA)" value={dataTexto} onChangeText={t => setDataTexto(formatarDataInput(t))} keyboardType="numeric" placeholder="Ex: 14/03/2026" maxLength={10} />

              {tipoRegistro === 'plantio' ? (
                <>
                  <Input label="Variedade" value={variedadeNome} onChangeText={setVariedadeNome} placeholder="Ex: Veneza, Manteiga..." />
                  <Input label="Quantidade de pés" value={variedadeMudas} onChangeText={setVariedadeMudas} keyboardType="number-pad" placeholder="Ex: 5000" />
                </>
              ) : (
                <>
                  <Input label="Descrição" value={descricao} onChangeText={setDescricao} placeholder="Ex: Aplicação de inseticida" multiline />
                  {variedades.length > 0 && (
                    <View>
                      <Text style={styles.fieldLabel}>Variedades aplicadas</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                        {variedades.map(v => {
                          const sel = variedadesSel.includes(v.nome);
                          return (
                            <TouchableOpacity key={v.id} style={[styles.tipoChip, sel && { backgroundColor: corCultura, borderColor: corCultura }]}
                              onPress={() => setVariedadesSel(prev => sel ? prev.filter(n => n !== v.nome) : [...prev, v.nome])}>
                              <Text style={[styles.tipoChipTxt, sel && { color: '#fff' }]}>{v.nome}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                  {(tipoRegistro === 'aplicacao' || tipoRegistro === 'adubacao') && (
                    <View style={styles.produtosSection}>
                      <Text style={styles.fieldLabel}>Produtos utilizados</Text>
                      {produtosUsados.map(p => (
                        <View key={p.uid} style={styles.produtoRow}>
                          <View style={{ flex: 1, gap: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.produtoNome}>{p.nome}</Text>
                                {p.categoriaLabel && <Text style={styles.produtoCat}>{p.categoriaLabel}</Text>}
                              </View>
                              <TouchableOpacity onPress={() => setProdutosUsados(prev => prev.filter(x => x.uid !== p.uid))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="close-circle" size={22} color={DANGER} />
                              </TouchableOpacity>
                            </View>
                            <View style={styles.doseRow}>
                              <TextInput style={styles.produtoQtdInput} value={String(p.quantidade)} onChangeText={v => setProdutosUsados(prev => prev.map(x => x.uid === p.uid ? { ...x, quantidade: v } : x))} keyboardType="decimal-pad" placeholder="0" />
                              <Text style={styles.produtoUnidade}>{p.unidade}</Text>
                            </View>
                          </View>
                        </View>
                      ))}
                      <TouchableOpacity style={styles.addProdutoBtn} onPress={() => setModalProduto(true)}>
                        <Ionicons name="add-circle-outline" size={18} color={PRIMARY} />
                        <Text style={styles.addProdutoBtnTxt}>Adicionar produto</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {tipoRegistro !== 'plantio' && (
                <TouchableOpacity style={[styles.pendenteToggle, pendente && styles.pendenteToggleAtivo]} onPress={() => setPendente(v => !v)} activeOpacity={0.8}>
                  <Ionicons name={pendente ? 'time' : 'checkmark-circle-outline'} size={20} color={pendente ? '#D97706' : '#6B7280'} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pendenteToggleTxt, pendente && { color: '#D97706' }]}>{pendente ? 'Registro pendente' : 'Registro confirmado'}</Text>
                    <Text style={styles.pendenteToggleSub}>{pendente ? 'Estoque não será descontado agora' : 'Estoque será descontado ao salvar'}</Text>
                  </View>
                </TouchableOpacity>
              )}
              <View style={styles.modalAcoes}>
                <Button label="Cancelar" onPress={() => setModalVisible(false)} variant="secondary" style={{ flex: 1 }} />
                <Button label="Salvar" onPress={salvar} variant="primary" style={{ flex: 1 }} />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalProduto} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { maxHeight: '75%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.modalTitulo}>Selecionar produto</Text>
              <TouchableOpacity onPress={() => setModalProduto(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(() => {
                const jaAdicionados = new Set(produtosUsados.map(p => p.uid));
                let lista = [];
                if (tipoRegistro === 'aplicacao') {
                  for (const cat of CATEGORIAS_LIQUIDOS) {
                    for (const p of (liquidos[cat.key] || [])) {
                      const uid = `${cat.key}_${p.id}`;
                      if (!jaAdicionados.has(uid)) lista.push({ uid, id: p.id, nome: p.nome, unidade: p.unidade, tipo: 'liquido', categoria: cat.key, categoriaLabel: cat.label, quantidade: '', estoqueAtual: p.quantidade ?? 0 });
                    }
                  }
                } else if (tipoRegistro === 'adubacao') {
                  lista = adubos.filter(a => !jaAdicionados.has(a.id)).map(a => ({ uid: a.id, id: a.id, nome: a.npk, unidade: a.unidade, tipo: 'adubo', quantidade: '', estoqueAtual: a.quantidade ?? 0 }));
                }
                if (lista.length === 0) return <Text style={{ color: '#9CA3AF', textAlign: 'center', marginTop: 16, fontFamily: 'Inter_400Regular' }}>Nenhum produto disponível</Text>;
                return lista.map(p => (
                  <TouchableOpacity key={p.uid} style={styles.produtoPickerItem} onPress={() => { setProdutosUsados(prev => [...prev, p]); setModalProduto(false); }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.produtoPickerNome}>{p.nome}</Text>
                      {p.categoriaLabel && <Text style={styles.produtoCat}>{p.categoriaLabel}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text style={styles.produtoPickerEstoque}>{p.estoqueAtual} {p.unidade}</Text>
                      <Ionicons name="add-circle-outline" size={22} color={PRIMARY} />
                    </View>
                  </TouchableOpacity>
                ));
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editandoVariedade} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Editar Variedade</Text>
            <Input label="Nome da variedade" value={editNome} onChangeText={setEditNome} placeholder="Ex: Veneza, Manteiga..." autoFocus />
            <Input label="Quantidade de pés" value={editMudas} onChangeText={setEditMudas} keyboardType="number-pad" placeholder="Ex: 5000" />
            <Input label="Data de plantio (DD/MM/AAAA)" value={editData} onChangeText={t => setEditData(formatarDataInput(t))} keyboardType="numeric" placeholder="Ex: 14/03/2026" maxLength={10} />
            <View style={styles.modalAcoes}>
              <Button label="Cancelar" onPress={() => setEditandoVariedade(null)} variant="secondary" style={{ flex: 1 }} />
              <Button label="Salvar" onPress={salvarEdicaoVariedade} variant="primary" style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!pendingDelete} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconBox}><Ionicons name="trash-outline" size={28} color={DANGER} /></View>
            <Text style={styles.confirmTitulo}>Remover {pendingDelete?.tipo === 'variedade' ? 'variedade' : 'registro'}?</Text>
            <Text style={styles.confirmMsg}>"{pendingDelete?.label}" será removido permanentemente.</Text>
            <View style={styles.confirmAcoes}>
              <TouchableOpacity style={styles.confirmBtnCancelar} onPress={() => setPendingDelete(null)}>
                <Text style={styles.confirmBtnCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtnExcluir} onPress={async () => {
                if (pendingDelete.tipo === 'variedade') {
                  removerVariedadeCouve(talhao.id, cultura.id, pendingDelete.id);
                } else {
                  const reg = pendingDelete.registro;
                  if (reg && !reg.pendente) {
                    const motivo = `${talhao.nome} - Couve (estorno)`;
                    for (const p of (reg.produtosUsados || [])) {
                      if (p.tipo === 'liquido') await adicionarMovimentacaoLiquido(p.categoria, p.id, { tipo: 'entrada', quantidade: p.quantidade, motivo });
                      else if (p.tipo === 'adubo') await adicionarMovimentacaoAdubo(p.id, { tipo: 'entrada', quantidade: p.quantidade, motivo });
                    }
                  }
                  removerRegistroCulturaEVariedades(talhao.id, cultura.id, pendingDelete.id);
                }
                setPendingDelete(null);
              }}>
                <Text style={styles.confirmBtnExcluirTxt}>Remover</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── TalhaoDetalhe (info + lista de culturas) ─────────────────────────────────

function TalhaoDetalhe({ talhao, onVoltar }) {
  const { atualizarHectaresTalhao, adicionarCulturaTalhao, removerCulturaTalhao } = useStorage();
  const [culturaSelecionada, setCulturaSelecionada] = useState(null);
  const [editandoHectares, setEditandoHectares]     = useState(false);
  const [hectaresTemp, setHectaresTemp]             = useState(talhao.hectares ? String(talhao.hectares) : '');
  const [modalNovaCultura, setModalNovaCultura]     = useState(false);
  const [pendingDelete, setPendingDelete]           = useState(null);

  const culturaAtualizada = culturaSelecionada
    ? (talhao.culturas || []).find(c => c.id === culturaSelecionada.id) || null
    : null;

  if (culturaAtualizada) {
    const idx = (talhao.culturas || []).findIndex(c => c.id === culturaAtualizada.id);
    const corCult = CORES_CULTURA[idx % CORES_CULTURA.length];
    if (culturaAtualizada.nome.toLowerCase() === 'couve') {
      return <CouveDetalhe talhao={talhao} cultura={culturaAtualizada} corCultura={corCult} onVoltar={() => setCulturaSelecionada(null)} />;
    }
    return (
      <CulturaDetalhe
        talhao={talhao}
        cultura={culturaAtualizada}
        corCultura={corCult}
        onVoltar={() => setCulturaSelecionada(null)}
      />
    );
  }

  async function salvarHectares() {
    const ha = parseFloat(hectaresTemp.replace(',', '.'));
    await atualizarHectaresTalhao(talhao.id, isNaN(ha) || ha <= 0 ? null : ha);
    setEditandoHectares(false);
  }

  async function selecionarCultura(nome) {
    await adicionarCulturaTalhao(talhao.id, nome);
    setModalNovaCultura(false);
  }

  function confirmarRemoverCultura(culturaId, nome) {
    setPendingDelete({ id: culturaId, label: nome });
  }

  const culturas = talhao.culturas || [];

  return (
    <View style={styles.root}>
      <View style={styles.detalheHeader}>
        <TouchableOpacity onPress={onVoltar} style={styles.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.detalheTitulo} numberOfLines={1}>{talhao.nome}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.secao}>
          {/* Hectares */}
          <Card style={{ padding: 14 }}>
            <View style={styles.culturaRow}>
              <View style={[styles.culturaIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="resize-outline" size={20} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.culturaLabel}>Área do talhão</Text>
                {editandoHectares ? (
                  <View style={styles.culturaEditRow}>
                    <TextInput
                      style={styles.culturaInput}
                      value={hectaresTemp}
                      onChangeText={setHectaresTemp}
                      placeholder="Ex: 12,5"
                      autoFocus
                      keyboardType="decimal-pad"
                      placeholderTextColor="#9CA3AF"
                    />
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: '#6B7280' }}>ha</Text>
                    <TouchableOpacity onPress={salvarHectares}>
                      <Ionicons name="checkmark-circle" size={28} color="#D97706" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => { setHectaresTemp(talhao.hectares ? String(talhao.hectares) : ''); setEditandoHectares(true); }}>
                    <Text style={[styles.culturaValor, { color: '#D97706' }, !talhao.hectares && { color: '#9CA3AF' }]}>
                      {talhao.hectares ? `${talhao.hectares} ha` : 'Toque para informar a área'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Card>

          {/* Lista de culturas */}
          <SectionHeader title={`Culturas (${culturas.length})`} />

          {culturas.length === 0 && (
            <Card style={styles.emptyCard}>
              <Ionicons name="leaf-outline" size={32} color="#D1D5DB" />
              <Text style={styles.emptyTxt}>Nenhuma cultura cadastrada</Text>
              <Text style={styles.emptySub}>Toque em + para adicionar</Text>
            </Card>
          )}

          {culturas.map((c, i) => {
            const cor = CORES_CULTURA[i % CORES_CULTURA.length];
            return (
              <View key={c.id} style={[styles.culturaCard, { borderLeftColor: cor }]}>
                <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }} activeOpacity={0.8} onPress={() => setCulturaSelecionada(c)}>
                  <View style={[styles.culturaIconBox, { backgroundColor: cor + '20' }]}>
                    <Ionicons name="leaf" size={22} color={cor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.culturaNome}>{c.nome}</Text>
                    <Text style={styles.culturaRegistroCount}>
                      {(c.registros || []).length} registro{(c.registros || []).length !== 1 ? 's' : ''}
                      {c.hectares ? `  ·  ${c.hectares} ha` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmarRemoverCultura(c.id, c.nome)}
                  style={styles.deleteBtn}
                >
                  <Ionicons name="trash-outline" size={20} color={DANGER} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: MARROM }]}
        onPress={() => setModalNovaCultura(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal confirmar exclusão de cultura */}
      <Modal visible={!!pendingDelete} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconBox}>
              <Ionicons name="trash-outline" size={28} color={DANGER} />
            </View>
            <Text style={styles.confirmTitulo}>Remover cultura?</Text>
            <Text style={styles.confirmMsg}>"{pendingDelete?.label}" e todos os seus registros serão removidos.</Text>
            <View style={styles.confirmAcoes}>
              <TouchableOpacity style={styles.confirmBtnCancelar} onPress={() => setPendingDelete(null)}>
                <Text style={styles.confirmBtnCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtnExcluir} onPress={() => {
                removerCulturaTalhao(talhao.id, pendingDelete.id);
                setPendingDelete(null);
              }}>
                <Text style={styles.confirmBtnExcluirTxt}>Remover</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalNovaCultura} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalTitulo}>Qual cultura?</Text>
              <TouchableOpacity onPress={() => setModalNovaCultura(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.culturaGrid}>
              {CULTURAS_PREDEFINIDAS.map(c => (
                <TouchableOpacity
                  key={c.nome}
                  style={[styles.culturaPreBtn, { borderColor: c.cor, backgroundColor: c.cor + '15' }]}
                  onPress={() => selecionarCultura(c.nome)}
                  activeOpacity={0.75}
                >
                  <Ionicons name={c.icone} size={28} color={c.cor} />
                  <Text style={[styles.culturaPreTxt, { color: c.cor }]}>{c.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Lista de talhões ─────────────────────────────────────────────────────────

export default function TalhaoScreen() {
  const { talhoes, adicionarTalhao, removerTalhao } = useStorage();
  const [talhaoAtivo, setTalhaoAtivo] = useState(null);
  const [modalNovo, setModalNovo]     = useState(false);
  const [novoNome, setNovoNome]       = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const talhaoAtivoAtualizado = talhaoAtivo ? talhoes.find(t => t.id === talhaoAtivo.id) || null : null;

  if (talhaoAtivoAtualizado) {
    return <TalhaoDetalhe talhao={talhaoAtivoAtualizado} onVoltar={() => setTalhaoAtivo(null)} />;
  }

  async function salvarNovo() {
    const nome = novoNome.trim();
    if (!nome) { Alert.alert('Nome obrigatório', 'Informe o nome do talhão.'); return; }
    await adicionarTalhao(nome, null);
    setNovoNome(''); setModalNovo(false);
  }

  function confirmarRemover(id, nome) {
    setPendingDelete({ id, label: nome });
  }

  return (
    <View style={styles.root}>
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.secao}>
          {talhoes.length === 0 && (
            <Card style={styles.emptyCard}>
              <Ionicons name="map-outline" size={36} color="#D1D5DB" />
              <Text style={styles.emptyTxt}>Nenhum talhão cadastrado</Text>
              <Text style={styles.emptySub}>Toque em + para adicionar</Text>
            </Card>
          )}
          {talhoes.map(t => (
            <TouchableOpacity key={t.id} activeOpacity={0.8} onPress={() => setTalhaoAtivo(t)}>
              <Card style={styles.talhaoCard}>
                <View style={styles.talhaoIconBox}>
                  <Ionicons name="map" size={24} color={MARROM} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.talhaoNome}>{t.nome}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {(t.culturas || []).map((c, i) => (
                      <View key={c.id} style={[styles.culturaBadge, { backgroundColor: CORES_CULTURA[i % CORES_CULTURA.length] + '20', borderColor: CORES_CULTURA[i % CORES_CULTURA.length] }]}>
                        <Text style={[styles.culturaBadgeTxt, { color: CORES_CULTURA[i % CORES_CULTURA.length] }]}>{c.nome}</Text>
                      </View>
                    ))}
                    {(t.culturas || []).length === 0 && (
                      <Text style={styles.talhaoSemCultura}>Nenhuma cultura</Text>
                    )}
                  </View>
                  <Text style={styles.talhaoCount}>
                    {(t.culturas || []).reduce((acc, c) => acc + (c.registros || []).length, 0)} registros
                    {t.hectares ? `  ·  ${t.hectares} ha` : ''}
                  </Text>
                </View>
                <View style={styles.talhaoRight}>
                  <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                  <TouchableOpacity onPress={() => confirmarRemover(t.id, t.nome)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={18} color={DANGER} />
                  </TouchableOpacity>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: MARROM }]}
        onPress={() => { setNovoNome(''); setModalNovo(true); }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal confirmar exclusão de talhão */}
      <Modal visible={!!pendingDelete} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconBox}>
              <Ionicons name="trash-outline" size={28} color={DANGER} />
            </View>
            <Text style={styles.confirmTitulo}>Remover talhão?</Text>
            <Text style={styles.confirmMsg}>"{pendingDelete?.label}" e todas as suas culturas serão removidos.</Text>
            <View style={styles.confirmAcoes}>
              <TouchableOpacity style={styles.confirmBtnCancelar} onPress={() => setPendingDelete(null)}>
                <Text style={styles.confirmBtnCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtnExcluir} onPress={() => {
                removerTalhao(pendingDelete.id);
                setPendingDelete(null);
              }}>
                <Text style={styles.confirmBtnExcluirTxt}>Remover</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalNovo} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Novo Talhão</Text>
            <Input label="Nome do talhão" value={novoNome} onChangeText={setNovoNome} placeholder="Ex: Talhão 3, Área do Córrego..." autoFocus />
            <View style={styles.modalAcoes}>
              <Button label="Cancelar" onPress={() => setModalNovo(false)} variant="secondary" style={{ flex: 1 }} />
              <Button label="Salvar" onPress={salvarNovo} variant="primary" style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F6F1' },
  secao: { padding: 16, gap: 12, paddingBottom: 32 },

  // Cabeçalho interno
  detalheHeader: {
    backgroundColor: MARROM, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  voltarBtn: { padding: 4 },
  detalheSubtitulo: { fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 2 },
  detalheTitulo: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#fff' },
  haBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  haBtnTxt: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#fff' },
  haInput: { width: 60, borderBottomWidth: 1.5, borderBottomColor: '#fff', color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 15, textAlign: 'center', paddingVertical: 2 },

  // Grid de culturas pré-definidas
  culturaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', paddingBottom: 8 },
  culturaPreBtn: { width: '28%', aspectRatio: 1, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: 6 },
  culturaPreTxt: { fontFamily: 'Inter_700Bold', fontSize: 13 },

  // Área / cultura edit
  culturaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  culturaIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  culturaLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  culturaValor: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#27AE60', marginTop: 4 },
  culturaEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  culturaInput: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    fontFamily: 'Inter_400Regular', fontSize: 15, color: '#1A1A1A', backgroundColor: '#FAFAF8',
  },

  // Cards de cultura na lista do talhão
  culturaCard: {
    padding: 16, flexDirection: 'row', alignItems: 'center',
    gap: 0, borderLeftWidth: 4, borderRadius: 16,
    backgroundColor: '#fff', overflow: 'visible',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  culturaNome: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#1A1A1A' },
  culturaRegistroCount: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#9CA3AF', marginTop: 2 },

  // Timeline
  timelineItem: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  timelineLeft: { alignItems: 'center', width: 32 },
  timelineDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#E5E7EB', marginTop: 4, minHeight: 20 },
  registroCard: { flex: 1, padding: 12, gap: 6, marginBottom: 0 },
  registroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  registroData: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#9CA3AF' },
  registroDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#374151', lineHeight: 19 },
  registroProduto: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6B7280' },
  registroAcoes: { flexDirection: 'row', alignSelf: 'flex-end', gap: 4 },

  // Lista de talhões
  talhaoCard: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  talhaoIconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#EFEBE9', alignItems: 'center', justifyContent: 'center' },
  talhaoNome: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#1A1A1A' },
  talhaoSemCultura: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#D1D5DB' },
  talhaoCount: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  talhaoRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  culturaBadge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  culturaBadgeTxt: { fontFamily: 'Inter_500Medium', fontSize: 12 },

  // Linha com item + delete
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  // Empty
  emptyCard: { alignItems: 'center', padding: 32, gap: 8 },
  emptyTxt: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#9CA3AF' },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#D1D5DB' },

  // FAB
  fab: {
    position: 'absolute', right: 16, bottom: 24,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitulo: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#1A1A1A', marginBottom: 4 },
  modalAcoes: { flexDirection: 'row', gap: 10, marginTop: 4 },
  fieldLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 },

  // Modal confirmar exclusão
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  confirmBox: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', alignItems: 'center', gap: 10 },
  confirmIconBox: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  confirmTitulo: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#1A1A1A' },
  confirmMsg: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  confirmAcoes: { flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' },
  confirmBtnCancelar: { flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: '#fff' },
  confirmBtnCancelarTxt: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#6B7280' },
  confirmBtnExcluir: { flex: 1, backgroundColor: DANGER, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  confirmBtnExcluirTxt: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#fff' },

  // Pendente
  registroCardPendente: { borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  pendenteBadge: { backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  pendenteBadgeTxt: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#D97706' },
  confirmarPendenciaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#27AE60', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, marginTop: 4, alignSelf: 'flex-start',
  },
  confirmarPendenciaTxt: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#fff' },
  pendenteToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14,
    padding: 14, backgroundColor: '#FAFAF8',
  },
  pendenteToggleAtivo: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  pendenteToggleTxt: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#374151' },
  pendenteToggleSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  sementeCalcInfo: {
    fontFamily: 'Inter_500Medium', fontSize: 12, color: '#27AE60',
    backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },

  tipoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff',
  },
  tipoChipTxt: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#6B7280' },

  // Produtos utilizados
  produtosSection: { gap: 8 },
  produtoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F9FAFB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  produtoNome:    { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#1A1A1A' },
  produtoCat:     { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  produtoQtdInput: {
    width: 72, borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 12,
    fontFamily: 'Inter_400Regular', fontSize: 15, color: '#1A1A1A',
    textAlign: 'center', backgroundColor: '#fff',
  },
  produtoUnidade: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B7280', width: 26 },
  doseRow:        { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  doseSep:        { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B7280', flex: 1 },
  doseTotalLabel: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#6B7280' },
  doseTotal:      { fontFamily: 'Inter_700Bold', fontSize: 15, color: PRIMARY },
  addProdutoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 16, paddingHorizontal: 16,
    borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 12,
    borderStyle: 'dashed',
  },
  addProdutoBtnTxt: { fontFamily: 'Inter_500Medium', fontSize: 15, color: PRIMARY },
  produtoPickerItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  produtoPickerNome: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#1A1A1A' },
  produtoPickerEstoque: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#27AE60' },
});
