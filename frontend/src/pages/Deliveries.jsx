import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, Plus, Search, Filter, RefreshCw, Eye,
} from 'lucide-react';
import api from '../api/axios';
import { useSocket } from '../hooks/useSocket';
import Modal from '../components/Modal';
import { StatusBadge } from './Dashboard';

export default function Deliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const { on } = useSocket();

  const loadDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/deliveries', { params });
      setDeliveries(res.data.deliveries || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Error loading deliveries:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { loadDeliveries(); }, [loadDeliveries]);

  useEffect(() => {
    const unsub = on('delivery_update', () => loadDeliveries());
    return unsub;
  }, [on, loadDeliveries]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Entregas</h1>
          <p className="text-gray-500 text-sm mt-1">{total} entregas no total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadDeliveries} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={16} /> Atualizar
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nova Entrega
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <Filter size={16} className="text-gray-400" />
          <span className="text-sm text-gray-500">Filtrar por status:</span>
          {['', 'pending', 'assigned', 'accepted', 'in_transit', 'delivered', 'cancelled'].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                statusFilter === s
                  ? 'bg-whatsapp-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === '' ? 'Todas' : s === 'pending' ? 'Pendente' : s === 'assigned' ? 'Atribuída' : s === 'accepted' ? 'Aceita' : s === 'in_transit' ? 'Em Trânsito' : s === 'delivered' ? 'Entregue' : 'Cancelada'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Rota</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Motoboy</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Modo</th>
                <th className="px-4 py-3 font-medium">Criado em</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <div className="w-5 h-5 border-2 border-whatsapp-500 border-t-transparent rounded-full animate-spin" />
                      Carregando...
                    </div>
                  </td>
                </tr>
              ) : deliveries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    Nenhuma entrega encontrada
                  </td>
                </tr>
              ) : (
                deliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{d.tracking_code}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">{d.route_description}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {d.customer_name || '-'}
                      {d.customer_whatsapp && (
                        <span className="block text-xs text-gray-400">{d.customer_whatsapp}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium">R$ {parseFloat(d.price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-600">{d.motoboy_name || '-'}</td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{d.assignment_mode === 'round_robin' ? 'Rodízio' : 'Mais Próximo'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(d.created_at).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setShowDetail(d)}
                        className="p-1.5 text-gray-400 hover:text-whatsapp-600 hover:bg-whatsapp-50 rounded-lg transition-colors"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateDeliveryModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); loadDeliveries(); }}
      />

      {/* Detail Modal */}
      {showDetail && (
        <DeliveryDetailModal
          delivery={showDetail}
          onClose={() => setShowDetail(null)}
          onUpdated={loadDeliveries}
        />
      )}
    </div>
  );
}

function CreateDeliveryModal({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState({
    customer_name: '',
    customer_whatsapp: '',
    route_description: '',
    price: '',
    assignment_mode: 'round_robin',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/deliveries', {
        ...form,
        price: parseFloat(form.price),
      });
      setForm({ customer_name: '', customer_whatsapp: '', route_description: '', price: '', assignment_mode: 'round_robin' });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar entrega');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Entrega" size="md">
      {error && <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Cliente</label>
          <input
            type="text"
            className="input-field"
            value={form.customer_name}
            onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            placeholder="João Silva"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp do Cliente</label>
          <input
            type="text"
            className="input-field"
            value={form.customer_whatsapp}
            onChange={(e) => setForm({ ...form, customer_whatsapp: e.target.value })}
            placeholder="5511999990000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição da Rota *</label>
          <textarea
            className="input-field"
            rows={3}
            value={form.route_description}
            onChange={(e) => setForm({ ...form, route_description: e.target.value })}
            placeholder="Rua das Flores, 123 para Av. Brasil, 456"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input-field"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="15.00"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modo de Atribuição</label>
            <select
              className="input-field"
              value={form.assignment_mode}
              onChange={(e) => setForm({ ...form, assignment_mode: e.target.value })}
            >
              <option value="round_robin">Rodízio</option>
              <option value="nearest">Mais Próximo</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Criando...' : 'Criar Entrega'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeliveryDetailModal({ delivery, onClose, onUpdated }) {
  const [updating, setUpdating] = useState(false);

  const updateStatus = async (status) => {
    setUpdating(true);
    try {
      await api.put(`/deliveries/${delivery.id}/status`, { status });
      onUpdated();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao atualizar status');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Entrega ${delivery.tracking_code}`} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Código</p>
            <p className="font-mono text-sm">{delivery.tracking_code}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Status</p>
            <StatusBadge status={delivery.status} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Cliente</p>
            <p className="text-sm">{delivery.customer_name || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">WhatsApp</p>
            <p className="text-sm">{delivery.customer_whatsapp || '-'}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-gray-500">Rota</p>
            <p className="text-sm">{delivery.route_description}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Valor</p>
            <p className="text-sm font-medium">R$ {parseFloat(delivery.price).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Motoboy</p>
            <p className="text-sm">{delivery.motoboy_name || 'Não atribuído'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Criado em</p>
            <p className="text-sm">{new Date(delivery.created_at).toLocaleString('pt-BR')}</p>
          </div>
          {delivery.delivered_at && (
            <div>
              <p className="text-xs text-gray-500">Entregue em</p>
              <p className="text-sm">{new Date(delivery.delivered_at).toLocaleString('pt-BR')}</p>
            </div>
          )}
        </div>

        {/* Status actions */}
        {!['delivered', 'cancelled'].includes(delivery.status) && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Alterar Status:</p>
            <div className="flex flex-wrap gap-2">
              {delivery.status !== 'delivered' && (
                <button
                  onClick={() => updateStatus('delivered')}
                  disabled={updating}
                  className="btn-primary text-sm"
                >
                  ✅ Marcar como Entregue
                </button>
              )}
              <button
                onClick={() => updateStatus('cancelled')}
                disabled={updating}
                className="btn-danger text-sm"
              >
                ❌ Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
