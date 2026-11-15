import { Routes, Route, Navigate } from 'react-router-dom'
import Marketing from './marketing/Marketing.jsx'
import AppRoot from './app/AppRoot.jsx'
import AdminRoot from './admin/AdminRoot.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Marketing />} />
      <Route path="/app/*" element={<AppRoot />} />
      <Route path="/admin/*" element={<AdminRoot />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
