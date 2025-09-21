import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Preferences.css';

const Preferences = ({ user, onLogout }) => {
  const [preferences, setPreferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  const getAuthHeaders = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  });

  const fetchPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/preferences`, getAuthHeaders());
      setPreferences(response.data);
    } catch (error) {
      setError('Failed to load preferences');
      console.error('Error fetching preferences:', error);
    }
    setLoading(false);
  }, [API_URL]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const getScoreColor = (score) => {
    if (score >= 3) return '#4CAF50'; // Green for high preference
    if (score >= 2) return '#FFC107'; // Yellow for medium preference
    return '#FF5722'; // Red for low preference
  };

  const getPreferenceLevel = (score) => {
    if (score >= 4) return 'Very High';
    if (score >= 3) return 'High';
    if (score >= 2) return 'Medium';
    if (score >= 1.5) return 'Low';
    return 'Very Low';
  };

  if (loading) {
    return (
      <div className="preferences-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading preferences...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="preferences-container">
        <div className="error-container">
          <p>{error}</p>
          <button onClick={fetchPreferences} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="preferences-container">
      <header className="preferences-header">
        <Link to="/" className="back-link">← Back to Videos</Link>
        <h1>Your Preferences</h1>
        <button onClick={onLogout} className="logout-button">
          Logout
        </button>
      </header>

      <div className="preferences-content">
        <div className="user-info">
          <h2>Welcome, {user.email}</h2>
          <p>Your algorithm learns from your interactions. Here's what you like:</p>
        </div>

        <div className="preferences-grid">
          {preferences.map((pref) => (
            <div key={pref.category} className="preference-card">
              <div className="preference-header">
                <h3>{pref.category}</h3>
                <span 
                  className="preference-level"
                  style={{ color: getScoreColor(pref.score) }}
                >
                  {getPreferenceLevel(pref.score)}
                </span>
              </div>
              
              <div className="preference-score">
                <div className="score-bar">
                  <div 
                    className="score-fill"
                    style={{ 
                      width: `${Math.min(100, (pref.score / 5) * 100)}%`,
                      backgroundColor: getScoreColor(pref.score)
                    }}
                  ></div>
                </div>
                <span className="score-value">{pref.score.toFixed(1)} points</span>
              </div>
              
              <div className="preference-description">
                {pref.score >= 3 && "You love this category! 🔥"}
                {pref.score >= 2 && pref.score < 3 && "You enjoy this content 👍"}
                {pref.score >= 1.5 && pref.score < 2 && "Mixed feelings about this 🤷‍♂️"}
                {pref.score < 1.5 && "Not your favorite content 👎"}
              </div>
            </div>
          ))}
        </div>

        <div className="algorithm-info">
          <h3>How the Algorithm Works</h3>
          <div className="algorithm-explanation">
            <div className="interaction-guide">
              <div className="interaction-item">
                <span className="interaction-icon">👍</span>
                <span className="interaction-text">Like (Thumbs Up): +1 point</span>
              </div>
              <div className="interaction-item">
                <span className="interaction-icon">📱</span>
                <span className="interaction-text">Scroll Down: +0.5 points</span>
              </div>
              <div className="interaction-item">
                <span className="interaction-icon">✕</span>
                <span className="interaction-text">Dislike (X Button): -1 point</span>
              </div>
              <div className="interaction-item">
                <span className="interaction-icon">👈</span>
                <span className="interaction-text">Swipe Left: -2 points</span>
              </div>
            </div>
            <p>
              Categories with higher scores appear more frequently in your feed. 
              The algorithm ensures you see content weighted by your preferences!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Preferences;
