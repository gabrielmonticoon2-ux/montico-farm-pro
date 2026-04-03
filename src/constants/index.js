// Fonte única de verdade para labels, categorias, unidades e cores da UI

export const CATEGORIAS_LIQUIDOS = [
  { key: 'herbicidas',  label: 'Herbicidas',  labelSingular: 'Herbicida',   cor: '#e74c3c' },
  { key: 'fungicidas',  label: 'Fungicidas',  labelSingular: 'Fungicida',   cor: '#3498db' },
  { key: 'inseticidas', label: 'Inseticidas', labelSingular: 'Inseticida',  cor: '#e67e22' },
  { key: 'adjuvantes',  label: 'Adjuvantes',  labelSingular: 'Adjuvante',   cor: '#9b59b6' },
  { key: 'foliares',    label: 'Foliares',    labelSingular: 'Foliar',      cor: '#27ae60' },
];

export const UNIDADES_ADUBO = ['kg', 'sc', 't'];
export const UNIDADES_LIQUIDO = ['L', 'kg'];

export const CATEGORIAS_SEMENTES = [
  { key: 'milho',  label: 'Milho',  labelSingular: 'Milho',  cor: '#F59E0B' },
  { key: 'soja',   label: 'Soja',   labelSingular: 'Soja',   cor: '#84CC16' },
  { key: 'trigo',  label: 'Trigo',  labelSingular: 'Trigo',  cor: '#D97706' },
  { key: 'feijao', label: 'Feijão', labelSingular: 'Feijão', cor: '#A16207' },
];

export const TIPOS_REGISTRO_TALHAO = [
  { key: 'aplicacao', label: 'Aplicação Defensivo', icone: 'flask-outline',          cor: '#1565c0' },
  { key: 'adubacao',  label: 'Adubação',             icone: 'bag-outline',            cor: '#2e8b3e' },
  { key: 'plantio',   label: 'Plantio',              icone: 'leaf-outline',           cor: '#27ae60' },
  { key: 'anotacao',  label: 'Anotação',             icone: 'document-text-outline',  cor: '#888'    },
];

export const CORES = {
  verde:        '#1a6b2a',
  verdeClaro:   '#2e8b3e',
  azul:         '#1565c0',
  marrom:       '#6a3e00',
  roxo:         '#6a1b9a',
  vermelho:     '#c0392b',
  laranja:      '#e67e22',
  cinzaFundo:   '#f5f5f5',
  cinzaBorda:   '#e0e0e0',
  branco:       '#ffffff',
};

export const PRESETS_TANQUE = [
  { label: '20 L\ncostal', valor: 20   },
  { label: '400 L',        valor: 400  },
  { label: '600 L',        valor: 600  },
  { label: '800 L',        valor: 800  },
  { label: '1200 L',       valor: 1200 },
  { label: '2000 L',       valor: 2000 },
];

export const PRIMARY  = '#1B4332';
export const ACCENT   = '#D4A017';
export const DANGER   = '#C0392B';
export const INACTIVE = '#9CA3AF';
