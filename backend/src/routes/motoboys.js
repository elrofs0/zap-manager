const express = require('express');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/motoboys
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM motoboys ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar motoboys' });
  }
});

// GET /api/motoboys/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM motoboys WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Motoboy n\u00e3o encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar motoboy' });
  }
});

// POST /api/motoboys
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, whatsapp, status } = req.body;
    if (!name || !whatsapp) {
      return res.status(400).json({ error: 'Nome e WhatsApp s\u00e3o obrigat\u00f3rios' });
    }

    const result = await db.query(
      'INSERT INTO motoboys (name, whatsapp, status) VALUES ($1, $2, $3) RETURNING *',
      [name, whatsapp, status || 'available']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'WhatsApp j\u00e1 cadastrado' });
    }
    res.status(500).json({ error: 'Erro ao criar motoboy' });
  }
});

// PUT /api/motoboys/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, whatsapp, status } = req.body;
    const result = await db.query(
      `UPDATE motoboys SET 
        name = COALESCE($1, name), 
        whatsapp = COALESCE($2, whatsapp), 
        status = COALESCE($3, status),
        updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [name, whatsapp, status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Motoboy n\u00e3o encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar motoboy' });
  }
});

// DELETE /api/motoboys/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM motoboys WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Motoboy n\u00e3o encontrado' });
    res.json({ message: 'Motoboy removido com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover motoboy' });
  }
});

module.exports = router;
