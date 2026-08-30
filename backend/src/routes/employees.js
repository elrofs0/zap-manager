const express = require('express');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/employees
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM employees ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar funcion\u00e1rios' });
  }
});

// GET /api/employees/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Funcion\u00e1rio n\u00e3o encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar funcion\u00e1rio' });
  }
});

// POST /api/employees
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, whatsapp, role, department } = req.body;
    if (!name || !whatsapp) {
      return res.status(400).json({ error: 'Nome e WhatsApp s\u00e3o obrigat\u00f3rios' });
    }

    const result = await db.query(
      'INSERT INTO employees (name, whatsapp, role, department) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, whatsapp, role, department]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'WhatsApp j\u00e1 cadastrado' });
    }
    res.status(500).json({ error: 'Erro ao criar funcion\u00e1rio' });
  }
});

// PUT /api/employees/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, whatsapp, role, department } = req.body;
    const result = await db.query(
      `UPDATE employees SET 
        name = COALESCE($1, name),
        whatsapp = COALESCE($2, whatsapp),
        role = COALESCE($3, role),
        department = COALESCE($4, department)
       WHERE id = $5 RETURNING *`,
      [name, whatsapp, role, department, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Funcion\u00e1rio n\u00e3o encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar funcion\u00e1rio' });
  }
});

// DELETE /api/employees/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM employees WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Funcion\u00e1rio n\u00e3o encontrado' });
    res.json({ message: 'Funcion\u00e1rio removido com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover funcion\u00e1rio' });
  }
});

module.exports = router;
