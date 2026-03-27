import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Clipboard,
  StyleSheet,
  Platform,
} from 'react-native';
import { useFarm } from '../storage/FarmContext';

export default function FarmSetupScreen() {
  const { criarFazenda, confirmarEntrada, entrarFazenda, erro } = useFarm();

  const [nomeFazenda, setNomeFazenda] = useState('');
  const [codigoGerado, setCodigoGerado] = useState(null);
  const [nomeGerado, setNomeGerado]     = useState('');
  const [copiado, setCopiado]           = useState(false);
  const [criando, setCriando]           = useState(false);
  const [confirmando, setConfirmando]   = useState(false);

  const [codigoEntrada, setCodigoEntrada] = useState('');
  const [entrando, setEntrando]           = useState(false);
  const [erroEntrada, setErroEntrada]     = useState(null);

  async function handleCriar() {
    setCriando(true);
    try {
      const nome = nomeFazenda.trim() || 'Minha Fazenda';
      const { code } = await criarFazenda(nome);
      setCodigoGerado(code);
      setNomeGerado(nome);
    } catch (e) {
      console.error(e);
    } finally {
      setCriando(false);
    }
  }

  async function handleContinuar() {
    setConfirmando(true);
    try {
      await confirmarEntrada(codigoGerado, nomeGerado);
    } finally {
      setConfirmando(false);
    }
  }

  function handleCopiar() {
    Clipboard.setString(codigoGerado);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function handleEntrar() {
    setErroEntrada(null);
    setEntrando(true);
    try {
      const ok = await entrarFazenda(codigoEntrada);
      if (!ok) setErroEntrada(erro || 'Código inválido.');
    } catch (e) {
      setErroEntrada('Erro ao conectar. Verifique sua internet.');
    } finally {
      setEntrando(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <Text style={s.titulo}>Montico Farm Pro</Text>
      <Text style={s.subtitulo}>Configure sua fazenda para começar</Text>

      {/* ─── CRIAR FAZENDA ─────────────────────────────────── */}
      <View style={s.card}>
        <Text style={s.cardTitulo}>Nova Fazenda</Text>

        <Text style={s.label}>Nome da fazenda</Text>
        <TextInput
          style={s.input}
          placeholder="Ex: Fazenda Montico"
          placeholderTextColor="#9CA3AF"
          value={nomeFazenda}
          onChangeText={setNomeFazenda}
          editable={!codigoGerado}
        />

        {!codigoGerado ? (
          <TouchableOpacity style={s.botaoPrimario} onPress={handleCriar} disabled={criando}>
            {criando
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.botaoPrimarioTexto}>CRIAR FAZENDA</Text>
            }
          </TouchableOpacity>
        ) : (
          <>
            <View style={s.codigoBox}>
              <Text style={s.codigoLabel}>Código da fazenda:</Text>
              <View style={s.codigoRow}>
                <Text style={s.codigoValor}>{codigoGerado}</Text>
                <TouchableOpacity style={s.copiarBtn} onPress={handleCopiar}>
                  <Text style={s.copiarTexto}>{copiado ? 'Copiado!' : 'Copiar'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.codigoDica}>
                Anote ou compartilhe esse código com o segundo celular antes de continuar.
              </Text>
            </View>
            <TouchableOpacity style={[s.botaoPrimario, { marginTop: 12 }]} onPress={handleContinuar} disabled={confirmando}>
              {confirmando
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.botaoPrimarioTexto}>ENTRAR NO APP</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ─── DIVISOR ───────────────────────────────────────── */}
      <View style={s.divisorRow}>
        <View style={s.divisorLinha} />
        <Text style={s.divisorTexto}>ou entre em uma existente</Text>
        <View style={s.divisorLinha} />
      </View>

      {/* ─── ENTRAR EM FAZENDA ─────────────────────────────── */}
      <View style={s.card}>
        <Text style={s.cardTitulo}>Entrar em uma Fazenda</Text>

        <Text style={s.label}>Código da fazenda (6 caracteres)</Text>
        <TextInput
          style={[s.input, s.inputCodigo]}
          placeholder="Ex: ROCA42"
          placeholderTextColor="#9CA3AF"
          value={codigoEntrada}
          onChangeText={t => { setCodigoEntrada(t.toUpperCase()); setErroEntrada(null); }}
          autoCapitalize="characters"
          maxLength={6}
        />

        {erroEntrada ? <Text style={s.erroTexto}>{erroEntrada}</Text> : null}

        <TouchableOpacity
          style={[s.botaoPrimario, s.botaoSecundario]}
          onPress={handleEntrar}
          disabled={entrando || codigoEntrada.length < 6}
        >
          {entrando
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.botaoPrimarioTexto}>ENTRAR NA FAZENDA</Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const PRIMARY = '#1B4332';
const ACCENT  = '#D4A017';

const s = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  titulo: {
    fontSize: 26,
    fontWeight: '700',
    color: PRIMARY,
    marginBottom: 6,
  },
  subtitulo: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 32,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: PRIMARY,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: '#111827',
    marginBottom: 14,
    backgroundColor: '#F9FAFB',
  },
  inputCodigo: {
    letterSpacing: 4,
    fontWeight: '700',
    fontSize: 18,
  },
  botaoPrimario: {
    backgroundColor: PRIMARY,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  botaoSecundario: {
    backgroundColor: ACCENT,
  },
  botaoPrimarioTexto: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  codigoBox: {
    marginTop: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  codigoLabel: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  codigoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  codigoValor: {
    fontSize: 32,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: 6,
    flex: 1,
  },
  copiarBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  copiarTexto: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  codigoDica: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 18,
  },
  divisorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    width: '100%',
  },
  divisorLinha: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  divisorTexto: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  erroTexto: {
    color: '#DC2626',
    fontSize: 13,
    marginBottom: 10,
  },
});
