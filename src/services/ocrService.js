// Serviço de OCR via Tesseract.js — processa localmente, sem envio de dados externos
import { createWorker } from 'tesseract.js';

/**
 * Extrai texto de uma imagem em base64 usando Tesseract.js (OCR local).
 * Suporta português e inglês para melhor reconhecimento de notas fiscais.
 *
 * @param {string} base64Image - imagem em base64 (sem prefixo data:image/...)
 * @returns {Promise<string>} texto extraído da imagem
 */
export async function extrairTextoDaImagem(base64Image) {
  const worker = await createWorker('por+eng', 1, {
    logger: () => {}, // silencia logs internos
  });

  try {
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;
    const { data: { text } } = await worker.recognize(dataUrl);
    return text || '';
  } finally {
    await worker.terminate();
  }
}
