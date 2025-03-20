import './App.css';
import Login from './pages/login';
import TradingLandingPage from './pages/landingpage';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/home';
import PrivateRoute from './components/PrivateRoute';

function App() {
    

    return (
        <>
    <Routes>
      <Route path="/" element={<TradingLandingPage />} />
      <Route path="/auth" element={<Login />} />
      {/* Protected Routes */}
      <Route element={<PrivateRoute />}>
        <Route path="/home" element={<Home />} />
      </Route>
    </Routes>
        </>
             
    );
}

export default App;
