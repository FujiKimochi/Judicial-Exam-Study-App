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
      setModelFetchError('Please enter a valid API key first');
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
        throw new Error('Invalid API response format');
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
        setModelFetchError('No models supporting generateContent found. Using fallback list.');
        setAvailableModels(DEFAULT_FALLBACK_MODELS);
      }
    } catch (e) {
      console.error('Failed to fetch models from Gemini API', e);
      setModelFetchError('Failed to fetch models: ' + (e.message || 'Unknown error'));
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
      triggerToast('Settings saved! Reloading...', 'success');
      setShowSettings(false);
      setTimeout(function() {
        window.location.reload();
      }, 1000);
    } catch (err) {
      triggerToast('Failed to save settings', 'warning');
    }
  };

  const handleClearSettings = function() {
    localStorage.removeItem('supabase_settings');
    triggerToast('Settings cleared! Switching to local mode and reloading...', 'success');
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
            <h1 className="brand-name">Judicial Exam Prep Notes</h1>
            <span className="brand-tagline">
              Gemini AI Smart Analysis & Point Management {
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
              📊 Dashboard
            </button>
            <button 
              className={'nav-btn ' + (activeTab === 'studio' ? 'active' : '')}
              onClick={function() { handleGoToStudio(''); }}
            >
              🛠️ Studio
            </button>
          </nav>
          
          <button 
            className={'btn btn-secondary ' + (hasAnyConnection ? 'active-priority' : '')} 
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={function() { setShowSettings(true); }}
            title="System Connection Settings"
          >
            ⚙️ {
              (dbConnected && aiConnected) ? 'Connected' :
              dbConnected ? 'Cloud DB Connected' :
              aiConnected ? 'Gemini AI Connected' : 'Not Connected'
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
            <h2>⚙️ System API & Database Settings</h2>
            <p className="settings-desc">
              Please enter your credentials below. The Gemini API Key is used for web search grounding and generating explanations. The Supabase credentials are used for cloud database synchronization and screenshot uploads (if not set, data is stored locally in your browser).
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
                      placeholder="AIzaSy... (Leave empty to use mock AI service)"
                      value={geminiApiKey}
                      onChange={function(e) { setGeminiApiKey(e.target.value); }}
                      onBlur={handleApiKeyBlur}
                    />
                    <button 
                      type="button"
                      className="btn-fetch-models"
                      onClick={handleFetchModelsClick}
                      disabled={isLoadingModels || !geminiApiKey}
                      title="Fetch available models using API Key"
                    >
                      {isLoadingModels ? (
                        <React.Fragment>
                          <div className="spinner-sm"></div>
                          Loading
                        </React.Fragment>
                      ) : (
                        <React.Fragment>🔄 Fetch Models</React.Fragment>
                      )}
                    </button>
                  </div>
                  <span className="settings-hint">
                    You can obtain a free Gemini API key from Google AI Studio. After pasting it, click "Fetch Models" to load the latest list.
                  </span>
                </div>
              </div>

              {/* Model Selection Section */}
              <div className="settings-section">
                <div className="form-group">
                  <label className="form-label">
                    🤖 Select AI Model (Model)
                    {modelsFetched && (
                      <span className="model-count-badge">
                        ✓ Loaded {availableModels.length} models
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
                      ? 'Real-time models fetched from the Google API.' 
                      : 'Showing fallback models. Enter API Key and click "Fetch Models" to refresh.'}
                  </span>
                </div>
              </div>

              {/* Supabase Section */}
              <div className="settings-section">
                <h4>☁️ Supabase Cloud Synchronization (Optional)</h4>

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
                  ⚠️ <strong>Note</strong>: Ensure that the <strong>judicial_exam</strong> schema is added to <strong>Exposed schemas</strong> in your Supabase API settings, and the <strong>judicial-exam-assets</strong> storage bucket has been created.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="settings-actions">
                <button type="button" className="btn btn-secondary" onClick={function() { setShowSettings(false); }}>
                  Cancel
                </button>
                <div className="settings-actions-right">
                  {hasAnyConnection && (
                    <button type="button" className="btn btn-secondary delete-btn" onClick={handleClearSettings}>
                      Clear Connection
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary">
                    Save & Reload
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

