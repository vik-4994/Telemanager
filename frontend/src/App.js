import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AddProxy from './pages/AddProxy';
import AddTelegramAccount from './pages/AddTelegramAccount';
import Layout from './components/Layout.jsx';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Всё, что с сайдбаром — в Layout */}
        <Route
          path="/"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />
        <Route
          path="/account/add"
          element={
            <Layout>
              <AddTelegramAccount />
            </Layout>
          }
        />
        <Route
          path="/proxy/add"
          element={
            <Layout>
              <AddProxy />
            </Layout>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
