import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import Studio from './components/Studio';
import { initDb } from './services/db';
import { isSupabaseConfigured } from './services/supabaseClient';

// Curated fallback models (shown when no API key or fetch fails)
const DEFAULT_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPointIdForStudio, setSelectedPointIdForStudio] = useState('');
  const [toasts, setToasts] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [availableModels, setAvailableModels] = useState(DEFAULT_FALLBACK_MODELS);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState('');
  const [modelsFetched, setModelsFetched] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [aiConnected, setAiConnected] = useState(false);

  // Fetch available models from Gemini API
  const fetchAvailableModels = useCallback(async (apiKey) => {
    if (!apiKey || apiKey.trim().length < 10) {
      setModelFetchError('請先輸入有效的 API Key');
      return;
    }

    setIsLoadingModels(true);
    setModelFetchError('');

    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey.trim()
      );

      if (!res.ok) {
        const errData = await res.json().catch(function() { return {}; });
        var errMsg = (errData && errData.error && errData.error.message) 
          ? errData.error.message 
          : ('HTTP ' + res.status + ' ' + res.statusText);
        throw new Error(errMsg);
      }

      const data = await res.json();

      if (!data || !data.models || !Array.isArray(data.models)) {
        throw new Error('API 回應格式異常');
      }

      var filtered = data.models
        .filter(function(m) {
          return m.supportedGenerationMethods && 
                 m.supportedGenerationMethods.indexOf('generateContent') !== -1;
        })
        .map(function(m) {
          return m.name ? m.name.replace('models/', '') : '';
        })
        .filter(function(name) { return name.length > 0; });

      if (filtered.length > 0) {
        setAvailableModels(filtered);
        setModelsFetched(true);
        // If current model isn't in the new list, switch to first available
        if (filtered.indexOf(geminiModel) === -1) {
          setGeminiModel(filtered[0]);
        }
        setModelFetchError('');
      } else {
        setModelFetchError('未找到支援 generateContent 的模型，使用預設清單');
        setAvailableModels(DEFAULT_FALLBACK_MODELS);
      }
    } catch (e) {
      console.error('Failed to fetch models from Gemini API', e);
      setModelFetchError('取得模型失敗: ' + (e.message || '未知錯誤'));
      setAvailableModels(DEFAULT_FALLBACK_MODELS);
    } finally {
      setIsLoadingModels(false);
    }
  }, [geminiModel]);

  // Initialize DB and load stored settings on mount
  useEffect(function() {
    initDb();
    setDbConnected(isSupabaseConfigured());
    
    var hasGemini = false;
    try {
      var envKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (envKey) hasGemini = true;
    } catch(e) {}
    
    // Load stored settings
    try {
      var stored = localStorage.getItem('supabase_settings');
      if (stored) {
        var parsed = JSON.parse(stored);
        setSupabaseUrl(parsed.url || '');
        setSupabaseKey(parsed.anonKey || '');
        var storedKey = parsed.geminiApiKey || '';
        setGeminiApiKey(storedKey);
        setGeminiModel(parsed.geminiModel || 'gemini-2.5-flash');
        if (storedKey) {
          hasGemini = true;
          // Auto-fetch models on mount if key exists
          fetchAvailableModels(storedKey);
        }
      }
    } catch(e) {}
    
    setAiConnected(hasGemini);
  }, []);

  // Toast trigger helper
  const triggerToast = function(message, type) {
    type = type || 'success';
    var id = Date.now();
    setToasts(function(prev) { return prev.concat([{ id: id, message: message, type: type }]); });
    
    setTimeout(function() {
      setToasts(function(prev) { return prev.filter(function(t) { return t.id !== id; }); });
    }, 4000);
  };

  const handleGoToStudio = function(pointId) {
    pointId = pointId || '';
    setSelectedPointIdForStudio(pointId);
    setActiveTab('studio');
  };

  const handleSaveSuccess = function() {
    setSelectedPointIdForStudio('');
    setActiveTab('dashboard');
  };

  const handleSaveSettings = function(e) {
    e.preventDefault();

    try {
      localStorage.setItem('supabase_settings', JSON.stringify({
        url: supabaseUrl.trim(),
        anonKey: supabaseKey.trim(),
        geminiApiKey: geminiApiKey.trim(),
        geminiModel: geminiModel.trim() || 'gemini-2.5-flash'
      }));
      triggerToast('設定已儲存！即將重新載入...', 'success');
      setShowSettings(false);
      setTimeout(function() {
        window.location.reload();
      }, 1000);
    } catch (err) {
      triggerToast('儲存設定失敗', 'warning');
    }
  };

  const handleClearSettings = function() {
    localStorage.removeItem('supabase_settings');
    triggerToast('設定已清除！回歸本地模式，即將重新載入...', 'success');
    setShowSettings(false);
    setTimeout(function() {
      window.location.reload();
    }, 1000);
  };

  const handleFetchModelsClick = function() {
    fetchAvailableModels(geminiApiKey);
  };

  const handleApiKeyBlur = function() {
    if (geminiApiKey && geminiApiKey.trim().length >= 10) {
      fetchAvailableModels(geminiApiKey);
    }
  };

  var hasAnyConnection = dbConnected || aiConnected;

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="glass-panel app-header">
        <div className="brand">
          <div className="brand-logo">司</div>
          <div>
            <h1 className="brand-name">司法預備演習筆記</h1>
            <span className="brand-tagline">
              Gemini AI 智能解析與論點管理 {
                (dbConnected && aiConnected) ? '☁️ Cloud + 🤖 AI' :
                dbConnected ? '☁️ Cloud DB' :
                aiConnected ? '🤖 Gemini AI' : '💾 Local'
              }
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <nav className="nav-tabs">
            <button 
              className={'nav-btn ' + (activeTab === 'dashboard' ? 'active' : '')}
              onClick={function() { setActiveTab('dashboard'); }}
            >
              📊 儀表板 (Dashboard)
            </button>
            <button 
              className={'nav-btn ' + (activeTab === 'studio' ? 'active' : '')}
              onClick={function() { handleGoToStudio(''); }}
            >
              🛠️ 工作台 (Studio)
            </button>
          </nav>
          
          <button 
            className={'btn btn-secondary ' + (hasAnyConnection ? 'active-priority' : '')} 
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={function() { setShowSettings(true); }}
            title="系統連線設定"
          >
            ⚙️ {
              (dbConnected && aiConnected) ? '雙線已連線' :
              dbConnected ? '雲端 DB 已連線' :
              aiConnected ? 'Gemini AI 已連線' : '未連線'
            }
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

      {/* Settings Modal Dialog — uses dedicated .settings-overlay (NOT .lightbox) */}
      {showSettings && (
        <div className="settings-overlay" onClick={function() { setShowSettings(false); }}>
          <div className="settings-modal" onClick={function(e) { e.stopPropagation(); }}>
            <h2>⚙️ 系統 API 與資料庫配置設定</h2>
            <p className="settings-desc">
              請在此貼上您的連線金鑰。Gemini API Key 用於聯網與法律解析；Supabase 憑證則用於雲端備份與多圖儲存（若未填寫 Supabase 則自動儲存於本地）。
            </p>

            <form onSubmit={handleSaveSettings}>
              {/* Gemini API Key Section */}
              <div className="settings-section">
                <div className="form-group">
                  <label className="form-label">🤖 Gemini API Key</label>
                  <div className="settings-input-row">
                    <input 
                      type="password" 
                      className="settings-input"
                      placeholder="AIzaSy... (若空白則使用模擬 AI 服務)"
                      value={geminiApiKey}
                      onChange={function(e) { setGeminiApiKey(e.target.value); }}
                      onBlur={handleApiKeyBlur}
                    />
                    <button 
                      type="button"
                      className="btn-fetch-models"
                      onClick={handleFetchModelsClick}
                      disabled={isLoadingModels || !geminiApiKey}
                      title="使用 API Key 取得目前可使用的模型清單"
                    >
                      {isLoadingModels ? (
                        <React.Fragment>
                          <div className="spinner-sm"></div>
                          載入中
                        </React.Fragment>
                      ) : (
                        <React.Fragment>🔄 取得模型</React.Fragment>
                      )}
                    </button>
                  </div>
                  <span className="settings-hint">
                    可在 Google AI Studio 免費申請此金鑰。輸入後點擊「取得模型」即可載入可用模型。
                  </span>
                </div>
              </div>

              {/* Model Selection Section */}
              <div className="settings-section">
                <div className="form-group">
                  <label className="form-label">
                    🤖 選擇 AI 模型 (Model)
                    {modelsFetched && (
                      <span className="model-count-badge">
                        ✓ 已載入 {availableModels.length} 個模型
                      </span>
                    )}
                  </label>
                  <select 
                    className="settings-select"
                    value={geminiModel}
                    onChange={function(e) { setGeminiModel(e.target.value); }}
                  >
                    {availableModels.map(function(m) {
                      return <option key={m} value={m}>{m}</option>;
                    })}
                  </select>
                  {modelFetchError && (
                    <span className="settings-hint" style={{ color: 'var(--accent-gold)' }}>
                      ⚠️ {modelFetchError}
                    </span>
                  )}
                  <span className="settings-hint">
                    {modelsFetched 
                      ? '已從 Google API 即時取得可用模型清單。' 
                      : '目前顯示預設模型清單。請輸入 API Key 並點擊「取得模型」以載入最新清單。'}
                  </span>
                </div>
              </div>

              {/* Supabase Section */}
              <div className="settings-section">
                <h4>☁️ Supabase 雲端備份設定 (選填)</h4>

                <div className="form-group">
                  <label className="form-label">🌐 Supabase URL</label>
                  <input 
                    type="text" 
                    className="settings-input"
                    placeholder="https://xxxxxx.supabase.co"
                    value={supabaseUrl}
                    onChange={function(e) { setSupabaseUrl(e.target.value); }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">🔑 Anon Public Key</label>
                  <input 
                    type="password" 
                    className="settings-input"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5c..."
                    value={supabaseKey}
                    onChange={function(e) { setSupabaseKey(e.target.value); }}
                  />
                </div>

                <div className="settings-warning-box">
                  ⚠️ <strong>注意</strong>：請確認您已在 Supabase 後台 API 設定中，將 <strong>judicial_exam</strong> schema 加入 <strong>Exposed schemas</strong> 名單，並設定好 <strong>judicial-exam-assets</strong> Storage Bucket。
                </div>
              </div>

              {/* Action Buttons */}
              <div className="settings-actions">
                <button type="button" className="btn btn-secondary" onClick={function() { setShowSettings(false); }}>
                  取消
                </button>
                <div className="settings-actions-right">
                  {hasAnyConnection && (
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
        {toasts.map(function(toast) {
          return (
            <div key={toast.id} className={'toast ' + toast.type}>
              <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
              <span>{toast.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

