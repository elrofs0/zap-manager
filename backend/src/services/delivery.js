const db = require('../config/database');
const whatsapp = require('./whatsapp');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a unique tracking code
 */
function generateTrackingCode() {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ENT-${year}-${rand}`;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get next motoboy using round-robin
 */
async function getNextMotoboyRoundRobin(excludeIds = []) {
  const excludeClause = excludeIds.length > 0
    ? `AND id NOT IN (${excludeIds.map((_, i) => `$${i + 1}`).join(',')})`
    : '';

  const result = await db.query(
    `SELECT * FROM motoboys 
     WHERE status = 'available' ${excludeClause}
     ORDER BY updated_at ASC 
     LIMIT 1`,
    excludeIds
  );
  return result.rows[0] || null;
}

/**
 * Get nearest available motoboy to a reference point
 */
async function getNearestMotoboy(lat, lng, excludeIds = []) {
  const result = await db.query(
    `SELECT *, 
     (6371 * acos(cos(radians($1)) * cos(radians(last_lat)) * cos(radians(last_lng) - radians($2)) + sin(radians($1)) * sin(radians(last_lat)))) AS distance
     FROM motoboys 
     WHERE status = 'available' AND last_lat IS NOT NULL AND last_lng IS NOT NULL
     ${excludeIds.length > 0 ? `AND id NOT IN (${excludeIds.map((_, i) => `$${i + 3}`).join(',')})` : ''}
     ORDER BY distance ASC 
     LIMIT 1`,
    [lat, lng, ...excludeIds]
  );
  return result.rows[0] || null;
}

/**
 * Create a new delivery
 */
async function createDelivery({ routeDescription, price, customerName, customerWhatsapp, assignmentMode, createdBy }) {
  const trackingCode = generateTrackingCode();

  const result = await db.query(
    `INSERT INTO deliveries (tracking_code, route_description, price, customer_name, customer_whatsapp, assignment_mode, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
     RETURNING *`,
    [trackingCode, routeDescription, price, customerName, customerWhatsapp, assignmentMode || 'round_robin', createdBy]
  );

  return result.rows[0];
}

/**
 * Assign delivery to next available motoboy
 */
async function assignDelivery(deliveryId, excludeMotoboyIds = []) {
  const deliveryResult = await db.query('SELECT * FROM deliveries WHERE id = $1', [deliveryId]);
  const delivery = deliveryResult.rows[0];
  if (!delivery) throw new Error('Entrega n\u00e3o encontrada');

  let motoboy;
  if (delivery.assignment_mode === 'nearest') {
    // Use a default reference point (could be restaurant location)
    motoboy = await getNearestMotoboy(-23.5505, -46.6333, excludeMotoboyIds);
  } else {
    motoboy = await getNextMotoboyRoundRobin(excludeMotoboyIds);
  }

  if (!motoboy) {
    return { success: false, message: 'Nenhum motoboy dispon\u00edvel no momento.' };
  }

  // Update delivery
  await db.query(
    `UPDATE deliveries SET motoboy_id = $1, status = 'assigned' WHERE id = $2`,
    [motoboy.id, deliveryId]
  );

  // Send WhatsApp to motoboy
  try {
    await whatsapp.sendButtonMessage(
      motoboy.whatsapp,
      '\ud83c\udfcd\ufe0f Nova Entrega!',
      `\ud83d\udccd Rota: ${delivery.route_description}\n\ud83d\udcb0 Valor: R$ ${parseFloat(delivery.price).toFixed(2)}\n\ud83d\udce6 C\u00f3digo: ${delivery.tracking_code}`,
      [
        { text: '\u2705 Aceitar', id: `accept_delivery_${deliveryId}` },
        { text: '\u274c Recusar', id: `refuse_delivery_${deliveryId}` },
      ]
    );
  } catch (err) {
    console.error('[Delivery] Failed to send WhatsApp to motoboy:', err.message);
  }

  return { success: true, motoboy, delivery };
}

/**
 * Handle motoboy acceptance
 */
async function acceptDelivery(deliveryId, motoboyId) {
  const DOMAIN = process.env.DOMAIN || 'localhost';

  const result = await db.query(
    `UPDATE deliveries SET status = 'accepted', accepted_at = NOW() WHERE id = $1 RETURNING *`,
    [deliveryId]
  );
  const delivery = result.rows[0];

  // Mark motoboy as busy
  await db.query(`UPDATE motoboys SET status = 'busy', updated_at = NOW() WHERE id = $1`, [motoboyId]);

  // Notify customer
  if (delivery.customer_whatsapp) {
    const trackingUrl = `https://${DOMAIN}/rastrear/${delivery.tracking_code}`;
    try {
      await whatsapp.sendMessage(
        delivery.customer_whatsapp,
        `\ud83c\udf89 Seu pedido est\u00e1 a caminho!\n\n\ud83d\udce6 C\u00f3digo: ${delivery.tracking_code}\n\ud83d\udd17 Rastreie aqui: ${trackingUrl}\n\nVoc\u00ea receber\u00e1 atualiza\u00e7\u00f5es em tempo real!`
      );
    } catch (err) {
      console.error('[Delivery] Failed to notify customer:', err.message);
    }
  }

  // Ask motoboy to share location
  const motoboyResult = await db.query('SELECT * FROM motoboys WHERE id = $1', [motoboyId]);
  const motoboy = motoboyResult.rows[0];
  if (motoboy) {
    try {
      await whatsapp.sendLocationRequest(
        motoboy.whatsapp,
        `\u2705 Entrega aceita! C\u00f3digo: ${delivery.tracking_code}\n\nCompartilhe sua localiza\u00e7\u00e3o em tempo real para que o cliente possa acompanhar.`
      );
    } catch (err) {
      console.error('[Delivery] Failed to request location:', err.message);
    }
  }

  return delivery;
}

/**
 * Handle motoboy refusal
 */
async function refuseDelivery(deliveryId, motoboyId) {
  // Get list of motoboys who already refused
  const delivery = await db.query('SELECT * FROM deliveries WHERE id = $1', [deliveryId]);
  if (!delivery.rows[0]) return;

  // Update delivery status back to pending
  await db.query(`UPDATE deliveries SET status = 'pending', motoboy_id = NULL WHERE id = $1`, [deliveryId]);

  // Try next motoboy (exclude the one who refused)
  // Get session data for refused list
  const sessionResult = await db.query(
    `SELECT * FROM whatsapp_sessions WHERE context_type = 'delivery_refused' AND context_data->>'delivery_id' = $1`,
    [String(deliveryId)]
  );

  let refusedIds = [motoboyId];
  if (sessionResult.rows[0]) {
    const existingRefused = sessionResult.rows[0].context_data.refused_ids || [];
    refusedIds = [...new Set([...existingRefused, motoboyId])];
    await db.query(
      `UPDATE whatsapp_sessions SET context_data = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify({ delivery_id: String(deliveryId), refused_ids: refusedIds }), sessionResult.rows[0].id]
    );
  } else {
    await db.query(
      `INSERT INTO whatsapp_sessions (phone, context_type, context_data) VALUES ($1, $2, $3)`,
      ['system', 'delivery_refused', JSON.stringify({ delivery_id: String(deliveryId), refused_ids: refusedIds })]
    );
  }

  // Assign to next motoboy
  return assignDelivery(deliveryId, refusedIds);
}

/**
 * Complete a delivery
 */
async function completeDelivery(deliveryId) {
  const result = await db.query(
    `UPDATE deliveries SET status = 'delivered', delivered_at = NOW() WHERE id = $1 RETURNING *`,
    [deliveryId]
  );
  const delivery = result.rows[0];

  if (delivery) {
    // Free up motoboy
    if (delivery.motoboy_id) {
      await db.query(`UPDATE motoboys SET status = 'available', updated_at = NOW() WHERE id = $1`, [delivery.motoboy_id]);
    }

    // Notify customer
    if (delivery.customer_whatsapp) {
      try {
        await whatsapp.sendMessage(
          delivery.customer_whatsapp,
          `\u2705 Entrega conclu\u00edda!\n\n\ud83d\udce6 C\u00f3digo: ${delivery.tracking_code}\nObrigado pela prefer\u00eancia! \ud83d\ude0a`
        );
      } catch (err) {
        console.error('[Delivery] Failed to notify customer on completion:', err.message);
      }
    }
  }

  return delivery;
}

/**
 * Update motoboy location for a delivery
 */
async function updateLocation(deliveryId, lat, lng) {
  await db.query(
    `INSERT INTO delivery_locations (delivery_id, lat, lng) VALUES ($1, $2, $3)`,
    [deliveryId, lat, lng]
  );

  // Also update motoboy last known location
  const delivery = await db.query('SELECT motoboy_id FROM deliveries WHERE id = $1', [deliveryId]);
  if (delivery.rows[0] && delivery.rows[0].motoboy_id) {
    await db.query(
      `UPDATE motoboys SET last_lat = $1, last_lng = $2, updated_at = NOW() WHERE id = $3`,
      [lat, lng, delivery.rows[0].motoboy_id]
    );
  }

  return { lat, lng, timestamp: new Date() };
}

module.exports = {
  createDelivery,
  assignDelivery,
  acceptDelivery,
  refuseDelivery,
  completeDelivery,
  updateLocation,
  generateTrackingCode,
};
