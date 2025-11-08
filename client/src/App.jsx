import { Navigate, Route, Routes } from 'react-router-dom';
import WorkflowsPage from './pages/WorkflowsPage.jsx';
import WorkflowDetailPage from './pages/WorkflowDetailPage.jsx';
import LoginCallbackPage from './pages/LoginCallbackPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import Layout from './components/Layout.jsx';

const App = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route path="/" element={<Navigate to="/workflows" replace />} />
      <Route path="/workflows" element={<WorkflowsPage />} />
      <Route path="/workflows/:workflowId" element={<WorkflowDetailPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Route>
    <Route path="/callback" element={<LoginCallbackPage />} />
  </Routes>
);

export default App;
