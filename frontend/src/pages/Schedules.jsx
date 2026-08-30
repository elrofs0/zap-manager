import React, { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Plus, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../api/axios';
import { useSocket } from '../hooks/useSocket';
import Modal from '../components/Modal';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  confirmed: 'bg-green-100 border-green-300 text-green-800',
  swap_requested: 'bg-orange-100 border-orange-300 text-orange-800',
  absent: 'bg-red-100 border-red-300 text-red-800',
};

const STATUS_LABELS = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  swap_requested: 'Troca Solicitada',
  absent: 'Ausente',
};

export default function Schedules() {
  const [schedules, setSchedules] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const { on } = useSocket();

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const weekEnd = addDays(currentWeekStart, 6);
      const [schedRes, empRes] = await Promise.all([
        api.get('/schedules', {
          params: {
            start_date: format(currentWeekStart, 'yyyy-MM-dd'),
            end_date: format(weekEnd, 'yyyy-MM-dd'),
          },
        }),
        api.get('/employees'),
      ]);
      setSchedules(Array.isArray(schedRes.data) ? schedRes.data : schedRes.data.schedules || []);
      setEmployees(Array.isArray(empRes.data) ? empRes.data : empRes.data.employees || []);
    } catch (err) {
      console.error('Erro ao carregar escalas:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWeekStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unsub = on('schedule:update', () => loadData());
    return unsub;
  }, [on, loadData]);

  const getShiftsForEmployeeDay = (employeeId, day) => {
    return schedules.filter((s) => {
      const schedDate = typeof s.date === 'string' ? parseISO(s.date) : new Date(s.date);
      return s.employee_id === employeeId && isSameDay(schedDate, day);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Escalas</h1>
          <p className="text-gray-500 text-sm mt-1">Gerenciamento semanal de turnos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={16} /> Atualizar
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nova Escala
          </button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="card">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <div className="text-center">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2 justify-center">
              <CalendarDays size={18} className="text-whatsapp-500" />
              Semana de {format(currentWeekStart, "dd 'de' MMMM", { locale: ptBR })} a{' '}
              {format(addDays(currentWeekStart, 6), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </h2>
          </div>
          <button
            onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={20} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-5 h-5 border-2 border-whatsapp-500 border-t-transparent rounded-full animate-spin" />
              Carregando...
            </div>
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CalendarDays size={48} className="mx-auto mb-3 opacity-50" />
            <p>Nenhum funcionário cadastrado</p>
            <p className="text-sm mt-1">Cadastre funcionários na aba Funcionários</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 sticky left-0 bg-gray-50 min-w-[160px]">
                    Funcionário
                  </th>
                  {weekDays.map((day) => (
                    <th
                      key={day.toISOString()}
                      className={`px-3 py-3 text-center font-medium min-w-[130px] ${
                        isSameDay(day, new Date())
                          ? 'text-whatsapp-600 bg-whatsapp-50'
                          : 'text-gray-500'
                      }`}
                    >
                      <div>{format(day, 'EEE', { locale: ptBR })}</div>
                      <div className="text-xs">{format(day, 'dd/MM')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 sticky left-0 bg-white border-r border-gray-50">
                      <p className="font-medium text-gray-700">{emp.name}</p>
                      <p className="text-xs text-gray-400">{emp.role || emp.cargo || 'Funcionário'}</p>
                    </td>
                    {weekDays.map((day) => {
                      const shifts = getShiftsForEmployeeDay(emp.id, day);
                      return (
                        <td
                          key={day.toISOString()}
                          className={`px-2 py-2 text-center align-top ${
                            isSameDay(day, new Date()) ? 'bg-whatsapp-50/30' : ''
                          }`}
                        >
                          {shifts.length > 0 ? (
                            <div className="space-y-1">
                              {shifts.map((shift) => (
                                <div
                                  key={shift.id}
                                  className={`px-2 py-1.5 rounded-lg border text-xs ${
                                    STATUS_COLORS[shift.status] || STATUS_COLORS.pending
                                  }`}
                                >
                                  <div className="font-medium">
                                    {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}
                                  </div>
                                  {shift.task && (
                                    <div className="mt-0.5 opacity-80 truncate" title={shift.task}>
                                      {shift.task}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-200">&mdash;</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="card">
        <p className="text-sm font-medium text-gray-600 mb-3">Legenda:</p>
        <div className="flex flex-wrap gap-4">
          {Object.entries(STATUS_COLORS).map(([status, cls]) => (
            <div key={status} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded border ${cls}`} />
              <span className="text-sm text-gray-600">{STATUS_LABELS[status]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      <CreateScheduleModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          loadData();
        }}
        employees={employees}
      />
    </div>
  );
}

function CreateScheduleModal({ isOpen, onClose, onCreated, employees }) {
  const [form, setForm] = useState({
    employee_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '08:00',
    end_time: '17:00',
    task: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employee_id) {
      setError('Selecione um funcionário');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/schedules', {
        employee_id: parseInt(form.employee_id, 10),
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        task: form.task || null,
      });
      setForm({
        employee_id: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '08:00',
        end_time: '17:00',
        task: '',
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar escala');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Escala" size="md">
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário *</label>
          <select
            className="input-field"
            value={form.employee_id}
            onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
            required
          >
            <option value="">Selecione um funcionário</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} &mdash; {emp.role || emp.cargo || 'Funcionário'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
          <input
            type="date"
            className="input-field"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Início *</label>
            <input
              type="time"
              className="input-field"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Término *</label>
            <input
              type="time"
              className="input-field"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tarefa</label>
          <input
            type="text"
            className="input-field"
            value={form.task}
            onChange={(e) => setForm({ ...form, task: e.target.value })}
            placeholder="Ex: Cozinha, Atendimento, Entrega..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Criando...' : 'Criar Escala'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
