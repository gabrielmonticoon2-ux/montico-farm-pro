# Plano de Integração Firebase Firestore — Montico Farm Pro

> **Status:** Planejamento — nenhum arquivo modificado ainda.
> Gerado em: 27/03/2026

---

## 1. Leitura do Código Atual

### StorageContext.js — O que existe hoje

| Aspecto | Detalhe |
|---|---|
| Armazenamento | `AsyncStorage` (local, só no dispositivo) |
| Schema version | `2` (com sistema de migrações) |
| Chaves AS | `@roca:adubos`, `@roca:liquidos`, `@roca:talhoes`, `@roca:sementes`, `@roca:schemaVersion` |
| Entidades | `adubos` (array), `liquidos` (obj categorizado), `talhoes` (nested), `sementes` (obj categorizado) |
| Funções exportadas | ~35 funções CRUD agrupadas por entidade |
| Entrypoint | `StorageProvider` (envolve tudo no App.js) + hook `useStorage()` |

### Estrutura de dados — Firestore-ready

```
adubos: [
  { id, npk, quantidade, unidade, estoqueMinimo, custoPorUnidade,
    movimentacoes: [{ id, data, tipo, quantidade, motivo }] }
]

liquidos: {
  herbicidas:  [{ id, nome, quantidade, unidade, estoqueMinimo, custoPorUnidade, movimentacoes }],
  adjuvantes:  [...],
  fungicidas:  [...],
  inseticidas: [...],
  foliares:    [...],
}

talhoes: [
  { id, nome, hectares,
    culturas: [
      { id, nome, hectares, mudas, registros,
        variedades: [{ id, nome, mudas, dataPlantio, registros }],
        colheita:       { registros, concluida, precoVendaSaco },
        colheitaCouve:  { registros, precoPorCabeca }
      }
    ]
  }
]

sementes: {
  milho: [...], soja: [...], trigo: [...], feijao: [...]
}
```

### App.js — Estrutura de navegação

```
SafeAreaProvider
  └── StorageProvider          ← único ponto de dados
        └── NavigationContainer
              └── Tab.Navigator
                    ├── HomeScreen
                    ├── EstoqueScreen
                    ├── TalhaoScreen
                    ├── ColheitaScreen
                    └── RelatorioScreen
```

### package.json — Dependências relevantes

- `expo ~54.0.0` (managed workflow)
- `react-native 0.81.5` / `react 19.1.0`
- `@react-native-async-storage/async-storage 2.2.0`
- **Firebase: nenhum pacote instalado ainda**

---

## 2. Pacotes a Instalar

### Único pacote necessário

```bash
npx expo install firebase
```

Isso instala o **Firebase JS SDK v9+ (modular)**, que funciona perfeitamente com Expo Managed Workflow sem precisar de `expo-dev-client`, `@react-native-firebase`, ou ejetar o projeto.

> **Por que Firebase JS SDK e não `@react-native-firebase`?**
> `@react-native-firebase` exige Native Modules, que no Expo Managed Workflow requerem um Development Build ou ejeção. Com `expo ~54`, o Firebase JS SDK cobre 100% do caso de uso.

### O que NÃO instalar

- ❌ `@react-native-firebase` — requer ejeção ou dev-build
- ❌ `react-native-firebase` (legado) — não compatível com Expo 54
- ❌ `@firebase/app-compat` — versão legada, não usar com SDK v9 modular

---

## 3. Estrutura de Dados no Firestore

### Coleção e documento

```
Firestore
└── farms/
    └── {farmCode}/              ← documento principal da fazenda
          adubos:       Array
          liquidos:     Map
          talhoes:      Array
          sementes:     Map
          schemaVersion: Number
          criadoEm:     Timestamp
          nomeFazenda:  String (opcional, para exibição)
```

**Tudo em um único documento por fazenda.** Isso garante:
- Uma única subscrição `onSnapshot` sincroniza tudo
- Atualizações atômicas com `updateDoc` (evita estados parciais)
- Simplicidade — sem subcoleções para começar

**Limite do Firestore:** 1 MB por documento. Para uma fazenda com centenas de registros, isso é mais do que suficiente. Se no futuro o app crescer muito, a migração para subcoleções pode ser feita preservando a mesma lógica.

### Farm code — formato

```
6 caracteres alfanuméricos maiúsculos
Exemplos: "ROCA42", "FARM7K", "MF2025"
Gerado aleatoriamente pelo primeiro usuário que criar a fazenda
```

---

## 4. Arquivos a Criar (novos)

### 4.1 `src/config/firebase.js` — inicialização do Firebase

**O que faz:** Inicializa o app Firebase e exporta a instância do Firestore.

```javascript
// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "...",
  authDomain:        "...",
  projectId:         "...",
  storageBucket:     "...",
  messagingSenderId: "...",
  appId:             "...",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

> As credenciais vêm do Firebase Console → Project Settings → Your apps.

---

### 4.2 `src/storage/FarmContext.js` — gerenciamento do farm code

**O que faz:** Contexto separado que cuida exclusivamente do farm code. Mantém o código em AsyncStorage para persistir entre sessões.

**Estado que gerencia:**
```javascript
{
  farmCode: string | null,   // "ROCA42" ou null se não configurado
  loading: boolean,
  erro: string | null,
}
```

**Funções exportadas:**

| Função | Descrição |
|---|---|
| `criarFazenda(nomeFazenda?)` | Gera farm code único, cria documento no Firestore, salva no AsyncStorage |
| `entrarFazenda(code)` | Valida se o código existe no Firestore, salva no AsyncStorage |
| `sairFazenda()` | Remove farm code do AsyncStorage e limpa estado |

**Chave AsyncStorage:** `@roca:farmCode`

**Fluxo de `criarFazenda`:**
1. Gera código aleatório de 6 chars
2. Verifica se já existe no Firestore (raro, mas necessário)
3. Se existir, gera outro; se não existir, cria o documento com os dados iniciais (arrays/objetos vazios)
4. Salva o código em AsyncStorage
5. Atualiza o estado local

**Fluxo de `entrarFazenda`:**
1. Valida formato do código (6 chars alfanumérico)
2. Consulta `getDoc(doc(db, 'farms', code))`
3. Se não existir → erro "Fazenda não encontrada"
4. Se existir → salva no AsyncStorage e atualiza estado

---

### 4.3 `src/screens/FarmSetupScreen.js` — tela de configuração inicial

**O que faz:** Tela exibida apenas quando o usuário ainda não tem farm code. Oferece dois botões: "Criar nova fazenda" e "Entrar em uma fazenda existente".

**UI simplificada:**
```
┌─────────────────────────────────┐
│        Montico Farm Pro         │
│     🌿 Bem-vindo ao sistema      │
│                                 │
│  [  CRIAR NOVA FAZENDA  ]       │
│                                 │
│  ── ou ──                       │
│                                 │
│  Código da fazenda:             │
│  [ ________ ]                   │
│  [  ENTRAR NA FAZENDA  ]        │
└─────────────────────────────────┘
```

Ao criar, exibe o farm code gerado em destaque para o usuário anotar/compartilhar.

---

## 5. Arquivos a Modificar

### 5.1 `package.json`

**O que muda:** Adicionar `firebase` nas dependências.

```diff
  "dependencies": {
+   "firebase": "^11.x.x",
    "@expo-google-fonts/inter": "^0.2.3",
    ...
  }
```

> Versão exata: verificar compatibilidade com Expo 54 em https://docs.expo.dev/guides/using-firebase/

---

### 5.2 `src/storage/StorageContext.js` — o arquivo principal

Esta é a mudança mais complexa. O arquivo passa por três grandes adições:

#### A) Imports novos no topo

```javascript
// Adicionar:
import { db } from '../config/firebase';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { useFarm } from './FarmContext'; // para acessar o farmCode
```

#### B) Novo estado interno: `farmCode` e `isSyncing`

```javascript
const { farmCode } = useFarm(); // vem do FarmContext
const [isSyncing, setIsSyncing] = useState(false);
const unsubscribeRef = useRef(null); // guarda o listener onSnapshot
```

#### C) Nova chave AsyncStorage

```javascript
// Adicionar ao objeto KEYS:
FARM_CODE: '@roca:farmCode', // já gerenciado pelo FarmContext
```

#### D) Substituir `loadAll()` por lógica híbrida

**Fluxo novo no `useEffect`:**

```
1. Carrega AsyncStorage (cache local) → exibe dados instantaneamente (loading=false rápido)
2. Se farmCode existe → inicia onSnapshot no Firestore
3. Cada snapshot recebido:
   a. Atualiza estado React (tela atualiza em tempo real)
   b. Grava no AsyncStorage como cache (para próxima abertura offline)
4. Se app reiniciar offline → usa o cache do AsyncStorage (passo 1)
```

**Implementação do listener:**

```javascript
useEffect(() => {
  if (!farmCode) return;

  // Primeiro: carrega cache local para exibição imediata
  loadFromAsyncStorage();

  // Segundo: inscreve no Firestore para sync em tempo real
  const farmRef = doc(db, 'farms', farmCode);
  const unsubscribe = onSnapshot(farmRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      // Atualiza estado
      setAdubosState(data.adubos ?? []);
      setLiquidosState({ ...LIQUIDOS_PADRAO, ...(data.liquidos ?? {}) });
      setTalhoesState(data.talhoes ?? []);
      setSementesState({ ...SEMENTES_PADRAO, ...(data.sementes ?? {}) });
      // Atualiza cache AsyncStorage
      atualizarCacheLocal(data);
    }
    setLoading(false);
  }, (error) => {
    console.warn('Firestore sync error:', error);
    // Se falhar, ainda temos os dados do AsyncStorage
    setLoading(false);
  });

  unsubscribeRef.current = unsubscribe;
  return () => unsubscribe(); // cleanup ao desmontar ou trocar farmCode
}, [farmCode]);
```

#### E) Modificar todas as funções de escrita (padrão uniforme)

**Padrão atual (só AsyncStorage):**
```javascript
async function salvarAdubos(novos) {
  setAdubosState(novos);
  await AsyncStorage.setItem(KEYS.ADUBOS, JSON.stringify(novos));
}
```

**Padrão novo (AsyncStorage + Firestore):**
```javascript
async function salvarAdubos(novos) {
  setAdubosState(novos);                                         // 1. Update otimista
  await AsyncStorage.setItem(KEYS.ADUBOS, JSON.stringify(novos)); // 2. Cache local
  if (farmCode) {
    try {
      await updateDoc(doc(db, 'farms', farmCode), { adubos: novos }); // 3. Sync Firestore
    } catch (e) {
      // Firebase JS SDK fila a escrita automaticamente se offline
      // O write será enviado quando a conexão voltar
      console.warn('Firestore write queued (offline?):', e.code);
    }
  }
}
```

> **Observação importante:** O Firebase JS SDK tem um mecanismo de fila de escritas interno. Se o dispositivo estiver offline, o `updateDoc` fica pendente em memória e é enviado automaticamente quando a conexão voltar. Isso é transparente — não é necessário código extra para retry.

As funções a modificar são: `salvarAdubos`, `salvarLiquidos`, `salvarSementes`, `salvarTalhoes` — são as 4 funções-base; as ~31 outras funções chamam uma dessas quatro e não precisam mudar.

#### F) Novo valor no contexto exportado

```javascript
// Adicionar ao value do StorageContext.Provider:
isSyncing,     // boolean — mostra spinner de sync se quiser
farmCode,      // string | null — para exibir o código na tela Home
```

---

### 5.3 `App.js` — gate da fazenda

**O que muda:** Adicionar `FarmProvider` e exibir `FarmSetupScreen` enquanto o usuário não tiver farm code.

```javascript
// Imports novos:
import { FarmProvider, useFarm } from './src/storage/FarmContext';
import FarmSetupScreen from './src/screens/FarmSetupScreen';

// Componente intermediário:
function AppContent() {
  const { farmCode, loading } = useFarm();
  if (loading) return <LoadingScreen />;
  if (!farmCode) return <FarmSetupScreen />;
  return (
    <StorageProvider>
      <NavigationContainer>
        {/* ... Tab.Navigator existente sem alteração ... */}
      </NavigationContainer>
    </StorageProvider>
  );
}

// App principal:
export default function App() {
  // ... fontes ...
  return (
    <SafeAreaProvider>
      <FarmProvider>         {/* ← novo */}
        <AppContent />       {/* ← novo */}
      </FarmProvider>
    </SafeAreaProvider>
  );
}
```

**Hierarquia final:**
```
SafeAreaProvider
  └── FarmProvider            ← novo (gerencia farmCode)
        └── AppContent
              ├── [sem farmCode] → FarmSetupScreen
              └── [com farmCode] → StorageProvider → NavigationContainer → Tabs
```

---

## 6. Regras de Segurança do Firestore

No Firebase Console → Firestore → Rules, configurar:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Qualquer pessoa com o farm code pode ler/escrever
    // (segurança por obscuridade do código)
    match /farms/{farmCode} {
      allow read, write: if true;
    }
  }
}
```

> **Para o futuro:** se quiser autenticação real, adicionar Firebase Auth anônimo e restringir: `allow read, write: if request.auth != null;`

---

## 7. Tratamento de Conflitos (Merge)

**Cenário:** Usuário A e Usuário B editam dados offline ao mesmo tempo.

**Estratégia: Last Write Wins** (padrão do Firestore).

- Quando ambos voltarem online, o último `updateDoc` a chegar ao servidor vence
- Para adubos/estoque simples, isso é aceitável
- Para registros de talhão (mais críticos), pode-se no futuro usar `arrayUnion` do Firestore para adições seguras

**Implementação futura (opcional):**
```javascript
// Em vez de sobrescrever o array inteiro:
await updateDoc(farmRef, {
  'talhoes': newTalhoes // sobrescreve array inteiro — simples
});

// Alternativa mais segura para adicionar registros:
await updateDoc(farmRef, {
  talhoes: arrayUnion(novoTalhao) // só adiciona, não sobrescreve
});
```

---

## 8. Dados Offline — Estratégia de Cache

| Situação | Comportamento |
|---|---|
| **App abre, está online** | Carrega AsyncStorage (rápido) → Firestore atualiza via onSnapshot |
| **App abre, está offline** | Carrega AsyncStorage (último estado conhecido) → loader some → dados locais visíveis |
| **Usuário edita offline** | Escrita no AsyncStorage imediata → Firebase enfileira a escrita Firestore |
| **Conexão volta** | Firebase envia todas as escritas enfileiradas automaticamente |
| **Outro usuário editou enquanto offline** | onSnapshot dispara imediatamente quando conectar → estado atualiza |

---

## 9. Resumo — O que muda em cada arquivo

| Arquivo | Tipo de mudança | Complexidade |
|---|---|---|
| `package.json` | Adicionar `firebase` | ⭐ Trivial |
| `src/config/firebase.js` | **Criar** — init do Firebase | ⭐ Trivial |
| `src/storage/FarmContext.js` | **Criar** — farm code CRUD | ⭐⭐ Média |
| `src/screens/FarmSetupScreen.js` | **Criar** — UI de setup | ⭐⭐ Média |
| `src/storage/StorageContext.js` | **Modificar** — adicionar sync Firestore | ⭐⭐⭐ Alta |
| `App.js` | **Modificar** — adicionar FarmProvider + gate | ⭐⭐ Média |

---

## 10. Ordem de Implementação Recomendada

1. **Criar projeto no Firebase Console** e pegar as credenciais
2. **Instalar** `firebase` via `npx expo install firebase`
3. **Criar** `src/config/firebase.js` com as credenciais
4. **Criar** `src/storage/FarmContext.js` e testar create/join isoladamente
5. **Criar** `src/screens/FarmSetupScreen.js`
6. **Modificar** `App.js` para incluir FarmProvider + gate
7. **Modificar** `src/storage/StorageContext.js` — adicionar sync (as 4 funções salvar* + o useEffect com onSnapshot)
8. **Testar** com dois dispositivos/simuladores usando o mesmo farm code
9. **Configurar** Firestore Security Rules no console

---

## 11. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Farm code já existe ao criar | Verificar com `getDoc` antes de criar; gerar novo se colidir |
| Documento Firestore > 1MB | Improvável no uso atual; monitorar; se necessário, mover `talhoes` para subcoleção |
| Conflito de escrita simultânea | Last Write Wins é suficiente para 2 usuários; considerar `arrayUnion` para registros críticos |
| `onSnapshot` não dispara offline | Esperado; AsyncStorage garante dados locais sempre disponíveis |
| Custo Firebase (free tier) | Firestore Free Tier: 50k leituras/dia, 20k escritas/dia — mais do que suficiente para uso familiar |

---

*Fim do plano. Nenhum arquivo foi modificado. Aguardando aprovação para iniciar a implementação.*
