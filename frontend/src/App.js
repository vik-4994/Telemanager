import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AddProxy from './pages/AddProxy';
import AddTrainingChannel from './pages/AddTrainingChannel.jsx';
import ProxyList from './pages/ProxyList.jsx';
import AddTelegramAccount from './pages/AddTelegramAccount';
import ChannelsList from './pages/ChannelsList.jsx';
import IntermediateChannels from './pages/IntermediateChannels.jsx';
import Layout from './components/Layout.jsx';
import InviteUsers from './pages/InviteUsers.jsx';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

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
          path="/proxies"
          element={
            <Layout>
              <ProxyList />
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
        <Route
          path="/add-training-channel"
          element={
            <Layout>
              <AddTrainingChannel />
            </Layout>
          }
        />
        <Route
          path="/channels"
          element={
            <Layout>
              <ChannelsList />
            </Layout>
          }
        />
        <Route 
          path="/ichannels"
          element={
            <Layout>
              <IntermediateChannels />
            </Layout>
          }
        />
        <Route 
          path='/invite-users'
          element={
            <Layout>
              <InviteUsers/>
            </Layout>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
