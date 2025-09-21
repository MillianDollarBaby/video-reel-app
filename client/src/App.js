import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './components/Login';
import Register from './components/Register';
import VideoFeed from './components/VideoFeed';
import Preferences from './components/Preferences';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/login" 
            element={
              user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />
            } 
          />
          <Route 
            path="/register" 
            element={
              user ? <Navigate to="/" /> : <Register onLogin={handleLogin} />
            } 
          />
          <Route 
            path="/preferences" 
            element={
              user ? <Preferences user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            } 
          />
          <Route 
            path="/" 
            element={
              user ? <VideoFeed user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
