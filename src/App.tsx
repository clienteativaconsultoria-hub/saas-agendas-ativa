import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { Schedule } from './pages/Schedule';
import { Config } from './pages/Config';
import { Consultants } from './pages/Consultants';
import { Projects } from './pages/Projects';
import { Reports } from './pages/Reports';
import { Requests } from './pages/Requests';
import { Layout } from './components/Layout';

function App() {
  return (
    <Router>
      <Routes>
        <Route path='/login' element={<Login />} />
        
        <Route element={<Layout />}>
          <Route path='/dashboard' element={<Dashboard />} />
          <Route path='/schedule' element={<Schedule />} />
          <Route path='/consultants' element={<Consultants />} />
          <Route path='/projects' element={<Projects />} />
          <Route path='/reports' element={<Reports />} />
          <Route path='/requests' element={<Requests />} />
          <Route path='/config' element={<Config />} />
        </Route>

        <Route path='/' element={<Home />} />
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </Router>
  );
}


export default App;
