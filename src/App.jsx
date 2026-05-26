import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Studio from './components/Studio';
import { initDb } from './services/db';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPointIdForStudio, setSelectedPointIdForStudio] = useState('');
  const [toasts, setToasts] = useState([]);

  // Initialize DB on App Mount
  useEffect(() => {
    initDb();
  }, []);

  // Toast trigger helper
  const triggerToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-remove toast after 4s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleGoToStudio = (pointId = '') => {
    setSelectedPointIdForStudio(pointId);
    setActiveTab('studio');
  };

  const handleSaveSuccess = () => {
    setSelectedPointIdForStudio('');
    setActiveTab('dashboard');
  };

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="glass-panel app-header">
        <div className="brand">
          <div className="brand-logo">司</div>
          <div>
            <h1 className="brand-name">司法預備演習筆記</h1>
            <span className="brand-tagline">Gemini AI 智能解析與論點管理</span>
          </div>
        </div>

        <nav className="nav-tabs">
          <button 
            className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 儀表板 (Dashboard)
          </button>
          <button 
            className={`nav-btn ${activeTab === 'studio' ? 'active' : ''}`}
            onClick={() => handleGoToStudio('')}
          >
            🛠️ 工作台 (Studio)
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <div className="app-content">
        {activeTab === 'dashboard' ? (
          <Dashboard 
            onGoToStudio={handleGoToStudio} 
            triggerToast={triggerToast} 
          />
        ) : (
          <Studio 
            initialPointId={selectedPointIdForStudio} 
            onSaveSuccess={handleSaveSuccess}
            triggerToast={triggerToast}
          />
        )}
      </div>

      {/* Global Toast Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
