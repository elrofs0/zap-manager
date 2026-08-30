const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
});

/**
 * AI-assisted schedule management
 */
async function getScheduleSuggestion(context) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Voc\u00ea \u00e9 um assistente de gest\u00e3o de escalas para uma empresa brasileira. 
Voc\u00ea ajuda a reorganizar escalas quando funcion\u00e1rios solicitam trocas ou reportam faltas.
Sempre responda em portugu\u00eas brasileiro.
Considere: disponibilidade dos funcion\u00e1rios, carga hor\u00e1ria justa, compet\u00eancias necess\u00e1rias.
Forne\u00e7a sugest\u00f5es claras e objetivas.`,
        },
        {
          role: 'user',
          content: context,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    return response.choices[0].message.content;
  } catch (err) {
    console.error('[OpenAI] Error:', err.message);
    return 'Desculpe, n\u00e3o foi poss\u00edvel gerar uma sugest\u00e3o no momento. Por favor, tente novamente.';
  }
}

/**
 * AI chat for schedule management from web panel
 */
async function chatWithAI(messages, scheduleContext) {
  try {
    const systemMessage = {
      role: 'system',
      content: `Voc\u00ea \u00e9 um assistente de gest\u00e3o inteligente chamado ZapManager AI.
Voc\u00ea ajuda gerentes a administrar escalas de funcion\u00e1rios e entregas.
Sempre responda em portugu\u00eas brasileiro.
Seja conciso e pr\u00e1tico.

Contexto atual das escalas e funcion\u00e1rios:
${scheduleContext}

Voc\u00ea pode sugerir:
- Reorganiza\u00e7\u00e3o de escalas
- Substitui\u00e7\u00f5es para faltas
- Otimiza\u00e7\u00e3o de turnos
- Distribui\u00e7\u00e3o de tarefas`,
    };

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [systemMessage, ...messages],
      temperature: 0.7,
      max_tokens: 1000,
    });

    return response.choices[0].message.content;
  } catch (err) {
    console.error('[OpenAI] Chat error:', err.message);
    return 'Desculpe, ocorreu um erro ao processar sua solicita\u00e7\u00e3o. Tente novamente.';
  }
}

module.exports = { getScheduleSuggestion, chatWithAI };
