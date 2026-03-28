import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStorage } from '../storage/StorageContext';
import { CATEGORIAS_SEMENTES } from '../constants';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Input from '../components/Input';
import SectionHeader from '../components/SectionHeader';

const PRIMARY  = '#1B4332';
const DANGER   = '#C0392B';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatNPK(text) {
  const numbers = text.replace(/[^\d]/g, '');
  const limited = numbers.slice(0, 6);
  if (limited.length <= 2) return limited;
  if (limited.length <= 4) return limited.slice(0, 2) + '/' + limited.slice(2);
  return limited.slice(0, 2) + '/' + limited.slice(2, 4) + '/' + limited.slice(4);
}

function formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function abaixoDoMinimo(item) {
  return (
    item.estoqueMinimo != null &&
    item.estoqueMinimo > 0 &&
    (item.quantidade || 0) < item.estoqueMinimo
  );
}

function MetricChip({ label, value, cor }) {
  return (
    <View style={[styles.chip, { backgroundColor: cor + '18' }]}>
      <Text style={[styles.chipValue, { color: cor }]}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

// ─── Modal de detalhe ────────────────────────────────────────────────────────

function ModalDetalhe({ visivel, item, corCategoria = PRIMARY, onFechar, onMovimentacao, onSalvarConfig, isSemente }) {
  const [aba, setAba] = useState('historico');
  const [tipoMov, setTipoMov] = useState('entrada');
  const [qtdMov, setQtdMov] = useState('');
  const [motivoMov, setMotivoMov] = useState('');
  const [estoqueMin, setEstoqueMin] = useState('');
  const [custo, setCusto] = useState('');
  const [sementesPorSaco, setSementesPorSaco] = useState('');

  function aoAbrir() {
    setAba('historico');
    setQtdMov('');
    setMotivoMov('');
    setTipoMov('entrada');
    setEstoqueMin(item?.estoqueMinimo != null ? String(item.estoqueMinimo) : '');
    setCusto(item?.custoPorUnidade != null ? String(item.custoPorUnidade) : '');
    setSementesPorSaco(item?.sementesPorSaco != null ? String(item.sementesPorSaco) : '');
  }

  function salvarMovimentacao() {
    const qtd = parseFloat(qtdMov.replace(',', '.'));
    if (isNaN(qtd) || qtd <= 0) {
      Alert.alert('Quantidade inválida', 'Informe uma quantidade maior que zero.');
      return;
    }
    onMovimentacao({ tipo: tipoMov, quantidade: qtd, motivo: motivoMov.trim() });
    setQtdMov('');
    setMotivoMov('');
  }

  function salvarConfig() {
    const min = parseFloat(estoqueMin.replace(',', '.'));
    const cst = parseFloat(custo.replace(',', '.'));
    const cfg = {
      estoqueMinimo: isNaN(min) || min <= 0 ? null : min,
      custoPorUnidade: isNaN(cst) || cst <= 0 ? null : cst,
    };
    if (isSemente) {
      const spc = parseFloat(sementesPorSaco.replace(',', '.'));
      cfg.sementesPorSaco = (!isNaN(spc) && spc > 0) ? spc : null;
    }
    onSalvarConfig(cfg);
    Alert.alert('Salvo', 'Configurações atualizadas.');
  }

  if (!item) return null;

  const movimentacoes = item.movimentacoes || [];
  const custoTotal =
    item.custoPorUnidade && item.quantidade
      ? `R$ ${(item.custoPorUnidade * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : null;
  const alerta = abaixoDoMinimo(item);

  return (
    <Modal visible={visivel} transparent animationType="slide" onShow={aoAbrir}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={[styles.sheetHeader, { backgroundColor: corCategoria }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitulo} numberOfLines={1}>{item.nome ?? item.npk}</Text>
              <View style={styles.sheetSubRow}>
                <Text style={styles.sheetSub}>{item.quantidade} {item.unidade}</Text>
                {alerta && (
                  <View style={styles.sheetAlertaPill}>
                    <Ionicons name="warning" size={11} color="#92400E" />
                    <Text style={styles.sheetAlertaTxt}>Abaixo do mínimo</Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={onFechar} style={styles.sheetClose}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Custo total */}
          {custoTotal && (
            <View style={styles.custoRow}>
              <Ionicons name="cash-outline" size={15} color="#6B7280" />
              <Text style={styles.custoTxt}>
                Valor em estoque: <Text style={styles.custoDestaque}>{custoTotal}</Text>
                {'  '}(R$ {item.custoPorUnidade}/{item.unidade})
              </Text>
            </View>
          )}

          {/* Tabs */}
          <View style={styles.tabsRow}>
            {['historico', 'config'].map(a => (
              <TouchableOpacity
                key={a}
                style={[styles.tabBtn, aba === a && { backgroundColor: corCategoria }]}
                onPress={() => setAba(a)}
              >
                <Text style={[styles.tabBtnTxt, aba === a && { color: '#fff' }]}>
                  {a === 'historico' ? 'Movimentações' : 'Configurar'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>
              {aba === 'historico' ? (
                <>
                  <SectionHeader title="Registrar movimentação" />
                  {/* Tipo */}
                  <View style={styles.tipoRow}>
                    {['entrada', 'saida'].map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.tipoBtn,
                          tipoMov === t && {
                            backgroundColor: t === 'entrada' ? PRIMARY : DANGER,
                            borderColor: t === 'entrada' ? PRIMARY : DANGER,
                          },
                        ]}
                        onPress={() => setTipoMov(t)}
                      >
                        <Ionicons
                          name={t === 'entrada' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                          size={16}
                          color={tipoMov === t ? '#fff' : '#6B7280'}
                        />
                        <Text style={[styles.tipoBtnTxt, tipoMov === t && { color: '#fff' }]}>
                          {t === 'entrada' ? 'Entrada' : 'Saída'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Input
                    label={`Quantidade (${item.unidade})`}
                    value={qtdMov}
                    onChangeText={setQtdMov}
                    keyboardType="decimal-pad"
                    placeholder="0"
                  />
                  <Input
                    label="Motivo (opcional)"
                    value={motivoMov}
                    onChangeText={setMotivoMov}
                    placeholder="Ex: compra, aplicação..."
                  />
                  <Button label="Registrar" onPress={salvarMovimentacao} variant="primary" />

                  <SectionHeader title={`Histórico (${movimentacoes.length})`} className="mt-2" />
                  {movimentacoes.length === 0 && (
                    <Text style={styles.vazio}>Nenhuma movimentação registrada</Text>
                  )}
                  {movimentacoes.map(m => (
                    <View key={m.id} style={styles.movRow}>
                      <View style={[styles.movIconBox, { backgroundColor: m.tipo === 'entrada' ? '#D1FAE5' : '#FEE2E2' }]}>
                        <Ionicons
                          name={m.tipo === 'entrada' ? 'arrow-down' : 'arrow-up'}
                          size={14}
                          color={m.tipo === 'entrada' ? '#065F46' : '#991B1B'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.movQtd}>
                          {m.tipo === 'entrada' ? '+' : '-'}{m.quantidade} {item.unidade}
                          {m.motivo ? `  —  ${m.motivo}` : ''}
                        </Text>
                        <Text style={styles.movData}>{formatarData(m.data)}</Text>
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                <>
                  <Input
                    label={`Estoque mínimo (${item.unidade})`}
                    value={estoqueMin}
                    onChangeText={setEstoqueMin}
                    keyboardType="decimal-pad"
                    placeholder="Alerta quando abaixo deste valor"
                  />
                  <Input
                    label={`Custo por ${item.unidade} (R$)`}
                    value={custo}
                    onChangeText={setCusto}
                    keyboardType="decimal-pad"
                    placeholder="Ex: 3,50"
                  />
                  {isSemente && item.unidade === 'sc' && (
                    <Input
                      label="Sementes por saco"
                      value={sementesPorSaco}
                      onChangeText={setSementesPorSaco}
                      keyboardType="decimal-pad"
                      placeholder="Ex: 80000"
                    />
                  )}
                  {item.custoPorUnidade && item.quantidade ? (
                    <Card style={styles.custoPreview}>
                      <Text style={styles.custoPreviewTxt}>
                        Valor total em estoque:{' '}
                        <Text style={{ fontFamily: 'Inter_700Bold', color: PRIMARY }}>
                          R$ {(item.custoPorUnidade * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </Text>
                      </Text>
                    </Card>
                  ) : null}
                  <Button label="Salvar configurações" onPress={salvarConfig} variant="primary" />
                </>
              )}
              <View style={{ height: 32 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal de confirmação de exclusão ────────────────────────────────────────

function ModalConfirmarExclusao({ visivel, label, onConfirmar, onCancelar }) {
  return (
    <Modal visible={visivel} transparent animationType="fade">
      <View style={styles.confirmOverlay}>
        <View style={styles.confirmBox}>
          <View style={styles.confirmIconBox}>
            <Ionicons name="trash-outline" size={28} color={DANGER} />
          </View>
          <Text style={styles.confirmTitulo}>Excluir produto?</Text>
          <Text style={styles.confirmMsg}>
            {label ? `"${label}" será removido do estoque.` : 'O item será removido do estoque.'}
          </Text>
          <View style={styles.confirmAcoes}>
            <TouchableOpacity style={styles.confirmBtnCancelar} onPress={onCancelar}>
              <Text style={styles.confirmBtnCancelarTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtnExcluir} onPress={onConfirmar}>
              <Text style={styles.confirmBtnExcluirTxt}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Adubos ──────────────────────────────────────────────────────────────────

function AdubosSection() {
  const { adubos, adicionarAdubo, removerAdubo, atualizarConfigAdubo, adicionarMovimentacaoAdubo } = useStorage();
  const [modalAdd, setModalAdd] = useState(false);
  const [modalDetalhe, setModalDetalhe] = useState(null);
  const [npk, setNpk] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [unidade, setUnidade] = useState('kg');
  const [pendingDelete, setPendingDelete] = useState(null); // { id, label }

  function abrirAdd() { setNpk(''); setQuantidade(''); setUnidade('kg'); setModalAdd(true); }

  async function salvar() {
    const npkTrim = npk.trim();
    const qtd = parseFloat(quantidade.replace(',', '.'));
    if (!npkTrim || isNaN(qtd) || qtd <= 0) {
      Alert.alert('Dados inválidos', 'Informe o NPK e uma quantidade válida.');
      return;
    }
    const partes = npkTrim.split(/[\/\-]/).map(p => p.trim());
    if (partes.length !== 3) {
      Alert.alert('Formato inválido', 'NPK deve estar no formato N/P/K. Ex: 4/14/0');
      return;
    }
    await adicionarAdubo(partes.join('/'), qtd, unidade);
    setModalAdd(false);
  }

  function confirmarRemover(id, label) {
    setPendingDelete({ id, label });
  }

  const itemAtual = modalDetalhe ? adubos.find(a => a.id === modalDetalhe.id) ?? null : null;

  return (
    <View style={styles.secao}>
      {adubos.length === 0 && (
        <Card style={styles.emptyCard}>
          <Ionicons name="bag-outline" size={32} color="#D1D5DB" />
          <Text style={styles.emptyTxt}>Nenhum adubo no estoque</Text>
          <Text style={styles.emptySub}>Toque em + para adicionar</Text>
        </Card>
      )}

      {adubos.map(a => {
        const alerta = abaixoDoMinimo(a);
        return (
          <View key={a.id} style={styles.itemRow}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.8} onPress={() => setModalDetalhe(a)}>
              <Card style={[styles.itemCard, alerta && styles.itemCardAlerta]}>
                <View style={styles.itemLeft}>
                  <View style={[styles.itemIconBox, { backgroundColor: PRIMARY + '18' }]}>
                    <Ionicons name="bag" size={20} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemNpk}>{a.npk}</Text>
                    <Text style={styles.itemQtd}>{a.quantidade} {a.unidade}</Text>
                    <View style={styles.itemBadgeRow}>
                      {alerta && <Badge label="Abaixo do mínimo" variant="danger" />}
                      {a.custoPorUnidade && a.quantidade && (
                        <Badge
                          label={`R$ ${(a.custoPorUnidade * a.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                          variant="success"
                        />
                      )}
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
              </Card>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => confirmarRemover(a.id, a.npk)}
              style={styles.deleteBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color={DANGER} />
            </TouchableOpacity>
          </View>
        );
      })}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={abrirAdd} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal adicionar */}
      <Modal visible={modalAdd} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Adicionar Adubo</Text>
            <Input label="NPK (N/P/K)" value={npk} onChangeText={t => setNpk(formatNPK(t))} placeholder="00/00/00" keyboardType="numeric" maxLength={8} />
            <Input label="Quantidade" value={quantidade} onChangeText={setQuantidade} keyboardType="decimal-pad" placeholder="Ex: 5800" />
            <Text style={styles.unidadeLabel}>Unidade</Text>
            <View style={styles.unidadeRow}>
              {['kg', 'sc', 't'].map(u => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unidadeBtn, unidade === u && styles.unidadeBtnAtivo]}
                  onPress={() => setUnidade(u)}
                >
                  <Text style={[styles.unidadeTxt, unidade === u && styles.unidadeTxtAtivo]}>{u.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalAcoes}>
              <Button label="Cancelar" onPress={() => setModalAdd(false)} variant="secondary" style={{ flex: 1 }} />
              <Button label="Salvar" onPress={salvar} variant="primary" style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ModalDetalhe
        visivel={!!itemAtual}
        item={itemAtual}
        corCategoria={PRIMARY}
        onFechar={() => setModalDetalhe(null)}
        onMovimentacao={mov => adicionarMovimentacaoAdubo(modalDetalhe.id, mov)}
        onSalvarConfig={cfg => atualizarConfigAdubo(modalDetalhe.id, cfg)}
      />

      <ModalConfirmarExclusao
        visivel={!!pendingDelete}
        label={pendingDelete?.label}
        onConfirmar={() => { removerAdubo(pendingDelete.id); setPendingDelete(null); }}
        onCancelar={() => setPendingDelete(null)}
      />
    </View>
  );
}

// ─── Líquidos ─────────────────────────────────────────────────────────────────

const CATEGORIAS = [
  { key: 'herbicidas',  label: 'Herbicidas',  cor: '#C0392B' },
  { key: 'fungicidas',  label: 'Fungicidas',  cor: '#1565C0' },
  { key: 'inseticidas', label: 'Inseticidas', cor: '#E65100' },
  { key: 'adjuvantes',  label: 'Adjuvantes',  cor: '#6A1B9A' },
  { key: 'foliares',    label: 'Foliares',    cor: '#2D6A4F' },
];

function LiquidosSection() {
  const { liquidos, adicionarLiquido, removerLiquido, atualizarConfigLiquido, adicionarMovimentacaoLiquido } = useStorage();
  const [catAtiva, setCatAtiva] = useState('herbicidas');
  const [modalAdd, setModalAdd] = useState(false);
  const [modalDetalhe, setModalDetalhe] = useState(null);
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [unidade, setUnidade] = useState('L');
  const [pendingDelete, setPendingDelete] = useState(null); // { id, label }

  const catInfo = CATEGORIAS.find(c => c.key === catAtiva);
  const produtos = liquidos[catAtiva] || [];

  function abrirAdd() { setNome(''); setQuantidade(''); setUnidade('L'); setModalAdd(true); }

  async function salvar() {
    const nomeTrim = nome.trim();
    const qtd = parseFloat(quantidade.replace(',', '.'));
    if (!nomeTrim || isNaN(qtd) || qtd <= 0) {
      Alert.alert('Dados inválidos', 'Informe o nome e a quantidade.');
      return;
    }
    await adicionarLiquido(catAtiva, nomeTrim, qtd, unidade);
    setModalAdd(false);
  }

  function confirmarRemover(id, label) {
    setPendingDelete({ id, label });
  }

  const itemAtual = modalDetalhe ? (liquidos[catAtiva] || []).find(p => p.id === modalDetalhe.id) ?? null : null;

  return (
    <View style={styles.secao}>
      {/* Tabs de categoria */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        {CATEGORIAS.map(c => {
          const temAlerta = (liquidos[c.key] || []).some(abaixoDoMinimo);
          const ativa = catAtiva === c.key;
          return (
            <TouchableOpacity
              key={c.key}
              style={[styles.catTab, ativa && { backgroundColor: c.cor, borderColor: c.cor }]}
              onPress={() => { setCatAtiva(c.key); setModalDetalhe(null); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.catTabTxt, ativa && { color: '#fff' }]}>{c.label}</Text>
              {temAlerta && <View style={[styles.alertaDot, ativa && { backgroundColor: '#fff' }]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Lista */}
      {produtos.length === 0 && (
        <Card style={styles.emptyCard}>
          <Ionicons name="flask-outline" size={32} color="#D1D5DB" />
          <Text style={styles.emptyTxt}>Nenhum produto em {catInfo.label}</Text>
          <Text style={styles.emptySub}>Toque em + para adicionar</Text>
        </Card>
      )}

      {produtos.map(p => {
        const alerta = abaixoDoMinimo(p);
        return (
          <View key={p.id} style={styles.itemRow}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.8} onPress={() => setModalDetalhe(p)}>
              <Card style={[styles.itemCard, alerta && styles.itemCardAlerta]}>
                <View style={[styles.itemColorBar, { backgroundColor: catInfo.cor }]} />
                <View style={styles.itemLeft}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemNome}>{p.nome}</Text>
                    <Text style={styles.itemQtd}>{p.quantidade} {p.unidade}</Text>
                    <View style={styles.itemBadgeRow}>
                      {alerta && <Badge label="Abaixo do mínimo" variant="danger" />}
                      {p.custoPorUnidade && p.quantidade && (
                        <Badge
                          label={`R$ ${(p.custoPorUnidade * p.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                          variant="success"
                        />
                      )}
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
              </Card>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => confirmarRemover(p.id, p.nome)}
              style={styles.deleteBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color={DANGER} />
            </TouchableOpacity>
          </View>
        );
      })}

      {/* FAB */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: catInfo.cor }]} onPress={abrirAdd} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal adicionar */}
      <Modal visible={modalAdd} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Adicionar {catInfo.label.slice(0, -1)}</Text>
            <Input label="Nome do produto" value={nome} onChangeText={setNome} placeholder="Ex: Roundup" />
            <Input label="Quantidade" value={quantidade} onChangeText={setQuantidade} keyboardType="decimal-pad" placeholder="Ex: 160" />
            <Text style={styles.unidadeLabel}>Unidade</Text>
            <View style={styles.unidadeRow}>
              {['L', 'kg'].map(u => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unidadeBtn, unidade === u && { backgroundColor: catInfo.cor, borderColor: catInfo.cor }]}
                  onPress={() => setUnidade(u)}
                >
                  <Text style={[styles.unidadeTxt, unidade === u && styles.unidadeTxtAtivo]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalAcoes}>
              <Button label="Cancelar" onPress={() => setModalAdd(false)} variant="secondary" style={{ flex: 1 }} />
              <Button label="Salvar" onPress={salvar} variant="primary" style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ModalDetalhe
        visivel={!!itemAtual}
        item={itemAtual}
        corCategoria={catInfo.cor}
        onFechar={() => setModalDetalhe(null)}
        onMovimentacao={mov => adicionarMovimentacaoLiquido(catAtiva, modalDetalhe.id, mov)}
        onSalvarConfig={cfg => atualizarConfigLiquido(catAtiva, modalDetalhe.id, cfg)}
      />

      <ModalConfirmarExclusao
        visivel={!!pendingDelete}
        label={pendingDelete?.label}
        onConfirmar={() => { removerLiquido(catAtiva, pendingDelete.id); setPendingDelete(null); }}
        onCancelar={() => setPendingDelete(null)}
      />
    </View>
  );
}

// ─── Sementes ─────────────────────────────────────────────────────────────────

function SementesSection() {
  const { sementes, adicionarSemente, removerSemente, atualizarConfigSemente, adicionarMovimentacaoSemente } = useStorage();
  const [catAtiva, setCatAtiva] = useState('milho');
  const [modalAdd, setModalAdd] = useState(false);
  const [modalDetalhe, setModalDetalhe] = useState(null);
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [unidade, setUnidade] = useState('sc');
  const [sementesPorSaco, setSementesPorSaco] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const catInfo = CATEGORIAS_SEMENTES.find(c => c.key === catAtiva);
  const produtos = sementes[catAtiva] || [];

  function abrirAdd() { setNome(''); setQuantidade(''); setUnidade('sc'); setSementesPorSaco(''); setModalAdd(true); }

  async function salvar() {
    const nomeTrim = nome.trim();
    const qtd = parseFloat(quantidade.replace(',', '.'));
    if (!nomeTrim || isNaN(qtd) || qtd <= 0) {
      Alert.alert('Dados inválidos', 'Informe o nome e a quantidade.');
      return;
    }
    const spc = parseFloat(sementesPorSaco.replace(',', '.'));
    await adicionarSemente(catAtiva, nomeTrim, qtd, unidade, (!isNaN(spc) && spc > 0) ? spc : null);
    setModalAdd(false);
  }

  const itemAtual = modalDetalhe ? (sementes[catAtiva] || []).find(p => p.id === modalDetalhe.id) ?? null : null;

  return (
    <View style={styles.secao}>
      {/* Tabs de categoria */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        {CATEGORIAS_SEMENTES.map(c => {
          const ativa = catAtiva === c.key;
          return (
            <TouchableOpacity
              key={c.key}
              style={[styles.catTab, ativa && { backgroundColor: c.cor, borderColor: c.cor }]}
              onPress={() => { setCatAtiva(c.key); setModalDetalhe(null); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.catTabTxt, ativa && { color: '#fff' }]}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Lista */}
      {produtos.length === 0 && (
        <Card style={styles.emptyCard}>
          <Ionicons name="leaf-outline" size={32} color="#D1D5DB" />
          <Text style={styles.emptyTxt}>Nenhuma semente em {catInfo.label}</Text>
          <Text style={styles.emptySub}>Toque em + para adicionar</Text>
        </Card>
      )}

      {produtos.map(p => {
        const alerta = abaixoDoMinimo(p);
        return (
          <View key={p.id} style={styles.itemRow}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.8} onPress={() => setModalDetalhe(p)}>
              <Card style={[styles.itemCard, alerta && styles.itemCardAlerta]}>
                <View style={[styles.itemColorBar, { backgroundColor: catInfo.cor }]} />
                <View style={styles.itemLeft}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemNome}>{p.nome}</Text>
                    <Text style={styles.itemQtd}>{p.quantidade} {p.unidade}</Text>
                    <View style={styles.itemBadgeRow}>
                      {alerta && <Badge label="Abaixo do mínimo" variant="danger" />}
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
              </Card>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPendingDelete({ id: p.id, label: p.nome })}
              style={styles.deleteBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color={DANGER} />
            </TouchableOpacity>
          </View>
        );
      })}

      {/* FAB */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: catInfo.cor }]} onPress={abrirAdd} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal adicionar */}
      <Modal visible={modalAdd} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Adicionar {catInfo.labelSingular}</Text>
            <Input label="Cultivar / Variedade" value={nome} onChangeText={setNome} placeholder="Ex: DKB 290, Intacta RR2" />
            <Input label="Quantidade" value={quantidade} onChangeText={setQuantidade} keyboardType="decimal-pad" placeholder="Ex: 50" />
            <Text style={styles.unidadeLabel}>Unidade</Text>
            <View style={styles.unidadeRow}>
              {['sc', 'kg'].map(u => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unidadeBtn, unidade === u && { backgroundColor: catInfo.cor, borderColor: catInfo.cor }]}
                  onPress={() => setUnidade(u)}
                >
                  <Text style={[styles.unidadeTxt, unidade === u && styles.unidadeTxtAtivo]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {unidade === 'sc' && (
              <Input
                label="Sementes por saco (opcional)"
                value={sementesPorSaco}
                onChangeText={setSementesPorSaco}
                keyboardType="decimal-pad"
                placeholder="Ex: 80000"
              />
            )}
            <View style={styles.modalAcoes}>
              <Button label="Cancelar" onPress={() => setModalAdd(false)} variant="secondary" style={{ flex: 1 }} />
              <Button label="Salvar" onPress={salvar} variant="primary" style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ModalDetalhe
        visivel={!!itemAtual}
        item={itemAtual}
        isSemente
        corCategoria={catInfo.cor}
        onFechar={() => setModalDetalhe(null)}
        onMovimentacao={mov => adicionarMovimentacaoSemente(catAtiva, modalDetalhe.id, mov)}
        onSalvarConfig={cfg => atualizarConfigSemente(catAtiva, modalDetalhe.id, cfg)}
      />

      <ModalConfirmarExclusao
        visivel={!!pendingDelete}
        label={pendingDelete?.label}
        onConfirmar={() => { removerSemente(catAtiva, pendingDelete.id); setPendingDelete(null); }}
        onCancelar={() => setPendingDelete(null)}
      />
    </View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────

export default function EstoqueScreen() {
  const [abaAtiva, setAbaAtiva] = useState('adubos');

  return (
    <View style={styles.root}>
      {/* Tabs principais */}
      <View style={styles.mainTabs}>
        {[
          { key: 'adubos',   label: 'Adubos',   icone: 'bag-outline' },
          { key: 'liquidos', label: 'Líquidos',  icone: 'flask-outline' },
          { key: 'sementes', label: 'Sementes',  icone: 'leaf-outline' },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.mainTab, abaAtiva === t.key && styles.mainTabAtivo]}
            onPress={() => setAbaAtiva(t.key)}
          >
            <Ionicons name={t.icone} size={18} color={abaAtiva === t.key ? PRIMARY : '#9CA3AF'} />
            <Text style={[styles.mainTabTxt, abaAtiva === t.key && styles.mainTabTxtAtivo]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {abaAtiva === 'adubos' && <AdubosSection />}
        {abaAtiva === 'liquidos' && <LiquidosSection />}
        {abaAtiva === 'sementes' && <SementesSection />}
      </ScrollView>
    </View>
  );
}

// ─── estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F6F1' },

  // Tabs principais
  mainTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  mainTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 18 },
  mainTabAtivo: { borderBottomWidth: 2, borderBottomColor: PRIMARY },
  mainTabTxt: { fontFamily: 'Inter_500Medium', fontSize: 16, color: '#9CA3AF' },
  mainTabTxtAtivo: { fontFamily: 'Inter_700Bold', color: PRIMARY },

  secao: { padding: 16, gap: 10, paddingBottom: 100 },

  // Categoria tabs (líquidos)
  catTab: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  catTabTxt: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#6B7280' },
  alertaDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: DANGER },

  // Cards de item
  itemCard: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 0 },
  itemCardAlerta: { borderWidth: 1.5, borderColor: DANGER },
  itemColorBar: { width: 4, borderRadius: 2, alignSelf: 'stretch' },
  itemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deleteBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  itemIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemNpk: { fontFamily: 'Inter_700Bold', fontSize: 17, color: PRIMARY, letterSpacing: 0.5 },
  itemNome: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#1A1A1A' },
  itemQtd: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B7280', marginTop: 2 },
  itemBadgeRow: { flexDirection: 'row', gap: 6, marginTop: 5, flexWrap: 'wrap' },

  // Empty state
  emptyCard: { alignItems: 'center', padding: 32, gap: 8 },
  emptyTxt: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#9CA3AF' },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#D1D5DB' },

  // FAB
  fab: {
    position: 'absolute', right: 16, bottom: 16,
    backgroundColor: PRIMARY,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },

  // Modal overlay
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 12,
  },
  modalTitulo: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#1A1A1A', marginBottom: 4 },
  modalAcoes: { flexDirection: 'row', gap: 10, marginTop: 4 },

  unidadeLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: -4 },
  unidadeRow: { flexDirection: 'row', gap: 10 },
  unidadeBtn: { flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 16, alignItems: 'center', backgroundColor: '#fff' },
  unidadeBtnAtivo: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  unidadeTxt: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#6B7280' },
  unidadeTxtAtivo: { color: '#fff' },

  // Bottom sheet
  sheet: { backgroundColor: '#F8F6F1', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '90%', overflow: 'hidden' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 18 },
  sheetTitulo: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#fff' },
  sheetSubRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  sheetSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  sheetAlertaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  sheetAlertaTxt: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#92400E' },
  sheetClose: { padding: 4 },

  custoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10 },
  custoTxt: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B7280' },
  custoDestaque: { fontFamily: 'Inter_700Bold', color: PRIMARY },

  tabsRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  tabBtnTxt: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#6B7280' },

  tipoRow: { flexDirection: 'row', gap: 10 },
  tipoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 16, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff',
  },
  tipoBtnTxt: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#6B7280' },

  movRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  movIconBox: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  movQtd: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#1A1A1A' },
  movData: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#9CA3AF', marginTop: 1 },

  vazio: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 },
  custoPreview: { padding: 12 },
  custoPreviewTxt: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6B7280' },

  chip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  chipValue: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  chipLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#6B7280', marginTop: 1 },

  // Modal confirmar exclusão
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  confirmBox: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%',
    alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 10,
  },
  confirmIconBox: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  confirmTitulo: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#1A1A1A' },
  confirmMsg: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  confirmAcoes: { flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' },
  confirmBtnCancelar: { flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: '#fff' },
  confirmBtnCancelarTxt: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#6B7280' },
  confirmBtnExcluir: { flex: 1, backgroundColor: DANGER, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  confirmBtnExcluirTxt: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#fff' },
});
