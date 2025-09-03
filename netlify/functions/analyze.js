# Criar Netlify Function para proteger a API key

netlify_function = """const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { messages, useOpenAI = false } = JSON.parse(event.body);

    let response;
    
    if (!useOpenAI) {
      // Tentar Groq primeiro (gratuito)
      try {
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY || 'gsk_demo_key'}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: messages,
            max_tokens: 1000,
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ ...data, provider: 'groq' }),
          };
        }
      } catch (error) {
        console.log('Groq failed, trying OpenAI...');
      }
    }

    // Fallback para OpenAI (protegida)
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ...data, provider: 'openai' }),
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
    };
  }
};"""

# Salvar function
with open('analyze.js', 'w', encoding='utf-8') as f:
    f.write(netlify_function)

print("🔒 Netlify Function criada!")
print("📁 Arquivo: analyze.js")
print("🛡️ Chave OpenAI protegida!")
