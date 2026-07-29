import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import BookingPage from './pages/BookingPage';
import BookDateTime from './pages/BookDateTime';
import SelectPandit from './pages/SelectPandit';
import BookAddress from './pages/BookAddress';
import BookPayment from './pages/BookPayment';
import BookingConfirmation from './pages/BookingConfirmation';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import PanditPage from './pages/PanditPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Layout from './components/Layout';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/book" element={<BookingPage />} />
        <Route path="/book/datetime" element={<BookDateTime />} />
        <Route path="/book/select-pandit" element={<SelectPandit />} />
        <Route path="/book/address" element={<BookAddress />} />
        <Route path="/book/payment" element={<BookPayment />} />
        <Route path="/book/confirmation" element={<BookingConfirmation />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/pandit" element={<PanditPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
