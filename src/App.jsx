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
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      triggerToast('請填寫完整 URL 與 Anon Key', 'warning');
      return;
    }

    try {
      localStorage.setItem('supabase_settings', JSON.stringify({
        url: supabaseUrl.trim(),
        anonKey: supabaseKey.trim()
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
              ⚙️ Supabase 資料庫連線配置
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              在此貼上您的 Supabase 連線憑證。系統將自動存取您指定的架構 <strong>`judicial_exam`</strong>。如果資料表為空，系統會自動匯入初始科目與論點。
            </p>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">🌐 Supabase URL</label>
                <input 
                  type="text" 
                  className="search-input"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                  placeholder="https://xxxxxx.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  required
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
                  required
                />
              </div>

              <div style={{ padding: '10px', background: 'rgba(229,178,56,0.05)', border: '1px solid rgba(229,178,56,0.15)', borderRadius: '8px', fontSize: '11px', color: 'var(--accent-gold)' }}>
                ⚠️ <strong>注意</strong>：請確認您已在 Supabase 後台 API 設定中，將 <strong>`judicial_exam`</strong> schema 加入 <strong>Exposed schemas</strong> 名單中。
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
