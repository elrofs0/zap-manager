const db = require('../config/database');
const whatsapp = require('./whatsapp');
const openaiService = require('./openai');

/**
 * Create a new schedule
 */
async function createSchedule({ employeeId, date, startTime, endTime, task, createdBy }) {
  const result = await db.query(
    `INSERT INTO schedules (employee_id, date, start_time, end_time, task, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [employeeId, date, startTime, endTime, task, createdBy]
  );

  const schedule = result.rows[0];

  // Get employee info and notify via WhatsApp
  const empResult = await db.query('SELECT * FROM employees WHERE id = $1', [employeeId]);
  const employee = empResult.rows[0];

  if (employee) {
    try {
      await whatsapp.sendButtonMessage(
        employee.whatsapp,
        '\ud83d\udccb Nova Escala',
        `Ol\u00e1 ${employee.name}!\n\nVoc\u00ea foi escalado para ${formatDate(date)} das ${startTime} \u00e0s ${endTime}\n\ud83d\udcdd Tarefa: ${task || 'A definir'}`,
        [
          { text: '\u2705 Ciente', id: `confirm_schedule_${schedule.id}` },
          { text: '\ud83d\udd04 Solicitar Troca', id: `swap_schedule_${schedule.id}` },
        ]
      );
    } catch (err) {
      console.error('[Schedule] Failed to notify employee:', err.message);
    }
  }

  return schedule;
}

/**
 * Handle schedule confirmation
 */
async function confirmSchedule(scheduleId) {
  const result = await db.query(
    `UPDATE schedules SET status = 'confirmed' WHERE id = $1 RETURNING *`,
    [scheduleId]
  );
  return result.rows[0];
}

/**
 * Handle swap request
 */
async function requestSwap(scheduleId, reason) {
  await db.query(
    `UPDATE schedules SET status = 'swap_requested', swap_reason = $2 WHERE id = $1`,
    [scheduleId, reason]
  );

  // Get schedule details with employee info
  const schedResult = await db.query(
    `SELECT s.*, e.name as employee_name, e.department 
     FROM schedules s JOIN employees e ON s.employee_id = e.id 
     WHERE s.id = $1`,
    [scheduleId]
  );
  const schedule = schedResult.rows[0];

  // Get available employees for suggestion
  const availableResult = await db.query(
    `SELECT e.* FROM employees e 
     WHERE e.department = $1 AND e.id != $2
     AND e.id NOT IN (
       SELECT employee_id FROM schedules 
       WHERE date = $3 AND status NOT IN ('cancelled', 'absent')
     )`,
    [schedule.department, schedule.employee_id, schedule.date]
  );

  const availableNames = availableResult.rows.map(e => e.name).join(', ');

  // Ask AI for suggestion
  const aiContext = `
O funcion\u00e1rio ${schedule.employee_name} do departamento ${schedule.department} solicitou troca do turno ${schedule.start_time}-${schedule.end_time} no dia ${formatDate(schedule.date)}.
Motivo: ${reason}
Tarefa: ${schedule.task || 'N\u00e3o especificada'}
Funcion\u00e1rios dispon\u00edveis nesse dia: ${availableNames || 'Nenhum dispon\u00edvel'}
`;

  const aiSuggestion = await openaiService.getScheduleSuggestion(aiContext);

  // Log AI suggestion
  await db.query(
    `INSERT INTO schedule_ai_logs (request_text, ai_response) VALUES ($1, $2)`,
    [`Troca solicitada - Escala #${scheduleId}: ${reason}`, aiSuggestion]
  );

  // Notify manager
  const managers = await db.query("SELECT * FROM users WHERE role IN ('manager', 'admin')");
  // In production, this would notify managers via their configured WhatsApp
  
  return { schedule, aiSuggestion, availableEmployees: availableResult.rows };
}

/**
 * Handle absence notification
 */
async function handleAbsence(employeeId, date) {
  // Mark scheduled shifts as absent
  await db.query(
    `UPDATE schedules SET status = 'absent' WHERE employee_id = $1 AND date = $2 AND status NOT IN ('cancelled')`,
    [employeeId, date]
  );

  // Get employee and schedules info
  const empResult = await db.query('SELECT * FROM employees WHERE id = $1', [employeeId]);
  const employee = empResult.rows[0];

  const schedResult = await db.query(
    `SELECT * FROM schedules WHERE employee_id = $1 AND date = $2`,
    [employeeId, date]
  );

  // Get available replacements
  const availableResult = await db.query(
    `SELECT e.* FROM employees e 
     WHERE e.department = $1 AND e.id != $2
     AND e.id NOT IN (
       SELECT employee_id FROM schedules 
       WHERE date = $3 AND status NOT IN ('cancelled', 'absent')
     )`,
    [employee.department, employeeId, date]
  );

  const availableNames = availableResult.rows.map(e => `${e.name} (${e.role})`).join(', ');

  // Ask AI for replacement suggestion
  const aiContext = `
O funcion\u00e1rio ${employee.name} (${employee.role}, ${employee.department}) informou que vai faltar no dia ${formatDate(date)}.
Turnos afetados: ${schedResult.rows.map(s => `${s.start_time}-${s.end_time} (${s.task || 'sem tarefa'})`).join(', ')}
Funcion\u00e1rios dispon\u00edveis para substitui\u00e7\u00e3o: ${availableNames || 'Nenhum dispon\u00edvel'}
Sugira a melhor reorganiza\u00e7\u00e3o.
`;

  const aiSuggestion = await openaiService.getScheduleSuggestion(aiContext);

  await db.query(
    `INSERT INTO schedule_ai_logs (request_text, ai_response) VALUES ($1, $2)`,
    [`Falta reportada - ${employee.name} em ${date}`, aiSuggestion]
  );

  return { employee, aiSuggestion, availableEmployees: availableResult.rows };
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR');
}

module.exports = {
  createSchedule,
  confirmSchedule,
  requestSwap,
  handleAbsence,
};
