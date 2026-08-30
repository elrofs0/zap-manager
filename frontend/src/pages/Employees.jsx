import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Pencil, Trash2, RefreshCw, Bike, MapPin } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';

const MOTOBOY_STATUS = {
  available: { label: 'Disponível', cls: 'bg-green-100 text-green-800' },
  busy: { label: 'Ocupado', cls: 'bg-orange-100 text-orange-800' },
  offline: { label: 'Offline', cls: 'bg-gray-100 text-gray-600' },
};

export default function Employees() {
  const [activeTab, setActiveTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [motoboys, setMotoboys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, motoRes] = await Promise.all([
        api.get('/employees'),
        api.get('/motoboys'),
      ]);
      setEmployees(Array.isArray(empRes.data) ? empRes.data : empRes.data.employees || []);
      setMotoboys(Array.isArray(motoRes.data) ? motoRes.data : motoRes.data.motoboys || []);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (type, id) => {
    if (!confirm('Tem certeza que deseja excluir?')) return;
    try {
      await api.delete(`/${type}/${id}`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir');
    }
  };

  const openEdit = (item) => {
    setEditItem(item);
    setShowModal(true);
  };

  const openCreate = () => {
    setEditItem(null);
    setShowModal(true);
  };

  const tabs = [
    { key: 'employees', label: 'Funcionários', icon: Users },
    { key: 'motoboys', label: 'Motoboys', icon: Bike },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Equipe</h1>
          <p className="text-gray-500 text-sm mt-1">
            {employees.length} funcionários, {motoboys.length} motoboys
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={16} /> Atualizar
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Adicionar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-whatsapp-500 text-whatsapp-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-5 h-5 border-2 border-whatsapp-500 border-t-transparent rounded-full animate-spin" />
              Carregando...
            </div>
          </div>
        ) : activeTab === 'employees' ? (
          <EmployeesTable
            data={employees}
            onEdit={openEdit}
            onDelete={(id) => handleDelete('employees', id)}
          />
        ) : (
          <MotoboysTable
            data={motoboys}
            onEdit={openEdit}
            onDelete={(id) => handleDelete('motoboys', id)}
          />
        )}
      </div>

      {/* Create/Edit Modal */}
      <PersonModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditItem(null);
        }}
        onSaved={() => {
          setShowModal(false);
          setEditItem(null);
          loadData();
        }}
        type={activeTab}
        editItem={editItem}
      />
    </div>
  );
}

function EmployeesTable({ data, onEdit, onDelete }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Users size={48} className="mx-auto mb-3 opacity-50" />
        <p>Nenhum funcionário cadastrado</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
            <th className="px-4 py-3 font-medium">Nome</th>
            <th className="px-4 py-3 font-medium">WhatsApp</th>
            <th className="px-4 py-3 font-medium">Cargo</th>
            <th className="px-4 py-3 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((emp) => (
            <tr key={emp.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-700">{emp.name}</td>
              <td className="px-4 py-3 text-gray-600">{emp.whatsapp || '-'}</td>
              <td className="px-4 py-3 text-gray-600">{emp.role || emp.cargo || '-'}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEdit(emp)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(emp.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MotoboysTable({ data, onEdit, onDelete }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Bike size={48} className="mx-auto mb-3 opacity-50" />
        <p>Nenhum motoboy cadastrado</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
            <th className="px-4 py-3 font-medium">Nome</th>
            <th className="px-4 py-3 font-medium">WhatsApp</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Última Localização</th>
            <th className="px-4 py-3 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((m) => {
            const statusInfo = MOTOBOY_STATUS[m.status] || MOTOBOY_STATUS.offline;
            return (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-700">{m.name}</td>
                <td className="px-4 py-3 text-gray-600">{m.whatsapp || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${statusInfo.cls}`}>{statusInfo.label}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {m.last_lat && m.last_lng ? (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} />
                      {Number(m.last_lat).toFixed(4)}, {Number(m.last_lng).toFixed(4)}
                    </span>
                  ) : (
                    'Sem localização'
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(m)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(m.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PersonModal({ isOpen, onClose, onSaved, type, editItem }) {
  const isEmployee = type === 'employees';
  const isEditing = Boolean(editItem);

  const [form, setForm] = useState({ name: '', whatsapp: '', role: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editItem) {
      setForm({
        name: editItem.name || '',
        whatsapp: editItem.whatsapp || '',
        role: editItem.role || editItem.cargo || '',
      });
    } else {
      setForm({ name: '', whatsapp: '', role: '' });
    }
    setError('');
  }, [editItem, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const endpoint = isEmployee ? '/employees' : '/motoboys';
      const payload = {
        name: form.name,
        whatsapp: form.whatsapp,
      };
      if (isEmployee) {
        payload.role = form.role;
      }

      if (isEditing) {
        await api.put(`${endpoint}/${editItem.id}`, payload);
      } else {
        await api.post(endpoint, payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const title = isEditing
    ? `Editar ${isEmployee ? 'Funcionário' : 'Motoboy'}`
    : `Adicionar ${isEmployee ? 'Funcionário' : 'Motoboy'}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
          <input
            type="text"
            className="input-field"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nome completo"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp *</label>
          <input
            type="text"
            className="input-field"
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            placeholder="5511999990000"
            required
          />
        </div>
        {isEmployee && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
            <input
              type="text"
              className="input-field"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              placeholder="Ex: Cozinheiro, Atendente, Gerente..."
            />
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Salvando...' : isEditing ? 'Atualizar' : 'Adicionar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
