import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AddProxy from "./pages/AddProxy";
import AddTrainingChannel from "./pages/AddTrainingChannel.jsx";
import ProxyList from "./pages/ProxyList.jsx";
import AddTelegramAccount from "./pages/AddTelegramAccount";
import ChannelsList from "./pages/ChannelsList.jsx";
import IntermediateChannels from "./pages/IntermediateChannels.jsx";
import Layout from "./components/Layout.jsx";
import InviteUsers from "./pages/InviteUsers.jsx";
import TelegramAuth from "./pages/TelegramAuth.jsx";
import Broadcast from "./pages/Broadcast.jsx";
import ForwardingGroups from "./pages/ForwardingGroups.jsx";
import CreateForwardingTask from "./pages/CreateForwardingTask.jsx";
import ForwardingTasks from "./pages/ForwardingTasks.jsx";
import "bootstrap/dist/css/bootstrap.min.css";
import ProcessedUsers from "./pages/ProcessedUsers.jsx";
import TelegramProfileSettings from "./pages/TelegramProfileSettings.jsx";

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
          path="/invite-users"
          element={
            <Layout>
              <InviteUsers />
            </Layout>
          }
        />
        <Route
          path="/telegram/auth"
          element={
            <Layout>
              <TelegramAuth />
            </Layout>
          }
        />
        <Route
          path="/broadcast"
          element={
            <Layout>
              <Broadcast />
            </Layout>
          }
        />
        <Route
          path="/forwarding/groups"
          element={
            <Layout>
              <ForwardingGroups />
            </Layout>
          }
        />
        <Route
          path="/forwarding/create-task"
          element={
            <Layout>
              <CreateForwardingTask />
            </Layout>
          }
        />
        <Route
          path="/forwarding/tasks"
          element={
            <Layout>
              <ForwardingTasks />
            </Layout>
          }
        />
        <Route
          path="/processed-users"
          element={
            <Layout>
              <ProcessedUsers />
            </Layout>
          }
        />
        <Route
          path="/accounts/profile"
          element={
            <Layout>
              <TelegramProfileSettings />
            </Layout>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
