import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Package,
  Truck,
  Users,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  MapPin,
} from 'lucide-react';
import api from '../api/axios';
import { useSocket } from '../hooks/useSocket';

// Fix default Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const motoboyIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const deliveryIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-800',
    assigned: 'bg-blue-100 text-blue-800',
    accepted: 'bg-indigo-100 text-indigo-800',
    in_transit: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    refused: 'bg-gray-100 text-gray-800',
  };
  const labels = {
    pending: 'Pendente',
    assigned: 'Atribuída',
    accepted: 'Aceita',
    in_transit: 'Em Trânsito',
    delivered: 'Entregue',
    cancelled: 'Cancelada',
    refused: 'Recusada',
  };
  return (
    <span className={`badge ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  );
}

function MotoboyStatusBadge({ status }) {
  const styles = {
    available: 'bg-green-100 text-green-800',
    busy: 'bg-orange-100 text-orange-800',
    offline: 'bg-gray-100 text-gray-600',
  };
  const labels = {
    available: 'Disponível',
    busy: 'Ocupado',
    offline: 'Offline',
  };
  return (
    <span className={`badge ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  );
}

function MapAutoFit({ markers }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [markers, map]);
  return null;
}

export default function Dashboard() {
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [motoboys, setMotoboys] = useState([]);
  const [recentDeliveries, setRecentDeliveries] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, available: 0 });
  const { on } = useSocket();

  const loadData = useCallback(async () => {
    try {
      const [activeRes, motoboyRes, deliveriesRes] = await Promise.all([
        api.get('/deliveries/active'),
        api.get('/motoboys'),
        api.get('/deliveries?limit=10'),
      ]);

      setActiveDeliveries(activeRes.data);
      setMotoboys(motoboyRes.data);
      setRecentDeliveries(deliveriesRes.data.deliveries || []);

      const allDeliveries = deliveriesRes.data;
      const todayDeliveries = (allDeliveries.deliveries || []).filter((d) => {
        const created = new Date(d.created_at);
        const today = new Date();
        return created.toDateString() === today.toDateString();
      });

      setStats({
        total: todayDeliveries.length,
        active: activeRes.data.length,
        available: motoboyRes.data.filter((m) => m.status === 'available').length,
      });
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    const unsub1 = on('delivery_update', () => loadData());
    const unsub2 = on('delivery_location_update', (data) => {
      setActiveDeliveries((prev) =>
        prev.map((d) =>
          d.tracking_code === data.trackingCode
            ? { ...d, last_lat: data.lat, last_lng: data.lng }
            : d
        )
      );
      setMotoboys((prev) =>
        prev.map((m) =>
          m.whatsapp === data.motoboyWhatsapp
            ? { ...m, last_lat: data.lat, last_lng: data.lng }
            : m
        )
      );
    });
    const unsub3 = on('motoboy_location', () => loadData());
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [on, loadData]);

  const mapMarkers = [
    ...motoboys
      .filter((m) => m.last_lat && m.last_lng)
      .map((m) => ({ lat: m.last_lat, lng: m.last_lng, type: 'motoboy', data: m })),
    ...activeDeliveries
      .filter((d) => d.last_lat && d.last_lng)
      .map((d) => ({ lat: d.last_lat, lng: d.last_lng, type: 'delivery', data: d })),
  ];

  const defaultCenter = [-23.5505, -46.6333]; // São Paulo

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Visão geral das operações em tempo real</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-xl">
            <Package size={24} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            <p className="text-sm text-gray-500">Entregas Hoje</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-purple-100 rounded-xl">
            <Truck size={24} className="text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{stats.active}</p>
            <p className="text-sm text-gray-500">Entregas Ativas</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-xl">
            <Users size={24} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{stats.available}</p>
            <p className="text-sm text-gray-500">Motoboys Disponíveis</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-orange-100 rounded-xl">
            <Activity size={24} className="text-orange-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{motoboys.length}</p>
            <p className="text-sm text-gray-500">Motoboys Total</p>
          </div>
        </div>
      </div>

      {/* Map + Motoboys */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Map */}
        <div className="xl:col-span-2 card p-0 overflow-hidden" style={{ minHeight: 400 }}>
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <MapPin size={18} className="text-whatsapp-500" />
              Mapa de Entregas
            </h2>
          </div>
          <MapContainer
            center={defaultCenter}
            zoom={12}
            style={{ height: 400, width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mapMarkers.length > 0 && <MapAutoFit markers={mapMarkers} />}
            {motoboys
              .filter((m) => m.last_lat && m.last_lng)
              .map((m) => (
                <Marker key={`m-${m.id}`} position={[m.last_lat, m.last_lng]} icon={motoboyIcon}>
                  <Popup>
                    <strong>🏍️ {m.name}</strong>
                    <br />
                    <MotoboyStatusBadge status={m.status} />
                  </Popup>
                </Marker>
              ))}
            {activeDeliveries
              .filter((d) => d.last_lat && d.last_lng)
              .map((d) => (
                <Marker key={`d-${d.id}`} position={[d.last_lat, d.last_lng]} icon={deliveryIcon}>
                  <Popup>
                    <strong>📦 {d.tracking_code}</strong>
                    <br />
                    {d.route_description}
                    <br />
                    <StatusBadge status={d.status} />
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>

        {/* Motoboy cards */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users size={18} className="text-whatsapp-500" />
            Motoboys
          </h2>
          <div className="space-y-3 max-h-[380px] overflow-y-auto">
            {motoboys.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum motoboy cadastrado</p>
            )}
            {motoboys.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      m.status === 'available'
                        ? 'bg-green-500'
                        : m.status === 'busy'
                        ? 'bg-orange-500'
                        : 'bg-gray-400'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{m.name}</p>
                    <p className="text-xs text-gray-400">{m.whatsapp}</p>
                  </div>
                </div>
                <MotoboyStatusBadge status={m.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Deliveries */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Clock size={18} className="text-whatsapp-500" />
          Entregas Recentes
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="pb-3 font-medium">Código</th>
                <th className="pb-3 font-medium">Rota</th>
                <th className="pb-3 font-medium">Motoboy</th>
                <th className="pb-3 font-medium">Valor</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentDeliveries.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-8">
                    Nenhuma entrega registrada
                  </td>
                </tr>
              )}
              {recentDeliveries.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="py-3 font-mono text-xs text-gray-600">{d.tracking_code}</td>
                  <td className="py-3 text-gray-700 max-w-[200px] truncate">{d.route_description}</td>
                  <td className="py-3 text-gray-600">{d.motoboy_name || '-'}</td>
                  <td className="py-3 text-gray-700 font-medium">
                    R$ {parseFloat(d.price).toFixed(2)}
                  </td>
                  <td className="py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="py-3 text-gray-500 text-xs">
                    {new Date(d.created_at).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export { StatusBadge, MotoboyStatusBadge };
