const express = require('express');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const scheduleService = require('../services/schedule');
const { emitScheduleUpdate } = require('../socket/index');

const router = express.Router();

// GET /api/schedules
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { start_date, end_date, employee_id } = req.query;
    let query = `
      SELECT s.*, e.name as employee_name, e.department, e.role as employee_role
      FROM schedules s
      JOIN employees e ON s.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      params.push(start_date);
      query += ` AND s.date >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      query += ` AND s.date <= $${params.length}`;
    }
    if (employee_id) {
      params.push(employee_id);
      query += ` AND s.employee_id = $${params.length}`;
    }

    query += ' ORDER BY s.date ASC, s.start_time ASC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching schedules:', err);
    res.status(500).json({ error: 'Erro ao buscar escalas' });
  }
});

// POST /api/schedules
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { employee_id, date, start_time, end_time, task } = req.body;

    if (!employee_id || !date || !start_time || !end_time) {
      return res.status(400).json({ error: 'Funcion\u00e1rio, data, hor\u00e1rio de in\u00edcio e fim s\u00e3o obrigat\u00f3rios' });
    }

    const schedule = await scheduleService.createSchedule({
      employeeId: employee_id,
      date,
      startTime: start_time,
      endTime: end_time,
      task,
      createdBy: req.user.id,
    });

    emitScheduleUpdate(schedule);
    res.status(201).json(schedule);
  } catch (err) {
    console.error('Error creating schedule:', err);
    res.status(500).json({ error: 'Erro ao criar escala' });
  }
});

// PUT /api/schedules/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { employee_id, date, start_time, end_time, task, status } = req.body;
    const result = await db.query(
      `UPDATE schedules SET 
        employee_id = COALESCE($1, employee_id),
        date = COALESCE($2, date),
        start_time = COALESCE($3, start_time),
        end_time = COALESCE($4, end_time),
        task = COALESCE($5, task),
        status = COALESCE($6, status)
       WHERE id = $7 RETURNING *`,
      [employee_id, date, start_time, end_time, task, status, req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Escala n\u00e3o encontrada' });

    emitScheduleUpdate(result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar escala' });
  }
});

// DELETE /api/schedules/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      "UPDATE schedules SET status = 'cancelled' WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Escala n\u00e3o encontrada' });
    res.json({ message: 'Escala cancelada com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cancelar escala' });
  }
});

// GET /api/schedules/ai-logs
router.get('/ai-logs', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM schedule_ai_logs ORDER BY created_at DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar logs de IA' });
  }
});

module.exports = router;
