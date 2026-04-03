# CLAUDE.md — Montico Farm Pro

> Leia este arquivo completamente antes de qualquer ação no projeto.

---

## Identidade do projeto

- **Nome:** Montico Farm Pro
- **Slug:** montico-farm-pro
- **Plataforma:** React Native + Expo SDK 54 (Managed Workflow)
- **Repositório:** github.com/gabrielmonticoon2-ux/montico-farm-pro
- **Caminho local:** C:/Users/makaluspo/app roça
- **Versão:** 1.0.0
- **Owner Expo:** gabrielmonticon
- **EAS Project ID:** 13bad5f1-577f-472b-a6ca-9d305014c664

---

## Stack técnica

| Item | Versão |
|---|---|
| Expo | ~54.0.0 |
| React Native | 0.81.5 |
| React | 19.1.0 |
| NativeWind | ^4.0.36 |
| Tailwind CSS | 3.4.0 |
| Firebase JS SDK | ^12.11.0 |
| AsyncStorage | 2.2.0 |
| React Navigation Bottom Tabs | ^6.6.1 |
| React Navigation Stack | ^6.4.1 |
| Fontes | Inter 400/500/700 via @expo-google-fonts |
| Ícones | Ionicons via @expo/vector-icons |


---

## Design system — NÃO ALTERAR

- **Cor primária:** #1B4332 (verde escuro)
- **Cor de destaque:** #D4A017 (dourado)
- **Cor inativa tabs:** #9CA3AF
- **Fundo geral:** #F8F6F1
- **Fundo cards:** #FFFFFF
- **Perigo/Exclusão:** #C0392B
- **Sucesso:** #27AE60
- **Fontes:** Inter_400Regular, Inter_500Medium, Inter_700Bold
- **Ícones:** Ionicons exclusivamente

---

## Estrutura de arquivos

```
app roça/
├── App.js                     — Navegação + FarmProvider + StorageProvider
├── app.json                   — Config Expo
├── package.json               — Dependências
├── eas.json                   — Config build EAS
├── CLAUDE.md                  — Este arquivo
├── PLANO_FIREBASE.md          — Plano detalhado Firebase
└── src/
    ├── config/firebase.js     — initializeApp + export db
    ├── storage/
    │   ├── FarmContext.js     — farmCode: criar/entrar/sair fazenda
    │   └── StorageContext.js  — Dados + sync Firestore (848 linhas)
    ├── screens/
    │   ├── FarmSetupScreen.js — Tela inicial sem farmCode
    │   ├── HomeScreen.js      — Saudação + grid 2x2 + alerta estoque
    │   ├── EstoqueScreen.js   — Adubos + Líquidos + Sementes (929 linhas)
    │   ├── TalhaoScreen.js    — Talhões + culturas + registros
    │   ├── ColheitaScreen.js  — Colheita grãos + couve (677 linhas)
    │   └── RelatorioScreen.js — Financeiro + histórico + CSV
    ├── components/
    │   ├── Card.js, Button.js, Badge.js, Input.js, SectionHeader.js
    ├── constants/index.js     — CATEGORIAS_*, TIPOS_*, PRESETS_TANQUE
    ├── utils/index.js         — abaixoDoMinimo(), valorTotalItem(), mesAno()
    ├── hooks/
    │   ├── useEstoque.js      — alertas, valorTotal, todosProdutosLiquidos
    │   ├── useMistura.js      — calculadora de calda
    │   └── useTalhao.js       — todosRegistros, agruparPorMes
    └── data/
        ├── incompatibilidades.json
        └── incompatibilidades.js
```


---

## Arquitetura de providers

```
SafeAreaProvider
  └── FarmProvider
        └── AppContent
              ├── [sem farmCode] → FarmSetupScreen
              └── [com farmCode] → StorageProvider
                                      └── NavigationContainer
                                            └── Tab.Navigator
                                                  ├── HomeScreen
                                                  ├── EstoqueScreen
                                                  ├── TalhaoScreen
                                                  ├── ColheitaScreen
                                                  └── RelatorioScreen
```

---

## Firebase — estado ATUAL

- **Projeto:** montico-farm-pro
- **Firestore:** ativado
- **Config:** src/config/firebase.js (credenciais já inseridas)
- **Estrutura:** farms/{farmCode} — documento único por fazenda
- **Farm code:** 6 chars alfanuméricos maiúsculos, sem I/O/0/1
- **Schema version:** 2

### JÁ IMPLEMENTADO

- [x] firebase ^12.11.0 instalado
- [x] src/config/firebase.js com credenciais reais
- [x] FarmContext.js completo (criarFazenda, confirmarEntrada, entrarFazenda, sairFazenda)
- [x] FarmSetupScreen.js completo
- [x] App.js com FarmProvider + gate
- [x] StorageContext.js com sync Firestore completo
  - onSnapshot listener em tempo real
  - 4 funções salvar* com AsyncStorage + updateDoc Firestore
  - Cache local offline automático
  - Sistema de migrações v1 → v2

### FALTA

- [ ] Firestore Security Rules (atualmente modo teste)
- [ ] Testar sincronização entre dois dispositivos reais


---

## StorageContext — ~40 funções exportadas

**Adubos:** adicionarAdubo, removerAdubo, atualizarConfigAdubo, adicionarMovimentacaoAdubo

**Líquidos** (herbicidas, adjuvantes, fungicidas, inseticidas, foliares)**:** adicionarLiquido, removerLiquido, atualizarLiquido, atualizarConfigLiquido, adicionarMovimentacaoLiquido

**Sementes** (milho, soja, trigo, feijao)**:** adicionarSemente, removerSemente, atualizarConfigSemente, adicionarMovimentacaoSemente

**Talhões** (talhao > culturas > variedades > registros)**:** adicionarTalhao, removerTalhao, atualizarHectaresTalhao, adicionarCulturaTalhao, removerCulturaTalhao, atualizarHectaresCultura, atualizarMudasCultura, adicionarVariedadeCouve, atualizarVariedadeCouve, removerVariedadeCouve, adicionarRegistroVariedade, adicionarRegistroVariedadeEGeral, atualizarRegistroVariedade, removerRegistroVariedade, removerRegistroVariedadeEGeral, adicionarRegistroCultura, adicionarRegistroCulturaEVariedades, confirmarRegistroCulturaEVariedades, removerRegistroCultura, removerRegistroCulturaEVariedades, atualizarRegistroCultura, adicionarRegistroColheita, removerRegistroColheita, marcarColheitaConcluida, atualizarPrecoColheita, adicionarRegistroColheitaCouve, atualizarPrecoColheitaCouve, removerRegistroColheitaCouve

**Utilitários:** exportarDados(), limparErro()

**Estado:** loading, erro, isSyncing, farmCode, adubos[], liquidos{}, talhoes[], sementes{}

---

## Categorias importantes

**Líquidos:** herbicidas (#e74c3c), fungicidas (#3498db), inseticidas (#e67e22), adjuvantes (#9b59b6), foliares (#27ae60)

**Sementes:** milho (#F59E0B), soja (#84CC16), trigo (#D97706), feijao (#A16207)

**ColheitaScreen:** Grãos (soja, milho, trigo, feijão) → sacos 60kg | Couve → cabeças com preço/cabeça

---

## Regras de ouro — NUNCA viole sem aprovação

1. Uma tarefa por vez
2. Mostre o plano antes de editar qualquer arquivo
3. Edições cirúrgicas — não reescreva arquivos inteiros
4. Não altere design (cores, fontes, layout)
5. Preserve TODAS as ~40 funções do StorageContext
6. Commit antes de mudanças grandes
7. Teste no Expo Go antes de commitar

---

## Convenções de código

- JavaScript puro (sem TypeScript), Expo Managed Workflow
- PascalCase componentes, camelCase utils/hooks
- StyleSheet.create para estilos
- Fontes: fontFamily: 'Inter_400Regular' (nunca fontWeight sozinho)
- AsyncStorage keys: prefixo @roca:
- IDs: Date.now().toString()
- Máscaras: NPK → formatNPK(), datas → formatarDataInput()


---

## Próximos passos

1. Configurar Firestore Security Rules no console Firebase
2. Testar sync entre dois iPhones com mesmo farmCode
3. Build: eas build --platform ios --profile preview
4. OCR de DANFE/Nota Fiscal (ver prompt abaixo)

---

## Comandos úteis

```bash
npx expo start
npx expo start --tunnel
eas build --platform ios --profile preview
git add -A && git commit -m "mensagem" && git push
```

---

## PROMPT — Renomear app para "Roça Forte"

Renomeie o app de "Montico Farm Pro" para "Roça Forte" em todos os lugares.

1. app.json: name "Roça Forte", slug "roca-forte", bundleIdentifier "com.rocaforte.app", package "com.rocaforte.app"
2. package.json: name "roca-forte"
3. App.js: troque "Montico Farm Pro" por "Roça Forte" no título da tab Home
4. StorageContext.js: troque o nome na função exportarDados()
5. FarmSetupScreen.js: troque o título da tela

Após renomear, busca global por "Montico Farm Pro" e "montico-farm-pro" para confirmar que não sobrou nada.
Não altere lógica, design ou funcionalidade — apenas o nome.
Commit: git add -A && git commit -m "rename: Montico Farm Pro → Roça Forte"


---

## PROMPT — OCR de DANFE/Nota Fiscal

Quero adicionar a funcionalidade de importar produtos para o estoque tirando foto de uma nota fiscal ou DANFE.

### Contexto
App React Native Expo SDK 54. Estoque em EstoqueScreen.js com 3 abas: Adubos, Líquidos, Sementes.
Persistência via StorageContext.js. Design: fundo #F8F6F1, primária #1B4332, destaque #D4A017, fontes Inter, ícones Ionicons.

### Implementar nesta ordem

**Passo 1 — Instalar dependência**
npx expo install expo-image-picker

**Passo 2 — Criar src/services/ocrService.js**
- Enviar imagem base64 para Google Cloud Vision API (TEXT_DETECTION)
- Deixar GOOGLE_VISION_API_KEY = '' com comentário "// adicionar chave aqui"
- Exportar: extrairTextoDaImagem(base64Image) → Promise<string>

**Passo 3 — Criar src/services/danfeParser.js**
- Identificar padrões de quantidade + unidade: "500 KG", "200 L", "50 SC"
- Identificar nomes de produtos próximos às quantidades
- Detectar tipo: adubo (padrão N-P-K), líquido, semente
- Exportar: parsearProdutos(texto) → Array<{ nome, quantidade, unidade, tipoSugerido }>
- tipoSugerido: 'adubo' | 'liquido' | 'semente' | 'desconhecido'

**Passo 4 — Criar src/screens/ScanNotaScreen.js**
Tela com dois momentos:

Momento 1 — Captura:
- Botão "Tirar foto da nota" (ícone camera-outline) e "Escolher da galeria" (images-outline)
- expo-image-picker com quality: 0.8, base64: true
- Loading "Lendo nota fiscal..." enquanto processa

Momento 2 — Revisão:
- Lista editável: nome (TextInput), quantidade (TextInput numérico), unidade (kg/L/sc/bag), tipo (Adubo/Líquido/Semente)
- Botão remover item (trash-outline vermelho)
- Botão "Adicionar todos ao estoque" (PRIMARY)
- Ao confirmar: adubo → adicionarAdubo(), liquido → adicionarLiquido('foliares',...), semente → adicionarSemente('milho',...)
- Se não encontrar produtos: mensagem amigável com opção de adicionar manualmente

**Passo 5 — Modificar EstoqueScreen.js**
Adicionar botão "Importar por nota fiscal" (camera-outline, outline PRIMARY) no topo de cada seção.
onPress={() => navigation.navigate('ScanNota', { tipoInicial: 'adubo' })}

**Passo 6 — Adicionar na navegação (App.js)**
Usar createStackNavigator para ScanNotaScreen sem quebrar o bottom tab existente.

**Passo 7 — Permissões no app.json**
["expo-image-picker", {
  "photosPermission": "O app precisa acessar suas fotos para importar notas fiscais.",
  "cameraPermission": "O app precisa da câmera para fotografar notas fiscais."
}]

### Regras
- Seguir design system: cores, fontes Inter, componentes Card/Button/Input existentes
- Chave Google Vision fica vazia — comentário claro no código
- Mostrar plano completo antes de implementar qualquer arquivo
- Implementar um arquivo por vez aguardando confirmação
- Não alterar StorageContext, FarmContext ou arquivos não listados
