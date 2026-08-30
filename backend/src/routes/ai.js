const express = require('express');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { chatWithAI } = require('../services/openai');

const router = express.Router();

// POST /api/ai/chat
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Mensagens s\u00e3o obrigat\u00f3rias' });
    }

    // Build schedule context
    const today = new Date().toISOString().split('T')[0];
    const schedules = await db.query(
      `SELECT s.*, e.name as employee_name, e.department, e.role as employee_role
       FROM schedules s JOIN employees e ON s.employee_id = e.id
       WHERE s.date >= $1
       ORDER BY s.date ASC, s.start_time ASC
       LIMIT 100`,
      [today]
    );

    const employees = await db.query('SELECT * FROM employees ORDER BY name');
    const motoboys = await db.query('SELECT * FROM motoboys ORDER BY name');

    const scheduleContext = `
Funcion\u00e1rios: ${employees.rows.map(e => `${e.name} (${e.role}, ${e.department})`).join('; ')}
Motoboys: ${motoboys.rows.map(m => `${m.name} (${m.status})`).join('; ')}
Escalas pr\u00f3ximas: ${schedules.rows.map(s => 
  `${s.employee_name} - ${new Date(s.date).toLocaleDateString('pt-BR')} ${s.start_time}-${s.end_time} [${s.status}] ${s.task || ''}`
).join('\n')}
`;

    const aiResponse = await chatWithAI(messages, scheduleContext);

    // Log the interaction
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
    await db.query(
      'INSERT INTO schedule_ai_logs (request_text, ai_response, approved_by) VALUES ($1, $2, $3)',
      [lastUserMsg?.content || '', aiResponse, req.user.id]
    );

    res.json({ response: aiResponse });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: 'Erro ao processar solicita\u00e7\u00e3o de IA' });
  }
});

module.exports = router;
