# PROMPT — Limpeza de Código (Redundâncias, Duplicações e Más Práticas)

Cole tudo abaixo no Claude Code e execute na ordem indicada.

---

## Contexto

Análise completa do código identificou os seguintes problemas confirmados por busca no repositório.
Implemente na ordem exata abaixo. Um passo por vez, aguardando confirmação entre cada um.

---

## PASSO 1 — Adicionar funções utilitárias faltantes em src/utils/index.js

Adicione as seguintes exportações ao final de src/utils/index.js:

```javascript
/**
 * Aplica máscara de data DD/MM/AAAA enquanto o usuário digita.
 * Uso: onChangeText={t => setData(formatarDataInput(t))}
 */
export function formatarDataInput(texto) {
  const digits = texto.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
}

/**
 * Converte string DD/MM/AAAA para ISO string.
 */
export function dataBRparaISO(dataBR) {
  const [dia, mes, ano] = dataBR.split('/');
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
```

Confirme após adicionar. Não altere mais nada neste passo.

---

## PASSO 2 — Remover funções duplicadas dos arquivos de tela

Após confirmação do Passo 1, faça as seguintes substituições:

### 2a. EstoqueScreen.js
- Remova as funções locais `formatarData` (linha ~35)
- Adicione no topo do arquivo: `import { formatarData } from '../utils';`

### 2b. RelatorioScreen.js
- Remova as funções locais `formatarData` e `mesAno` (linhas ~21-28)
- Adicione no topo do arquivo: `import { formatarData, mesAno } from '../utils';`

### 2c. ColheitaScreen.js
- Remova as funções locais `formatarDataInput` e `formatarData` (linhas ~36-45)
- Remova a função local `formatMoeda` — substitua seus usos por `formatarReais` do utils
- Adicione no topo: `import { formatarData, formatarDataInput, formatarReais } from '../utils';`

### 2d. TalhaoScreen.js
- Remova as funções locais `formatarDataInput` e `formatarData` (linhas ~102-111)
- Adicione no topo: `import { formatarData, formatarDataInput, dataBRparaISO } from '../utils';`
- Substitua todos os usos de `fmtMil(x)` pelo componente Input com prop `thousands` já existente
- Remova as funções `fmtMil` e `stripMil`

### 2e. MisturaScreen.js
- Remova a função local `formatarDataInput` (linhas ~47-52)
- Adicione no topo: `import { formatarDataInput, dataBRparaISO } from '../utils';`

Confirme após cada arquivo. Não avance sem testar que o app ainda abre.

---

## PASSO 3 — Consolidar constantes duplicadas

### 3a. TalhaoScreen.js — remover constantes locais duplicadas

Remova `const TIPOS_REGISTRO` do TalhaoScreen.js (linhas ~19-24).
Substitua por importação: `import { TIPOS_REGISTRO_TALHAO as TIPOS_REGISTRO } from '../constants';`
Isso elimina a definição duplicada — o constants já tem os mesmos dados.

Remova `const MARROM = '#5D4037'` — não é usada em nenhum lugar do arquivo.

### 3b. MisturaScreen.js — usar PRESETS_TANQUE do constants

Remova `const PRESETS_TANQUE` do MisturaScreen.js (linhas ~26-33).
Substitua por: `import { PRESETS_TANQUE } from '../constants';`

### 3c. Não criar arquivo de tema por enquanto

As constantes PRIMARY/DANGER/ACCENT declaradas em cada tela podem ser unificadas futuramente,
mas não faça isso agora — o risco de quebrar estilos é alto. Deixe para um refactor separado.

---

## PASSO 4 — Corrigir bug crítico: RelatorioScreen iterando estrutura antiga

### Problema
`HistoricoAplicacoes` e `exportarCSV` em RelatorioScreen.js iteram `t.registros` diretamente,
mas desde a migração v2 os registros vivem em `t.culturas[].registros`.
Usuários com dados v2 veem histórico vazio.

### Correção em HistoricoAplicacoes

Substitua o `useMemo` de `todosRegistros`:

```javascript
// ANTES (formato antigo — sempre retorna vazio com dados v2):
const todosRegistros = useMemo(() => {
  const lista = [];
  for (const t of talhoes)
    for (const r of t.registros)
      lista.push({ ...r, talhaoNome: t.nome, talhaoId: t.id });
  return lista.sort((a, b) => new Date(b.data) - new Date(a.data));
}, [talhoes]);

// DEPOIS (formato v2 — itera culturas):
const todosRegistros = useMemo(() => {
  const lista = [];
  for (const t of talhoes) {
    for (const c of (t.culturas || [])) {
      for (const r of (c.registros || [])) {
        lista.push({ ...r, talhaoNome: t.nome, talhaoId: t.id, culturaNome: c.nome });
      }
    }
  }
  return lista.sort((a, b) => new Date(b.data) - new Date(a.data));
}, [talhoes]);
```

### Correção em exportarCSV

```javascript
// ANTES:
for (const t of talhoes) {
  for (const r of t.registros) { ... }
}

// DEPOIS:
for (const t of talhoes) {
  for (const c of (t.culturas || [])) {
    for (const r of (c.registros || [])) {
      const desc = (r.descricao || '').replace(/,/g, ';').replace(/\n/g, ' ');
      linhas.push(`${formatarData(r.data)},${t.nome} - ${c.nome},${r.tipo},${desc}`);
    }
  }
}
```

---

## PASSO 5 — Corrigir useTalhao.js (mesma iteração antiga)

Em src/hooks/useTalhao.js, substitua o `todosRegistros` e `totalRegistros`:

```javascript
// ANTES:
const todosRegistros = useMemo(() => {
  const lista = [];
  for (const t of talhoes) {
    for (const r of t.registros) {
      lista.push({ ...r, talhaoNome: t.nome, talhaoId: t.id });
    }
  }
  return lista.sort((a, b) => new Date(b.data) - new Date(a.data));
}, [talhoes]);

const totalRegistros = useMemo(
  () => talhoes.reduce((s, t) => s + t.registros.length, 0),
  [talhoes]
);

// DEPOIS:
const todosRegistros = useMemo(() => {
  const lista = [];
  for (const t of talhoes) {
    for (const c of (t.culturas || [])) {
      for (const r of (c.registros || [])) {
        lista.push({ ...r, talhaoNome: t.nome, talhaoId: t.id, culturaNome: c.nome });
      }
    }
  }
  return lista.sort((a, b) => new Date(b.data) - new Date(a.data));
}, [talhoes]);

const totalRegistros = useMemo(
  () => talhoes.reduce((s, t) =>
    s + (t.culturas || []).reduce((sc, c) => sc + (c.registros || []).length, 0), 0),
  [talhoes]
);
```

---

## PASSO 6 — Substituir Clipboard deprecated em RelatorioScreen.js

### Instalar expo-clipboard
```bash
npx expo install expo-clipboard
```

### Substituir em RelatorioScreen.js
```javascript
// ANTES:
import { ..., Clipboard } from 'react-native';
// ...
Clipboard.setString(farmCode);

// DEPOIS:
import * as Clipboard from 'expo-clipboard';
// ...
await Clipboard.setStringAsync(farmCode);
// Tornar handleCopiarCodigo async:
async function handleCopiarCodigo() {
  await Clipboard.setStringAsync(farmCode);
  setCopiado(true);
  setTimeout(() => setCopiado(false), 2000);
}
```

---

## PASSO 7 — Remover código morto de TalhaoScreen.js

Remova o sistema paralelo de conversão de unidades que duplica o utils:
- Remova as funções `toKg`, `fromKg`, `convertToStockUnit`
- Importe `converterUnidade` de '../utils' e substitua as chamadas

Antes de fazer isso, leia TalhaoScreen.js e mapeie todos os usos de toKg/fromKg/convertToStockUnit
para garantir que converterUnidade cobre os mesmos casos. Mostre o mapeamento antes de editar.

---

## REGRAS PARA TODOS OS PASSOS

- Após cada passo, rode o app e confirme que abre sem erros antes de continuar
- Faça commit ao final de cada passo: `git add -A && git commit -m "refactor: passo N - descrição"`
- Se qualquer passo quebrar o app, reverta e me avise antes de continuar
- Não altere lógica de negócio, design ou funcionalidades — apenas organização do código
- Mostre o que foi feito ao final de cada passo antes de prosseguir
