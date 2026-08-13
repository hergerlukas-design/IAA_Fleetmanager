import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/contexts/useAuth'
import Login from '@/pages/Login'
import Fleets from '@/pages/Fleets'
import FleetDetail from '@/pages/FleetDetail'
import Vehicles from '@/pages/Vehicles'
import VehicleCard from '@/pages/VehicleCard'
import Trailers from '@/pages/Trailers'
import TrailerCard from '@/pages/TrailerCard'
import Gespanne from '@/pages/Gespanne'
import Settings from '@/pages/Settings'
import DuplicateScan from '@/pages/DuplicateScan'
import Impressum from '@/pages/Impressum'
import Datenschutz from '@/pages/Datenschutz'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isUser } = useAuth()
  return isUser ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminBorder() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return null
  return <div className="fixed inset-0 pointer-events-none z-[9999] border-[3px] border-red-500" />
}

export default function App() {
  return (
    <>
      <AdminBorder />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Navigate to="/fleets" replace /></ProtectedRoute>} />
        <Route path="/fleets"       element={<ProtectedRoute><Fleets /></ProtectedRoute>} />
        <Route path="/fleet/:id"    element={<ProtectedRoute><FleetDetail /></ProtectedRoute>} />
        <Route path="/vehicles"     element={<ProtectedRoute><Vehicles /></ProtectedRoute>} />
        <Route path="/vehicle/:id"  element={<ProtectedRoute><VehicleCard /></ProtectedRoute>} />
        <Route path="/trailers"     element={<ProtectedRoute><Trailers /></ProtectedRoute>} />
        <Route path="/trailer/:id"  element={<ProtectedRoute><TrailerCard /></ProtectedRoute>} />
        <Route path="/gespanne"     element={<ProtectedRoute><Gespanne /></ProtectedRoute>} />
        <Route path="/settings"     element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/admin/duplicates" element={<ProtectedRoute><DuplicateScan /></ProtectedRoute>} />
        <Route path="/impressum"    element={<Impressum />} />
        <Route path="/datenschutz"  element={<Datenschutz />} />
        <Route path="*"             element={<Navigate to="/fleets" replace />} />
      </Routes>
    </>
  )
}
