
     
const { Configuration, OpenAIApi } = require('openai');

// Configuração da OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Função para delay entre tentativas
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função para retry com backoff exponencial
async function retryWithBackoff(fn, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.log(JSON.stringify({
        level: 'warn',
        message: 'Tentativa falhou',
        attempt,
        maxRetries,
        error: error.message
      }));
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Backoff exponencial: 1s, 2s, 4s...
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      await delay(delayMs);
    }
  }
}

// Função para selecionar o melhor modelo disponível
async function selectBestModel() {
  const models = ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'];
  
  for (const model of models) {
    try {
      console.log(JSON.stringify({
        level: 'info',
        message: 'Testando disponibilidade do modelo',
        model
      }));
      
      // Teste simples para verificar se o modelo está disponível
      await openai.createChatCompletion({
        model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
        temperature: 0
      });
      
      console.log(JSON.stringify({
        level: 'info',
        message: 'Modelo selecionado com sucesso',
        selectedModel: model
      }));
      
      return model;
    } catch (error) {
      console.log(JSON.stringify({
        level: 'warn',
        message: 'Modelo não disponível, tentando próximo',
        model,
        error: error.message
      }));
      continue;
    }
  }
  
  throw new Error('Nenhum modelo disponível');
}

// Função principal da análise
async function analyzeWithRegua30(prompt, config = {}) {
  console.log(JSON.stringify({
    level: 'info',
    message: 'Iniciando análise Régua 3.0',
    promptLength: prompt.length,
    config
  }));

  // Selecionar o melhor modelo disponível
  const selectedModel = await selectBestModel();
  
  // Configurações padrão com override
  const analysisConfig = {
    model: selectedModel,
    max_tokens: config.max_tokens || 4000,
    temperature: config.temperature || 0,
    ...config
  };

  console.log(JSON.stringify({
    level: 'info',
    message: 'Configuração da análise',
    config: analysisConfig
  }));

  // Prompt otimizado para Régua 3.0
  const systemPrompt = `Você é um especialista em análise estratégica usando a metodologia "Régua 3.0".

METODOLOGIA RÉGUA 3.0:
A Régua 3.0 é uma ferramenta de análise que avalia situações em uma escala de 1 a 10, considerando múltiplas dimensões e fornecendo insights acionáveis.

ESTRUTURA DE ANÁLISE:
1. **Análise Dimensional**: Avalie cada aspecto relevante numa escala de 1-10
2. **Pontuação Geral**: Média ponderada das dimensões
3. **Insights Estratégicos**: Identificação de padrões e oportunidades
4. **Recomendações Acionáveis**: Próximos passos concretos
5. **Cenários**: Projeções otimista, realista e pessimista

CRITÉRIOS DE AVALIAÇÃO:
- 1-3: Crítico/Problemático
- 4-6: Moderado/Em desenvolvimento
- 7-8: Bom/Satisfatório
- 9-10: Excelente/Excepcional

FORMATO DE RESPOSTA:
Forneça uma análise estruturada, objetiva e acionável, sempre justificando as pontuações atribuídas.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ];

  // Executar análise com retry
  const response = await retryWithBackoff(async () => {
    console.log(JSON.stringify({
      level: 'info',
      message: 'Enviando requisição para OpenAI',
      model: analysisConfig.model,
      messagesCount: messages.length
    }));

    const completion = await openai.createChatCompletion({
      model: analysisConfig.model,
      messages,
      max_tokens: analysisConfig.max_tokens,
      temperature: analysisConfig.temperature,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    console.log(JSON.stringify({
      level: 'info',
      message: 'Resposta recebida da OpenAI',
      tokensUsed: completion.data.usage?.total_tokens || 'unknown',
      finishReason: completion.data.choices[0]?.finish_reason
    }));

    return completion;
  });

  const analysis = response.data.choices[0]?.message?.content;
  
  if (!analysis) {
    throw new Error('Resposta vazia da OpenAI');
  }

  return {
    analysis,
    metadata: {
      model: analysisConfig.model,
      tokensUsed: response.data.usage?.total_tokens || 0,
      finishReason: response.data.choices[0]?.finish_reason,
      timestamp: new Date().toISOString()
    }
  };
}

// Handler principal da função Netlify
exports.handler = async (event, context) => {
  // Log da requisição recebida
  console.log(JSON.stringify({
    level: 'info',
    message: 'Função analyze.js iniciada',
    method: event.httpMethod,
    headers: event.headers,
    timestamp: new Date().toISOString()
  }));

  // Configurar CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Tratar requisições OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Validar método HTTP
  if (event.httpMethod !== 'POST') {
    console.log(JSON.stringify({
      level: 'error',
      message: 'Método HTTP não permitido',
      method: event.httpMethod
    }));

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Método não permitido',
        message: 'Use POST para enviar dados para análise'
      })
    };
  }

  try {
    // Validar presença da API key
    if (!process.env.OPENAI_API_KEY) {
      console.log(JSON.stringify({
        level: 'error',
        message: 'OPENAI_API_KEY não configurada'
      }));

      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Configuração inválida',
          message: 'Chave da API não configurada'
        })
      };
    }

    // Parse do body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      console.log(JSON.stringify({
        level: 'error',
        message: 'Erro ao fazer parse do JSON',
        error: parseError.message
      }));

      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'JSON inválido',
          message: 'Formato do corpo da requisição inválido'
        })
      };
    }

    // Validar campos obrigatórios
    const { prompt, config = {} } = requestBody;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      console.log(JSON.stringify({
        level: 'error',
        message: 'Campo prompt inválido ou ausente',
        promptProvided: !!prompt,
        promptType: typeof prompt
      }));

      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Dados inválidos',
          message: 'Campo "prompt" é obrigatório e deve ser uma string não vazia'
        })
      };
    }

    // Validar tamanho do prompt
    if (prompt.length > 50000) {
      console.log(JSON.stringify({
        level: 'error',
        message: 'Prompt muito longo',
        promptLength: prompt.length
      }));

      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Prompt muito longo',
          message: 'O prompt deve ter no máximo 50.000 caracteres'
        })
      };
    }

    // Validar configurações opcionais
    if (config.max_tokens && (typeof config.max_tokens !== 'number' || config.max_tokens < 1 || config.max_tokens > 4000)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Configuração inválida',
          message: 'max_tokens deve ser um número entre 1 e 4000'
        })
      };
    }

    if (config.temperature && (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Configuração inválida',
          message: 'temperature deve ser um número entre 0 e 2'
        })
      };
    }

    console.log(JSON.stringify({
      level: 'info',
      message: 'Validações concluídas, iniciando análise',
      promptLength: prompt.length,
      configProvided: Object.keys(config).length > 0
    }));

    // Executar análise
    const result = await analyzeWithRegua30(prompt, config);

    console.log(JSON.stringify({
      level: 'info',
      message: 'Análise concluída com sucesso',
      tokensUsed: result.metadata.tokensUsed,
      model: result.metadata.model
    }));

    // Retornar resultado
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: {
          analysis: result.analysis,
          metadata: result.metadata
        }
      })
    };

  } catch (error) {
    console.log(JSON.stringify({
      level: 'error',
      message: 'Erro durante execução',
      error: error.message,
      stack: error.stack
    }));

    // Determinar tipo de erro e status code apropriado
    let statusCode = 500;
    let errorMessage = 'Erro interno do servidor';

    if (error.message.includes('API key') || error.message.includes('authentication')) {
      statusCode = 401;
      errorMessage = 'Erro de autenticação com OpenAI';
    } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
      statusCode = 429;
      errorMessage = 'Limite de uso da API atingido';
    } else if (error.message.includes('model') || error.message.includes('Nenhum modelo disponível')) {
      statusCode = 502;
      errorMessage = 'Modelos de IA temporariamente indisponíveis';
    } else if (error.response?.status) {
      statusCode = 502;
      errorMessage = 'Erro na comunicação com OpenAI';
    }

    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Erro na análise',
        message: errorMessage,
        timestamp: new Date().toISOString()
      })
    };
  }
};
