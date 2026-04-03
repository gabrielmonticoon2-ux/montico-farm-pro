// Serviço de OCR via Google Cloud Vision API
// Adicionar a chave abaixo após ativar a API no Google Cloud Console
const GOOGLE_VISION_API_KEY = ''; // adicionar chave aqui

/**
 * Envia uma imagem em base64 para a Google Cloud Vision API
 * e retorna o texto extraído (TEXT_DETECTION).
 *
 * @param {string} base64Image - imagem em base64 (sem prefixo data:image/...)
 * @returns {Promise<string>} texto extraído da imagem
 */
export async function extrairTextoDaImagem(base64Image) {
  if (!GOOGLE_VISION_API_KEY) {
    throw new Error('Chave da Google Vision API não configurada. Adicione em src/services/ocrService.js.');
  }

  const url = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;

  const body = {
    requests: [
      {
        image: { content: base64Image },
        features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
      },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Erro na Vision API: ${response.status}`);
  }

  const data = await response.json();
  const anotacoes = data.responses?.[0]?.textAnnotations;
  if (!anotacoes || anotacoes.length === 0) return '';
  return anotacoes[0].description || '';
}
