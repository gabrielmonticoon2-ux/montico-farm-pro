import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEstoque } from '../hooks/useEstoque';
import Card from '../components/Card';

const PRIMARY = '#1B4332';
const ACCENT  = '#D4A017';

// ─── helpers ────────────────────────────────────────────────────────────────

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ─── cards de navegação 2×2 ─────────────────────────────────────────────────

const CARDS = [
  { tela: 'Estoque',   label: 'Estoque',    sublabel: 'Adubos e defensivos',    icone: 'cube-outline',      cor: PRIMARY },
  { tela: 'Talhao',    label: 'Talhão',     sublabel: 'Agenda por área',        icone: 'map-outline',       cor: PRIMARY },
  { tela: 'Colheita',  label: 'Colheita',   sublabel: 'Registros de colheita',  icone: 'basket-outline',    cor: PRIMARY },
  { tela: 'Relatorio', label: 'Relatórios', sublabel: 'Histórico e financeiro', icone: 'bar-chart-outline', cor: PRIMARY },
];

function NavCard({ item, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.navCard, { borderLeftColor: item.cor }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={[styles.navIconBox, { backgroundColor: item.cor + '18' }]}>
        <Ionicons name={item.icone} size={28} color={item.cor} />
      </View>
      <Text style={styles.navLabel}>{item.label}</Text>
      <Text style={styles.navSub}>{item.sublabel}</Text>
    </TouchableOpacity>
  );
}

// ─── tela ────────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { adubos, todosProdutosLiquidos, alertasAdubos, alertasLiquidos, totalAlertas, valorTotalEstoque } = useEstoque();
  const [nomeProdutor, setNomeProdutor] = useState(null);
  const [nomeInput, setNomeInput]       = useState('');
  const [modalNome, setModalNome]       = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('nomeProdutor').then(val => {
      if (val) setNomeProdutor(val);
      else setModalNome(true);
    });
  }, []);

  async function salvarNome() {
    const nome = nomeInput.trim();
    if (!nome) return;
    await AsyncStorage.setItem('nomeProdutor', nome);
    setNomeProdutor(nome);
    setModalNome(false);
  }

  const totalProdutos = adubos.length + todosProdutosLiquidos.length;

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Saudação */}
        <View style={styles.greetRow}>
          <View>
            <Text style={styles.greetLabel}>{saudacao()},</Text>
            <Text style={styles.greetName}>{nomeProdutor ?? 'produtor'}</Text>
          </View>
          <Ionicons name="leaf" size={36} color={ACCENT} />
        </View>

        {/* Card de status */}
        <Card style={styles.statusCard}>
          <View style={styles.statusLeft}>
            <Text style={styles.statusNumber}>{totalProdutos}</Text>
            <Text style={styles.statusLabel}>produtos cadastrados</Text>
          </View>
          <View style={styles.statusRight}>
            {totalAlertas > 0 ? (
              <View style={styles.badgeDanger}>
                <Ionicons name="warning" size={13} color="#991B1B" />
                <Text style={styles.badgeDangerTxt}>{totalAlertas} abaixo do mínimo</Text>
              </View>
            ) : (
              <View style={styles.badgeOk}>
                <Ionicons name="checkmark-circle" size={13} color="#065F46" />
                <Text style={styles.badgeOkTxt}>Tudo OK</Text>
              </View>
            )}
            {valorTotalEstoque > 0 && (
              <Text style={styles.valorEstoque}>
                R$ {valorTotalEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} em estoque
              </Text>
            )}
          </View>
        </Card>

        {/* Grid 2×2 */}
        <Text style={styles.secaoTitulo}>Acesso rápido</Text>
        <View style={styles.grid}>
          {CARDS.map(card => (
            <NavCard key={card.tela} item={card} onPress={() => navigation.navigate(card.tela)} />
          ))}
        </View>

        {/* Alerta de estoque mínimo */}
        {totalAlertas > 0 && (
          <TouchableOpacity
            style={styles.alertCard}
            onPress={() => navigation.navigate('Estoque')}
            activeOpacity={0.85}
          >
            <View style={styles.alertIconBox}>
              <Ionicons name="warning" size={22} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitulo}>
                {totalAlertas} produto{totalAlertas !== 1 ? 's' : ''} abaixo do mínimo
              </Text>
              <Text style={styles.alertSub}>
                {[...alertasAdubos.map(a => a.npk), ...alertasLiquidos.map(p => p.nome)]
                  .slice(0, 3)
                  .join(', ')}
                {totalAlertas > 3 ? '…' : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#A67C00" />
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modal — nome do produtor */}
      <Modal visible={modalNome} transparent animationType="fade">
        <View style={styles.nomeOverlay}>
          <View style={styles.nomeBox}>
            <Ionicons name="leaf" size={40} color={PRIMARY} style={{ alignSelf: 'center', marginBottom: 8 }} />
            <Text style={styles.nomeTitulo}>Como podemos te chamar?</Text>
            <Text style={styles.nomeSub}>Seu nome aparecerá na saudação do app.</Text>
            <TextInput
              style={styles.nomeInput}
              value={nomeInput}
              onChangeText={setNomeInput}
              placeholder="Ex: Gabriel"
              placeholderTextColor="#9CA3AF"
              autoFocus
              onSubmitEditing={salvarNome}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.nomeSalvarBtn, !nomeInput.trim() && { opacity: 0.4 }]}
              onPress={salvarNome}
              disabled={!nomeInput.trim()}
            >
              <Text style={styles.nomeSalvarTxt}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F8F6F1' },
  content: { padding: 16, paddingBottom: 32, gap: 20 },

  // Saudação
  greetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  greetLabel: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#6B7280' },
  greetName:  { fontFamily: 'Inter_700Bold', fontSize: 26, color: PRIMARY },

  // Card de status
  statusCard:   { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLeft:   { gap: 2 },
  statusNumber: { fontFamily: 'Inter_700Bold', fontSize: 28, color: PRIMARY, lineHeight: 32 },
  statusLabel:  { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B7280' },
  statusRight:  { alignItems: 'flex-end', gap: 6 },
  badgeDanger:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FEE2E2', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  badgeDangerTxt: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#991B1B' },
  badgeOk:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#D1FAE5', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  badgeOkTxt:   { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#065F46' },
  valorEstoque: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6B7280' },

  // Seção
  secaoTitulo: { fontFamily: 'Inter_700Bold', fontSize: 16, color: PRIMARY, marginBottom: -8 },

  // Grid 2×2
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  navCard: {
    width: '47.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
    borderLeftWidth: 4,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  navIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  navLabel:   { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#1A1A1A' },
  navSub:     { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6B7280', lineHeight: 16 },

  // Alerta
  alertCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: ACCENT,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  alertIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  alertTitulo:  { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#92400E' },
  alertSub:     { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#B45309', marginTop: 2 },

  // Modal nome produtor
  nomeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  nomeBox: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  nomeTitulo:   { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#1A1A1A', textAlign: 'center' },
  nomeSub:      { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 4 },
  nomeInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#F9FAFB',
  },
  nomeSalvarBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  nomeSalvarTxt: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#fff' },
});
