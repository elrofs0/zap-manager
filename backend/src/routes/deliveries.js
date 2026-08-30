const express = require('express');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const deliveryService = require('../services/delivery');
const { emitDeliveryUpdate } = require('../socket/index');

const router = express.Router();

// GET /api/deliveries - List all deliveries
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT d.*, m.name as motoboy_name, m.whatsapp as motoboy_whatsapp
      FROM deliveries d 
      LEFT JOIN motoboys m ON d.motoboy_id = m.id
    `;
    const params = [];

    if (status) {
      query += ` WHERE d.status = $1`;
      params.push(status);
    }

    query += ` ORDER BY d.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    const countQuery = status
      ? 'SELECT COUNT(*) FROM deliveries WHERE status = $1'
      : 'SELECT COUNT(*) FROM deliveries';
    const countResult = await db.query(countQuery, status ? [status] : []);

    res.json({
      deliveries: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Error fetching deliveries:', err);
    res.status(500).json({ error: 'Erro ao buscar entregas' });
  }
});

// GET /api/deliveries/active - Active deliveries with locations
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT d.*, m.name as motoboy_name, m.last_lat, m.last_lng,
        (SELECT json_agg(json_build_object('lat', dl.lat, 'lng', dl.lng, 'timestamp', dl.timestamp) ORDER BY dl.timestamp DESC)
         FROM delivery_locations dl WHERE dl.delivery_id = d.id) as locations
      FROM deliveries d
      LEFT JOIN motoboys m ON d.motoboy_id = m.id
      WHERE d.status IN ('accepted', 'in_transit', 'assigned')
      ORDER BY d.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching active deliveries:', err);
    res.status(500).json({ error: 'Erro ao buscar entregas ativas' });
  }
});

// GET /api/deliveries/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.*, m.name as motoboy_name 
       FROM deliveries d LEFT JOIN motoboys m ON d.motoboy_id = m.id 
       WHERE d.id = $1`,
      [req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Entrega n\u00e3o encontrada' });
    }

    const locations = await db.query(
      'SELECT * FROM delivery_locations WHERE delivery_id = $1 ORDER BY timestamp DESC',
      [req.params.id]
    );

    res.json({ ...result.rows[0], locations: locations.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar entrega' });
  }
});

// POST /api/deliveries - Create new delivery
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { route_description, price, customer_name, customer_whatsapp, assignment_mode } = req.body;

    if (!route_description || !price) {
      return res.status(400).json({ error: 'Descri\u00e7\u00e3o da rota e pre\u00e7o s\u00e3o obrigat\u00f3rios' });
    }

    const delivery = await deliveryService.createDelivery({
      routeDescription: route_description,
      price,
      customerName: customer_name,
      customerWhatsapp: customer_whatsapp,
      assignmentMode: assignment_mode,
      createdBy: req.user.id,
    });

    // Auto-assign to motoboy
    const assignResult = await deliveryService.assignDelivery(delivery.id);

    emitDeliveryUpdate({ ...delivery, ...assignResult });

    res.status(201).json({
      delivery,
      assignment: assignResult,
    });
  } catch (err) {
    console.error('Error creating delivery:', err);
    res.status(500).json({ error: 'Erro ao criar entrega' });
  }
});

// PUT /api/deliveries/:id/status
router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'assigned', 'accepted', 'in_transit', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status inv\u00e1lido' });
    }

    let delivery;
    if (status === 'delivered') {
      delivery = await deliveryService.completeDelivery(req.params.id);
    } else {
      const result = await db.query(
        'UPDATE deliveries SET status = $1 WHERE id = $2 RETURNING *',
        [status, req.params.id]
      );
      delivery = result.rows[0];
    }

    if (!delivery) {
      return res.status(404).json({ error: 'Entrega n\u00e3o encontrada' });
    }

    emitDeliveryUpdate(delivery);
    res.json(delivery);
  } catch (err) {
    console.error('Error updating delivery status:', err);
    res.status(500).json({ error: 'Erro ao atualizar entrega' });
  }
});

// GET /api/deliveries/track/:tracking_code - Public tracking (no auth)
router.get('/track/:tracking_code', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.tracking_code, d.status, d.route_description, d.created_at, d.accepted_at, d.delivered_at,
              m.name as motoboy_name, m.last_lat, m.last_lng
       FROM deliveries d
       LEFT JOIN motoboys m ON d.motoboy_id = m.id
       WHERE d.tracking_code = $1`,
      [req.params.tracking_code]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Entrega n\u00e3o encontrada' });
    }

    const delivery = result.rows[0];
    // Only show first name of motoboy
    if (delivery.motoboy_name) {
      delivery.motoboy_name = delivery.motoboy_name.split(' ')[0];
    }

    // Get location history
    const locResult = await db.query(
      `SELECT dl.lat, dl.lng, dl.timestamp 
       FROM delivery_locations dl 
       JOIN deliveries d ON dl.delivery_id = d.id 
       WHERE d.tracking_code = $1 
       ORDER BY dl.timestamp DESC 
       LIMIT 50`,
      [req.params.tracking_code]
    );

    res.json({
      ...delivery,
      locations: locResult.rows,
    });
  } catch (err) {
    console.error('Error tracking delivery:', err);
    res.status(500).json({ error: 'Erro ao rastrear entrega' });
  }
});

module.exports = router;
