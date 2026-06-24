import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Rooms from './pages/Rooms'
import Tenants from './pages/Tenants'
import TenantProfile from './pages/TenantProfile'
import Payments from './pages/Payments'
import Reports from './pages/Reports'

const PrivateRoute = ({ children }) => {
  return localStorage.getItem('token') ? children : <Navigate to="/login" />
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login"          element={<Login />} />
        <Route path="/register"       element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index                        element={<Dashboard />} />
          <Route path="rooms"                 element={<Rooms />} />
          <Route path="tenants"               element={<Tenants />} />
          <Route path="tenants/:id"           element={<TenantProfile />} />
          <Route path="payments"              element={<Payments />} />
          <Route path="reports"               element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
