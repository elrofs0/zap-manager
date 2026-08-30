import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Deliveries from './pages/Deliveries';
import Schedules from './pages/Schedules';
import Employees from './pages/Employees';
import AIAssistant from './pages/AIAssistant';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout><Dashboard /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/entregas"
            element={
              <ProtectedRoute>
                <Layout><Deliveries /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/escalas"
            element={
              <ProtectedRoute>
                <Layout><Schedules /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/funcionarios"
            element={
              <ProtectedRoute>
                <Layout><Employees /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/assistente"
            element={
              <ProtectedRoute>
                <Layout><AIAssistant /></Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
