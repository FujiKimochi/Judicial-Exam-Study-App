import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Studio from './components/Studio';
import { initDb } from './services/db';
import { isSupabaseConfigured } from './services/supabaseClient';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPointIdForStudio, setSelectedPointIdForStudio] = useState('');
  const [toasts, setToasts] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  // Initialize DB on App Mount
  useEffect(() => {
    initDb();
    setIsConnected(isSupabaseConfigured());
    
    // Load stored settings if any
    try {
      const stored = localStorage.getItem('supabase_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        setSupabaseUrl(parsed.url || '');
        setSupabaseKey(parsed.anonKey || '');
        setGeminiApiKey(parsed.geminiApiKey || '');
      }
    } catch(e) {}
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

  const handleSaveSettings = (e) => {
    e.preventDefault();

    try {
      localStorage.setItem('supabase_settings', JSON.stringify({
        url: supabaseUrl.trim(),
        anonKey: supabaseKey.trim(),
        geminiApiKey: geminiApiKey.trim()
      }));
      triggerToast('設定已儲存！即將重新載入...', 'success');
      setShowSettings(false);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e) {
      triggerToast('儲存設定失敗', 'warning');
    }
  };

  const handleClearSettings = () => {
    localStorage.removeItem('supabase_settings');
    triggerToast('設定已清除！回歸本地模式，即將重新載入...', 'success');
    setShowSettings(false);
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="glass-panel app-header">
        <div className="brand">
          <div className="brand-logo">司</div>
          <div>
            <h1 className="brand-name">司法預備演習筆記</h1>
            <span className="brand-tagline">
              Gemini AI 智能解析與論點管理 {isConnected ? '☁️ Cloud' : '💾 Local'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
          
          <button 
            className={`btn btn-secondary ${isConnected ? 'active-priority' : ''}`} 
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setShowSettings(true)}
            title="資料庫配置設定"
          >
            ⚙️ {isConnected ? '已連線' : '未連線'}
          </button>
        </div>
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

      {/* Settings Modal Dialog */}
      {showSettings && (
        <div className="lightbox" style={{ cursor: 'default' }}>
          <div className="glass-panel animate-fade-in" style={{ padding: '32px', maxWidth: '500px', width: '90%', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
            <h2 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'white' }}>
              ⚙️ 系統 API 與資料庫配置設定
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              請在此貼上您的連線金鑰。Gemini API Key 用於聯網與法律解析；Supabase 憑證則用於雲端備份與多圖儲存（若未填寫 Supabase 則自動儲存於本地）。
            </p>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
                <label className="form-label">🤖 Gemini API Key</label>
                <input 
                  type="password" 
                  className="search-input"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                  placeholder="AIzaSy... (若空白則使用模擬 AI 服務)"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  可在 Google AI Studio 免費申請此金鑰。
                </span>
              </div>

              <h4 style={{ color: 'white', fontSize: '14px', marginTop: '4px' }}>☁️ Supabase 雲端備份設定 (選填)</h4>

              <div className="form-group">
                <label className="form-label">🌐 Supabase URL</label>
                <input 
                  type="text" 
                  className="search-input"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                  placeholder="https://xxxxxx.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">🔑 Anon Public Key</label>
                <input 
                  type="password" 
                  className="search-input"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5c..."
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                />
              </div>

              <div style={{ padding: '10px', background: 'rgba(229,178,56,0.05)', border: '1px solid rgba(229,178,56,0.15)', borderRadius: '8px', fontSize: '11px', color: 'var(--accent-gold)' }}>
                ⚠️ <strong>注意</strong>：請確認您已在 Supabase 後台 API 設定中，將 <strong>`judicial_exam`</strong> schema 加入 <strong>Exposed schemas</strong> 名單，並設定好 <strong>`judicial-exam-assets`</strong> Storage Bucket。
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSettings(false)}>
                  取消
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {isConnected && (
                    <button type="button" className="btn btn-secondary delete-btn" onClick={handleClearSettings}>
                      清除連線
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary">
                    儲存並重新整理
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

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
