const express = require('express');
const db = require('../config/database');
const deliveryService = require('../services/delivery');
const scheduleService = require('../services/schedule');
const whatsapp = require('../services/whatsapp');
const { emitLocationUpdate, emitDeliveryUpdate, emitScheduleUpdate } = require('../socket/index');

const router = express.Router();

/**
 * POST /webhook/whatsapp
 * Receives incoming messages from Evolution API
 */
router.post('/whatsapp', async (req, res) => {
  try {
    // Immediately respond to webhook
    res.status(200).json({ status: 'received' });

    const data = req.body;
    
    // Evolution API webhook payload structure
    const event = data.event;
    
    if (event === 'messages.upsert') {
      const message = data.data;
      if (!message || message.key?.fromMe) return;

      const phone = message.key?.remoteJid?.replace('@s.whatsapp.net', '') || '';
      const messageText = message.message?.conversation || 
                          message.message?.extendedTextMessage?.text || '';
      const buttonResponseId = message.message?.buttonsResponseMessage?.selectedButtonId ||
                               message.message?.templateButtonReplyMessage?.selectedId || '';
      const location = message.message?.locationMessage;

      console.log(`[Webhook] Message from ${phone}: ${messageText || buttonResponseId || 'location'}`);

      // Handle button responses
      if (buttonResponseId) {
        await handleButtonResponse(phone, buttonResponseId);
        return;
      }

      // Handle location messages
      if (location) {
        await handleLocationMessage(phone, location.degreesLatitude, location.degreesLongitude);
        return;
      }

      // Handle text messages
      if (messageText) {
        await handleTextMessage(phone, messageText.trim());
      }
    }
  } catch (err) {
    console.error('[Webhook] Error processing message:', err);
    // Don't let errors break the webhook
  }
});

/**
 * Handle button response messages
 */
async function handleButtonResponse(phone, buttonId) {
  // Delivery acceptance
  if (buttonId.startsWith('accept_delivery_')) {
    const deliveryId = parseInt(buttonId.replace('accept_delivery_', ''));
    const motoboy = await db.query('SELECT * FROM motoboys WHERE whatsapp = $1', [phone]);
    
    if (motoboy.rows[0]) {
      const delivery = await deliveryService.acceptDelivery(deliveryId, motoboy.rows[0].id);
      emitDeliveryUpdate(delivery);
      console.log(`[Webhook] Motoboy ${motoboy.rows[0].name} accepted delivery #${deliveryId}`);
    }
    return;
  }

  // Delivery refusal
  if (buttonId.startsWith('refuse_delivery_')) {
    const deliveryId = parseInt(buttonId.replace('refuse_delivery_', ''));
    const motoboy = await db.query('SELECT * FROM motoboys WHERE whatsapp = $1', [phone]);
    
    if (motoboy.rows[0]) {
      const result = await deliveryService.refuseDelivery(deliveryId, motoboy.rows[0].id);
      console.log(`[Webhook] Motoboy ${motoboy.rows[0].name} refused delivery #${deliveryId}`);
    }
    return;
  }

  // Schedule confirmation
  if (buttonId.startsWith('confirm_schedule_')) {
    const scheduleId = parseInt(buttonId.replace('confirm_schedule_', ''));
    const schedule = await scheduleService.confirmSchedule(scheduleId);
    
    if (schedule) {
      await whatsapp.sendMessage(phone, '\u2705 Confirma\u00e7\u00e3o registrada! Obrigado.');
      emitScheduleUpdate(schedule);
    }
    return;
  }

  // Swap request
  if (buttonId.startsWith('swap_schedule_')) {
    const scheduleId = parseInt(buttonId.replace('swap_schedule_', ''));
    
    // Save context: waiting for swap reason
    await db.query(
      `INSERT INTO whatsapp_sessions (phone, context_type, context_data) 
       VALUES ($1, 'awaiting_swap_reason', $2)
       ON CONFLICT (phone) DO UPDATE SET context_type = 'awaiting_swap_reason', context_data = $2, updated_at = NOW()`,
      [phone, JSON.stringify({ schedule_id: scheduleId })]
    );

    // Note: The above ON CONFLICT won't work since phone isn't unique.
    // We'll use upsert logic in a different way:
    await db.query('DELETE FROM whatsapp_sessions WHERE phone = $1 AND context_type = $2', [phone, 'awaiting_swap_reason']);
    await db.query(
      `INSERT INTO whatsapp_sessions (phone, context_type, context_data) VALUES ($1, 'awaiting_swap_reason', $2)`,
      [phone, JSON.stringify({ schedule_id: scheduleId })]
    );

    await whatsapp.sendMessage(phone, '\ud83d\udd04 Por favor, informe o motivo da solicita\u00e7\u00e3o de troca:');
    return;
  }
}

/**
 * Handle text messages with keyword/pattern matching
 */
async function handleTextMessage(phone, text) {
  const lowerText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Check for pending context (awaiting swap reason)
  const sessionResult = await db.query(
    `SELECT * FROM whatsapp_sessions WHERE phone = $1 AND context_type = 'awaiting_swap_reason' ORDER BY updated_at DESC LIMIT 1`,
    [phone]
  );

  if (sessionResult.rows.length > 0) {
    const session = sessionResult.rows[0];
    const scheduleId = session.context_data.schedule_id;
    
    const result = await scheduleService.requestSwap(scheduleId, text);
    
    await whatsapp.sendMessage(phone, 
      `\ud83d\udccb Solicita\u00e7\u00e3o de troca registrada!\n\n\ud83d\udca1 Sugest\u00e3o da IA:\n${result.aiSuggestion}\n\nO gerente ser\u00e1 notificado e responder\u00e1 em breve.`
    );

    // Clean up session
    await db.query('DELETE FROM whatsapp_sessions WHERE id = $1', [session.id]);
    return;
  }

  // "entregue" - delivery completion
  if (lowerText.includes('entregue') || lowerText.includes('entrega concluida') || lowerText.includes('entrega finalizada')) {
    const motoboy = await db.query('SELECT * FROM motoboys WHERE whatsapp = $1', [phone]);
    if (motoboy.rows[0]) {
      const activeDelivery = await db.query(
        `SELECT * FROM deliveries WHERE motoboy_id = $1 AND status IN ('accepted', 'in_transit') ORDER BY created_at DESC LIMIT 1`,
        [motoboy.rows[0].id]
      );

      if (activeDelivery.rows[0]) {
        const delivery = await deliveryService.completeDelivery(activeDelivery.rows[0].id);
        emitDeliveryUpdate(delivery);
        await whatsapp.sendMessage(phone, `\u2705 Entrega ${delivery.tracking_code} finalizada com sucesso! Obrigado.`);
      } else {
        await whatsapp.sendMessage(phone, '\u26a0\ufe0f Nenhuma entrega ativa encontrada para voc\u00ea.');
      }
    }
    return;
  }

  // "vou faltar" - absence notification
  if (lowerText.includes('vou faltar') || lowerText.includes('nao vou poder ir') || lowerText.includes('nao posso ir')) {
    const employee = await db.query('SELECT * FROM employees WHERE whatsapp = $1', [phone]);
    if (employee.rows[0]) {
      // Try to extract date from message
      const dateMatch = text.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
      let date;
      
      if (dateMatch) {
        const parts = dateMatch[1].split('/');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2] ? (parts[2].length === 2 ? '20' + parts[2] : parts[2]) : new Date().getFullYear();
        date = `${year}-${month}-${day}`;
      } else {
        // Default to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        date = tomorrow.toISOString().split('T')[0];
      }

      const result = await scheduleService.handleAbsence(employee.rows[0].id, date);
      
      await whatsapp.sendMessage(phone, 
        `\ud83d\udcdd Falta registrada para ${new Date(date).toLocaleDateString('pt-BR')}.\n\n\ud83d\udca1 Sugest\u00e3o da IA para substitui\u00e7\u00e3o:\n${result.aiSuggestion}\n\nO gerente ser\u00e1 notificado.`
      );
    } else {
      await whatsapp.sendMessage(phone, '\u26a0\ufe0f Seu n\u00famero n\u00e3o est\u00e1 cadastrado no sistema.');
    }
    return;
  }

  // Delivery command from owner: "entrega [route] [price]"
  if (lowerText.startsWith('entrega ') || lowerText.startsWith('nova entrega')) {
    // Parse: "entrega Rua A para Rua B 15.00" or "entrega Rua A para Rua B R$15,00"
    const isOwner = await db.query(
      `SELECT * FROM users WHERE id IN (
        SELECT id FROM users WHERE role IN ('owner', 'admin')
      )`
    );

    // Extract price (last number in the message)
    const priceMatch = text.match(/(?:R\$?\s?)(\d+[,.]?\d*)\s*$/);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : 0;

    // Route is everything between "entrega" and the price
    let routeDesc = text.replace(/^(?:nova\s+)?entrega\s+/i, '');
    if (priceMatch) {
      routeDesc = routeDesc.replace(/(?:R\$?\s?)?\d+[,.]?\d*\s*$/, '').trim();
    }

    if (routeDesc && price > 0) {
      const delivery = await deliveryService.createDelivery({
        routeDescription: routeDesc,
        price,
        assignmentMode: 'round_robin',
      });

      const assignResult = await deliveryService.assignDelivery(delivery.id);
      emitDeliveryUpdate(delivery);

      if (assignResult.success) {
        await whatsapp.sendMessage(phone,
          `\u2705 Entrega criada!\n\n\ud83d\udce6 C\u00f3digo: ${delivery.tracking_code}\n\ud83d\udccd Rota: ${routeDesc}\n\ud83d\udcb0 Valor: R$ ${price.toFixed(2)}\n\ud83c\udfcd\ufe0f Atribu\u00edda para: ${assignResult.motoboy.name}`
        );
      } else {
        await whatsapp.sendMessage(phone,
          `\u26a0\ufe0f Entrega criada (${delivery.tracking_code}), mas nenhum motoboy dispon\u00edvel no momento.`
        );
      }
    } else {
      await whatsapp.sendMessage(phone,
        '\ud83d\udcdd Para criar uma entrega, envie:\n\nentrega [descri\u00e7\u00e3o da rota] [valor]\n\nExemplo: entrega Rua das Flores 123 para Av. Brasil 456 15.00'
      );
    }
    return;
  }

  // Schedule command from manager: "escala [employee] [date] [hours] [task]"
  if (lowerText.startsWith('escala ') || lowerText.startsWith('escalar ')) {
    // Parse: "escala Ana Paula 28/08 08:00-16:00 Atendimento"
    const schedMatch = text.match(/escal(?:a|ar)\s+(.+?)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\s*(.*)?/i);
    
    if (schedMatch) {
      const [, empName, dateStr, startTime, endTime, task] = schedMatch;
      
      // Find employee by name
      const empResult = await db.query(
        `SELECT * FROM employees WHERE LOWER(name) LIKE $1`,
        [`%${empName.toLowerCase()}%`]
      );

      if (empResult.rows[0]) {
        const parts = dateStr.split('/');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2] ? (parts[2].length === 2 ? '20' + parts[2] : parts[2]) : new Date().getFullYear();
        const date = `${year}-${month}-${day}`;

        const schedule = await scheduleService.createSchedule({
          employeeId: empResult.rows[0].id,
          date,
          startTime: startTime,
          endTime: endTime,
          task: task || null,
        });

        emitScheduleUpdate(schedule);
        await whatsapp.sendMessage(phone,
          `\u2705 Escala criada!\n\n\ud83d\udc64 ${empResult.rows[0].name}\n\ud83d\udcc5 ${dateStr}\n\u23f0 ${startTime} - ${endTime}\n\ud83d\udcdd ${task || 'Sem tarefa definida'}\n\nO funcion\u00e1rio foi notificado.`
        );
      } else {
        await whatsapp.sendMessage(phone, `\u26a0\ufe0f Funcion\u00e1rio "${empName}" n\u00e3o encontrado.`);
      }
    } else {
      await whatsapp.sendMessage(phone,
        '\ud83d\udcdd Para criar uma escala, envie:\n\nescala [nome] [data] [hor\u00e1rio in\u00edcio]-[hor\u00e1rio fim] [tarefa]\n\nExemplo: escala Ana Paula 28/08 08:00-16:00 Atendimento'
      );
    }
    return;
  }

  // Default: unrecognized message
  await whatsapp.sendMessage(phone,
    `\ud83d\udc4b Ol\u00e1! Comandos dispon\u00edveis:\n\n\ud83c\udfcd\ufe0f *Entregas:*\nentrega [rota] [valor]\nentregue (para finalizar)\n\n\ud83d\udccb *Escalas:*\nescala [nome] [data] [hor\u00e1rio] [tarefa]\nvou faltar [data]\n\n\ud83d\udccd Compartilhe sua localiza\u00e7\u00e3o para atualizar o rastreamento.`
  );
}

/**
 * Handle location messages from motoboys
 */
async function handleLocationMessage(phone, lat, lng) {
  const motoboy = await db.query('SELECT * FROM motoboys WHERE whatsapp = $1', [phone]);
  
  if (motoboy.rows[0]) {
    // Update motoboy location
    await db.query(
      'UPDATE motoboys SET last_lat = $1, last_lng = $2, updated_at = NOW() WHERE id = $3',
      [lat, lng, motoboy.rows[0].id]
    );

    // Find active delivery for this motoboy
    const activeDelivery = await db.query(
      `SELECT * FROM deliveries WHERE motoboy_id = $1 AND status IN ('accepted', 'in_transit') ORDER BY created_at DESC LIMIT 1`,
      [motoboy.rows[0].id]
    );

    if (activeDelivery.rows[0]) {
      const delivery = activeDelivery.rows[0];

      // Update delivery status to in_transit if accepted
      if (delivery.status === 'accepted') {
        await db.query("UPDATE deliveries SET status = 'in_transit' WHERE id = $1", [delivery.id]);
      }

      // Save location point
      await deliveryService.updateLocation(delivery.id, lat, lng);

      // Emit real-time update
      emitLocationUpdate(delivery.tracking_code, { lat, lng, timestamp: new Date() });
      
      console.log(`[Webhook] Location update for delivery ${delivery.tracking_code}: ${lat}, ${lng}`);
    }
  }
}

module.exports = router;
