require('dotenv').config();
const axios = require('axios');

const SERVICE_B_URL = process.env.SERVICE_B_URL || 'http://localhost:3001/analyze';
const TEXT_TO_ANALYZE = process.env.TEXT_TO_ANALYZE || 'Este produto é excelente e me deixou muito satisfeito.';

async function run() {
  try {
    const response = await axios.post(
      SERVICE_B_URL,
      { text: TEXT_TO_ANALYZE },
      {
        timeout: 5000,
        responseType: 'text',
        transformResponse: [(data) => data]
      }
    );

    let payload;
    try {
      payload = JSON.parse(response.data);
    } catch {
      console.error('Erro: Retorno do processador de IA não é um JSON válido');
      return;
    }

    if (!payload || typeof payload !== 'object' || typeof payload.sentimento !== 'string') {
      console.error('Erro: Retorno do processador de IA não é um JSON válido');
      return;
    }

    console.log(`Análise concluída: ${payload.sentimento.toUpperCase()}`);
  } catch (error) {
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNABORTED' ||
      (error.response == null && error.request)
    ) {
      console.error('Erro: Não foi possível conectar ao processador de IA');
      return;
    }

    if (error instanceof SyntaxError) {
      console.error('Erro: Retorno do processador de IA não é um JSON válido');
      return;
    }

    console.error('Erro inesperado ao processar a análise:', error.message);
  }
}

run();
