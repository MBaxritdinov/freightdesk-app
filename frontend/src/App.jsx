import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Loads from './pages/Loads'
import LoadDetail from './pages/LoadDetail'
import Brokers from './pages/Brokers'
import Drivers from './pages/Drivers'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Users from './pages/Users'
import { getToken } from './auth'

function ProtectedRoute({ children }) {
  const token = getToken()
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/loads"
          element={
            <ProtectedRoute>
              <Loads />
            </ProtectedRoute>
          }
        />
        <Route
          path="/loads/:id"
          element={
            <ProtectedRoute>
              <LoadDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/drivers"
          element={
            <ProtectedRoute>
              <Drivers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/brokers"
          element={
            <ProtectedRoute>
              <Brokers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
