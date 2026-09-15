import { Navigate, Route, Routes } from 'react-router-dom'
import EcranAccueil from './config/EcranAccueil'
import EcranTri from './tri/EcranTri'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<EcranAccueil />} />
      <Route path="/tri" element={<EcranTri />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
