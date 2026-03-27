import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStorage } from '../storage/StorageContext';
import Card from '../components/Card';
import Badge from '../components/Badge';
import SectionHeader from '../components/SectionHeader';

const PRIMARY = '#1B4332';
const DANGER  = '#C0392B';

function formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function mesAno(iso) {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const TIPO_INFO = {
  aplicacao: { cor: '#1565C0', icone: 'flask-outline',         label: 'Defensivo' },
  adubacao:  { cor: '#2D6A4F', icone: 'bag-outline',           label: 'Adubação'  },
  plantio:   { cor: '#27AE60', icone: 'leaf-outline',          label: 'Plantio'   },
  anotacao:  { cor: '#6B7280', icone: 'document-text-outline', label: 'Anotação'  },
};

// ─── Alertas de estoque ───────────────────────────────────────────────────────

function AlertasEstoque({ adubos, liquidos }) {
  const alertas = useMemo(() => {
    const lista = [];
    for (const a of adubos) {
      if (a.estoqueMinimo && a.quantidade < a.estoqueMinimo)
        lista.push({ nome: a.npk, atual: a.quantidade, minimo: a.estoqueMinimo, unidade: a.unidade });
    }
    for (const [, produtos] of Object.entries(liquidos)) {
      for (const p of produtos) {
        if (p.estoqueMinimo && p.quantidade < p.estoqueMinimo)
          lista.push({ nome: p.nome, atual: p.quantidade, minimo: p.estoqueMinimo, unidade: p.unidade });
      }
    }
    return lista;
  }, [adubos, liquidos]);

  if (alertas.length === 0) return null;

  return (
    <Card style={[styles.alertaCard]}>
      <View style={styles.blocoHeader}>
        <Ionicons name="warning" size={18} color="#D97706" />
        <Text style={[styles.blocoTitulo, { color: '#92400E' }]}>
          Estoque abaixo do mínimo ({alertas.length})
        </Text>
      </View>
      {alertas.map((a, i) => (
        <View key={i} style={styles.alertaRow}>
          <Text style={styles.alertaNome}>{a.nome}</Text>
          <Text style={styles.alertaQtd}>{a.atual} / {a.minimo} {a.unidade}</Text>
        </View>
      ))}
    </Card>
  );
}

// ─── Resumo financeiro ────────────────────────────────────────────────────────

function ResumoFinanceiro({ adubos, liquidos }) {
  const itens = useMemo(() => {
    const lista = [];
    for (const a of adubos) {
      if (a.custoPorUnidade && a.quantidade)
        lista.push({ nome: a.npk, tipo: 'Adubo', total: a.custoPorUnidade * a.quantidade, unidade: a.unidade, qtd: a.quantidade });
    }
    for (const [cat, produtos] of Object.entries(liquidos)) {
      for (const p of produtos) {
        if (p.custoPorUnidade && p.quantidade)
          lista.push({ nome: p.nome, tipo: cat.charAt(0).toUpperCase() + cat.slice(1, -1), total: p.custoPorUnidade * p.quantidade, unidade: p.unidade, qtd: p.quantidade });
      }
    }
    return lista.sort((a, b) => b.total - a.total);
  }, [adubos, liquidos]);

  const totalGeral = itens.reduce((s, i) => s + i.total, 0);

  return (
    <Card style={{ padding: 16, gap: 10 }}>
      <View style={styles.blocoHeader}>
        <Ionicons name="cash-outline" size={18} color={PRIMARY} />
        <Text style={[styles.blocoTitulo, { color: PRIMARY }]}>Resumo Financeiro</Text>
      </View>

      {itens.length === 0 ? (
        <Text style={styles.vazioTxt}>Configure o custo por produto no Estoque para ver o resumo financeiro.</Text>
      ) : (
        <>
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total em estoque</Text>
            <Text style={styles.totalValor}>
              R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          {itens.map((item, i) => (
            <View key={i} style={styles.custoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.custoNome}>{item.nome}</Text>
                <Text style={styles.custoSub}>{item.tipo} — {item.qtd} {item.unidade}</Text>
              </View>
              <Text style={[styles.custoTotal, { color: PRIMARY }]}>
                R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          ))}
        </>
      )}
    </Card>
  );
}

// ─── Histórico de aplicações ──────────────────────────────────────────────────

function HistoricoAplicacoes({ talhoes }) {
  const [filtroTalhao, setFiltroTalhao] = useState('todos');
  const [filtroTipo, setFiltroTipo]     = useState('todos');

  const TIPOS_FILTER = [
    { key: 'todos',     label: 'Todos'      },
    { key: 'aplicacao', label: 'Defensivos' },
    { key: 'adubacao',  label: 'Adubação'   },
    { key: 'plantio',   label: 'Plantio'    },
    { key: 'anotacao',  label: 'Anotação'   },
  ];

  const todosRegistros = useMemo(() => {
    const lista = [];
    for (const t of talhoes)
      for (const r of t.registros)
        lista.push({ ...r, talhaoNome: t.nome, talhaoId: t.id });
    return lista.sort((a, b) => new Date(b.data) - new Date(a.data));
  }, [talhoes]);

  const filtrados = useMemo(() => todosRegistros.filter(r =>
    (filtroTalhao === 'todos' || r.talhaoId === filtroTalhao) &&
    (filtroTipo === 'todos' || r.tipo === filtroTipo)
  ), [todosRegistros, filtroTalhao, filtroTipo]);

  const agrupados = useMemo(() => {
    const map = new Map();
    for (const r of filtrados) {
      const chave = mesAno(r.data);
      if (!map.has(chave)) map.set(chave, []);
      map.get(chave).push(r);
    }
    return [...map.entries()];
  }, [filtrados]);

  return (
    <Card style={{ padding: 16, gap: 10 }}>
      <View style={styles.blocoHeader}>
        <Ionicons name="time-outline" size={18} color={PRIMARY} />
        <Text style={[styles.blocoTitulo, { color: PRIMARY }]}>Histórico de Aplicações</Text>
      </View>

      {/* Filtro talhão */}
      <Text style={styles.filtroLabel}>Talhão</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        <TouchableOpacity
          style={[styles.filtroChip, filtroTalhao === 'todos' && styles.filtroChipAtivo]}
          onPress={() => setFiltroTalhao('todos')}
        >
          <Text style={[styles.filtroChipTxt, filtroTalhao === 'todos' && styles.filtroChipTxtAtivo]}>Todos</Text>
        </TouchableOpacity>
        {talhoes.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.filtroChip, filtroTalhao === t.id && styles.filtroChipAtivo]}
            onPress={() => setFiltroTalhao(t.id)}
          >
            <Text style={[styles.filtroChipTxt, filtroTalhao === t.id && styles.filtroChipTxtAtivo]}>{t.nome}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filtro tipo */}
      <Text style={styles.filtroLabel}>Tipo</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        {TIPOS_FILTER.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.filtroChip, filtroTipo === t.key && styles.filtroChipAtivo]}
            onPress={() => setFiltroTipo(t.key)}
          >
            <Text style={[styles.filtroChipTxt, filtroTipo === t.key && styles.filtroChipTxtAtivo]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.contagemTxt}>{filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}</Text>

      {agrupados.length === 0 && (
        <Text style={styles.vazioTxt}>Nenhum registro encontrado com os filtros selecionados.</Text>
      )}

      {agrupados.map(([mes, regs]) => (
        <View key={mes}>
          <Text style={styles.mesHeader}>{mes}</Text>
          {regs.map(r => {
            const info = TIPO_INFO[r.tipo] ?? TIPO_INFO.anotacao;
            return (
              <View key={r.id} style={styles.registroRow}>
                <View style={[styles.registroIconBox, { backgroundColor: info.cor + '18' }]}>
                  <Ionicons name={info.icone} size={15} color={info.cor} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.registroTop}>
                    <Text style={[styles.registroTalhao, { color: info.cor }]}>{r.talhaoNome}</Text>
                    <Text style={styles.registroData}>{formatarData(r.data)}</Text>
                  </View>
                  <Text style={styles.registroDesc}>{r.descricao}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </Card>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────

export default function RelatorioScreen() {
  const { adubos, liquidos, talhoes } = useStorage();

  async function exportarCSV() {
    const linhas = ['Data,Talhão,Tipo,Descrição'];
    for (const t of talhoes) {
      for (const r of t.registros) {
        const desc = r.descricao.replace(/,/g, ';').replace(/\n/g, ' ');
        linhas.push(`${formatarData(r.data)},${t.nome},${r.tipo},${desc}`);
      }
    }
    await Share.share({ title: 'Relatório Montico Farm Pro', message: linhas.join('\n') });
  }

  const totalRegistros = talhoes.reduce((s, t) => s + t.registros.length, 0);
  const totalAdubos    = adubos.length;
  const totalLiquidos  = Object.values(liquidos).reduce((s, arr) => s + arr.length, 0);

  return (
    <View style={styles.root}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.secao}>
          {/* Métricas resumo */}
          <View style={styles.metricsRow}>
            <Card style={styles.metricCard}>
              <Ionicons name="bag" size={18} color={PRIMARY} />
              <Text style={[styles.metricValor, { color: PRIMARY }]}>{totalAdubos}</Text>
              <Text style={styles.metricLabel}>Adubos</Text>
            </Card>
            <Card style={styles.metricCard}>
              <Ionicons name="flask" size={18} color="#1565C0" />
              <Text style={[styles.metricValor, { color: '#1565C0' }]}>{totalLiquidos}</Text>
              <Text style={styles.metricLabel}>Líquidos</Text>
            </Card>
            <Card style={styles.metricCard}>
              <Ionicons name="map" size={18} color="#5D4037" />
              <Text style={[styles.metricValor, { color: '#5D4037' }]}>{talhoes.length}</Text>
              <Text style={styles.metricLabel}>Talhões</Text>
            </Card>
            <Card style={styles.metricCard}>
              <Ionicons name="time" size={18} color={PRIMARY} />
              <Text style={[styles.metricValor, { color: PRIMARY }]}>{totalRegistros}</Text>
              <Text style={styles.metricLabel}>Registros</Text>
            </Card>
          </View>

          {/* Exportar CSV */}
          <TouchableOpacity style={styles.exportBtn} onPress={exportarCSV} activeOpacity={0.8}>
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={styles.exportBtnTxt}>Exportar registros em CSV</Text>
          </TouchableOpacity>

          <AlertasEstoque adubos={adubos} liquidos={liquidos} />
          <ResumoFinanceiro adubos={adubos} liquidos={liquidos} />
          <HistoricoAplicacoes talhoes={talhoes} />
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F6F1' },
  secao: { padding: 16, gap: 14 },

  metricsRow: { flexDirection: 'row', gap: 8 },
  metricCard: { flex: 1, padding: 10, alignItems: 'center', gap: 4 },
  metricValor: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  metricLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF', textAlign: 'center' },

  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 13,
  },
  exportBtnTxt: { fontFamily: 'Inter_700Bold', color: '#fff', fontSize: 14 },

  // Alertas
  alertaCard: { padding: 16, gap: 8, backgroundColor: '#FFFBEB', borderWidth: 1.5, borderColor: '#D97706' },
  blocoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  blocoTitulo: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  alertaRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  alertaNome: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#374151' },
  alertaQtd: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#D97706' },

  // Financeiro
  totalBox: { backgroundColor: PRIMARY, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 4 },
  totalLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' },
  totalValor: { fontFamily: 'Inter_700Bold', fontSize: 26, color: '#fff', marginTop: 2 },
  custoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  custoNome: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#1A1A1A' },
  custoSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  custoTotal: { fontFamily: 'Inter_700Bold', fontSize: 14 },

  vazioTxt: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 10, lineHeight: 20 },

  // Histórico
  filtroLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4 },
  filtroChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff',
  },
  filtroChipAtivo: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  filtroChipTxt: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#6B7280' },
  filtroChipTxtAtivo: { color: '#fff' },
  contagemTxt: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#9CA3AF' },
  mesHeader: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 6 },
  registroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  registroIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  registroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  registroTalhao: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  registroData: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#9CA3AF' },
  registroDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#374151', marginTop: 2, lineHeight: 19 },
});
