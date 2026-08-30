const axios = require('axios');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'zapmanager';

const api = axios.create({
  baseURL: EVOLUTION_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'apikey': EVOLUTION_API_KEY,
  },
  timeout: 10000,
});

/**
 * Send a text message via Evolution API
 */
async function sendMessage(phone, text) {
  try {
    const response = await api.post(`/message/sendText/${EVOLUTION_INSTANCE}`, {
      number: phone,
      text: text,
    });
    console.log(`[WhatsApp] Message sent to ${phone}`);
    return response.data;
  } catch (err) {
    console.error(`[WhatsApp] Error sending message to ${phone}:`, err.message);
    throw err;
  }
}

/**
 * Send a message with buttons via Evolution API
 */
async function sendButtonMessage(phone, title, text, buttons) {
  try {
    // Evolution API v2 button format
    const response = await api.post(`/message/sendButtons/${EVOLUTION_INSTANCE}`, {
      number: phone,
      title: title,
      description: text,
      buttons: buttons.map((btn, idx) => ({
        type: 'reply',
        displayText: btn.text,
        id: btn.id || `btn_${idx}`,
      })),
    });
    console.log(`[WhatsApp] Button message sent to ${phone}`);
    return response.data;
  } catch (err) {
    console.error(`[WhatsApp] Error sending button message to ${phone}:`, err.message);
    // Fallback to text message with options
    const buttonText = buttons.map(b => `${b.text}`).join('\n');
    const fallbackText = `${title}\n\n${text}\n\nOp\u00e7\u00f5es:\n${buttonText}\n\nResponda com o n\u00famero da op\u00e7\u00e3o desejada.`;
    return sendMessage(phone, fallbackText);
  }
}

/**
 * Send location request message
 */
async function sendLocationRequest(phone, text) {
  try {
    const response = await api.post(`/message/sendText/${EVOLUTION_INSTANCE}`, {
      number: phone,
      text: text + '\n\n\ud83d\udccd Por favor, compartilhe sua localiza\u00e7\u00e3o em tempo real pelo WhatsApp para atualizar o rastreamento.',
    });
    return response.data;
  } catch (err) {
    console.error(`[WhatsApp] Error sending location request to ${phone}:`, err.message);
    throw err;
  }
}

module.exports = {
  sendMessage,
  sendButtonMessage,
  sendLocationRequest,
};
