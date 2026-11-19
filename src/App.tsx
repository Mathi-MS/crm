import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import AppLayout from './components/AppLayout'
import Home from './pages/Home'
import Users from './pages/Users'
import Leads from './pages/Leads'
import Connections from './pages/Connections'
import Kanban from './pages/Kanban'
import Roles from './pages/Roles'
import NewLead from './pages/NewLead'
import { isAdmin, useMe } from './auth'
import Settings from './pages/Settings'

function RequireAuth({ children }: { children: React.ReactElement }) {
  useMe() // re-check when the user logs out
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />
}

function RequireAdmin({ children }: { children: React.ReactElement }) {
  const me = useMe()
  if (!localStorage.getItem('token')) return <Navigate to="/login" replace />
  return isAdmin(me) ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Home />} />
          <Route path="users" element={<RequireAdmin><Users /></RequireAdmin>} />
          <Route path="leads" element={<Leads />} />
          <Route path="leads/new" element={<NewLead />} />
          <Route path="kanban" element={<Kanban />} />
          <Route path="roles" element={<RequireAdmin><Roles /></RequireAdmin>} />
          <Route path="masters" element={<Navigate to="/roles" replace />} />
          <Route path="connections" element={<RequireAdmin><Connections /></RequireAdmin>} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
