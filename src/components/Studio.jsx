import React, { useState, useEffect, useRef } from 'react';
import { getPoints, getSubjects, saveQuestion } from '../services/db';
import { generateInitialAnalysis, chatWithAi, searchExternalLinks } from '../services/ai';

export default function Studio({ initialPointId, onSaveSuccess, triggerToast }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Step 1 State
  const [screenshots, setScreenshots] = useState([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [initialResponse, setInitialResponse] = useState('');

  // Step 2 State
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [codebookPhotos, setCodebookPhotos] = useState([]);
  const [referenceLinks, setReferenceLinks] = useState([]);
  const [isSearchingLinks, setIsSearchingLinks] = useState(false);

  // Step 3 State
  const [selectedPointId, setSelectedPointId] = useState(initialPointId || '');
  const [pointSearchQuery, setPointSearchQuery] = useState('');
  const [showSuggestDropdown, setShowSuggestDropdown] = useState(false);
  const [isPriority, setIsPriority] = useState(false);

  // Constants
  const [allPoints, setAllPoints] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);

  const chatEndRef = useRef(null);

  // Load points and subjects
  useEffect(() => {
    setAllPoints(getPoints());
    setAllSubjects(getSubjects());
    
    if (initialPointId) {
      const pt = getPoints().find(p => p.id === initialPointId);
      if (pt) {
        setPointSearchQuery(pt.name);
      }
    }
  }, [initialPointId]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  // Handle Drag & Drop / File Uploads for Step 1
  const handleScreenshotUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshots(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
    
    triggerToast(`已上傳 ${files.length} 張題目截圖`, 'success');
  };

  const removeScreenshot = (idx) => {
    setScreenshots(prev => prev.filter((_, i) => i !== idx));
  };

  // Handle Codebook Attachment Uploads for Step 2 (Anti-hallucination)
  const handleCodebookUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCodebookPhotos(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
    triggerToast(`已附加 ${files.length} 張法典佐證圖`, 'success');
  };

  const removeCodebookPhoto = (idx) => {
    setCodebookPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  // Step 1 Submit: Generate initial analysis
  const handleGenerateAnalysis = async () => {
    if (screenshots.length === 0) {
      triggerToast('請先上傳至少一張題目截圖', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      const analysis = await generateInitialAnalysis(screenshots, customPrompt);
      setInitialResponse(analysis);
      
      // Initialize Chat History with AI initial response
      setChatHistory([
        { role: 'assistant', content: analysis }
      ]);
      
      setCurrentStep(2);
      triggerToast('AI 解析已初步生成！', 'success');
    } catch (err) {
      triggerToast('呼叫 Gemini API 失敗，請重試。', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2 Actions: Chat
  const handleSendChatMessage = async () => {
    if (!chatInput.trim() && codebookPhotos.length === 0) return;

    const userMsg = {
      role: 'user',
      content: chatInput,
      attachments: codebookPhotos.length > 0 ? [...codebookPhotos] : null
    };

    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setCodebookPhotos([]); // Clear attachments input

    setIsLoading(true);
    try {
      // Pass chat history and user message, including any photos for validation
      const aiReply = await chatWithAi(chatHistory, userMsg.content, userMsg.attachments);
      setChatHistory(prev => [...prev, aiReply]);
      
      // If it returned a corrected text, we can update the main AI Response for final save
      if (userMsg.attachments && userMsg.attachments.length > 0) {
        setInitialResponse(prev => `${prev}\n\n${aiReply.content}`);
      }
    } catch (e) {
      triggerToast('AI 對話發生錯誤', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2 Actions: Google Web Search
  const handleTriggerSearch = async () => {
    setIsSearchingLinks(true);
    const activePointName = allPoints.find(p => p.id === selectedPointId)?.name || '法律條文與判例';
    try {
      const results = await searchExternalLinks(activePointName);
      setReferenceLinks(prev => {
        // Avoid duplicate links
        const existingUrls = prev.map(l => l.url);
        const uniqueNew = results.filter(r => !existingUrls.includes(r.url));
        return [...prev, ...uniqueNew];
      });
      triggerToast('已成功檢索外部權威律師見解', 'success');
    } catch (e) {
      triggerToast('聯網檢索失敗', 'warning');
    } finally {
      setIsSearchingLinks(false);
    }
  };

  // Step 3 Actions: Select point suggest search
  const filteredSuggestPoints = allPoints.filter(p => {
    if (!pointSearchQuery) return true;
    const sub = allSubjects.find(s => s.id === p.subjectId);
    const subName = sub ? sub.name : '';
    return p.name.toLowerCase().includes(pointSearchQuery.toLowerCase()) || 
           subName.toLowerCase().includes(pointSearchQuery.toLowerCase());
  });

  const handleSelectPoint = (pt) => {
    setSelectedPointId(pt.id);
    setPointSearchQuery(pt.name);
    setShowSuggestDropdown(false);
  };

  // Step 3 Final: Save Question to DB
  const handleSaveQuestion = () => {
    if (!selectedPointId) {
      triggerToast('請選擇要歸檔的論點標籤', 'warning');
      return;
    }

    const questionData = {
      pointId: selectedPointId,
      screenshots: screenshots,
      prompt: customPrompt,
      aiResponse: initialResponse,
      chatHistory: chatHistory,
      referenceLinks: referenceLinks,
      isPriority: isPriority
    };

    saveQuestion(questionData);
    triggerToast('筆記已成功歸檔儲存！', 'success');
    
    // Reset and return
    onSaveSuccess();
  };

  return (
    <div className="studio-container animate-fade-in">
      {/* Sidebar: Step Indicator */}
      <aside className="glass-panel studio-steps-sidebar">
        <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '8px' }}>工作台導航</h3>
        
        <div className={`step-indicator ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
          <div className="step-number">1</div>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Step 1</p>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>上傳與初步生成</span>
          </div>
        </div>

        <div className={`step-indicator ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
          <div className="step-number">2</div>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Step 2</p>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>對話推敲與防幻覺</span>
          </div>
        </div>

        <div className={`step-indicator ${currentStep === 3 ? 'active' : ''}`}>
          <div className="step-number">3</div>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Step 3</p>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>確認與分類儲存</span>
          </div>
        </div>

        <div style={{ marginTop: 'auto', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          💡 <strong>防幻覺小貼士</strong>：在第二步上傳您的實體六法照片，Gemini 會比對照片文字，確保條文內容 100% 正確！
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="glass-panel studio-main-card">
        {/* Loading Spinner Overlays */}
        {isLoading ? (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <h3 style={{ fontFamily: 'var(--font-title)' }}>Gemini AI 正在思考中...</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>正在為您結合條文與判例主旨，分析法律要件...</p>
          </div>
        ) : (
          <>
            {/* STEP 1: INPUT AND PRELIMINARY ANALYSIS */}
            {currentStep === 1 && (
              <div className="studio-step-content animate-fade-in">
                <h2 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>Step 1: 上傳題目截圖並進行初步生成</span>
                </h2>

                {/* Drop Zone */}
                <div 
                  className="drop-zone"
                  onClick={() => document.getElementById('screenshot-upload').click()}
                >
                  <div className="drop-zone-icon">📁</div>
                  <p className="drop-zone-text">拖曳多張題目截圖到這裡，或 <strong>點擊選擇檔案</strong></p>
                  <p className="drop-zone-subtext">支援 JPEG, PNG 等圖片格式（支援多圖同時上傳）</p>
                  <input 
                    type="file" 
                    id="screenshot-upload" 
                    className="file-input" 
                    multiple 
                    accept="image/*"
                    onChange={handleScreenshotUpload}
                  />
                </div>

                {/* Upload Previews */}
                {screenshots.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">已上傳的截圖 ({screenshots.length} 張)</label>
                    <div className="image-previews-grid">
                      {screenshots.map((src, idx) => (
                        <div key={idx} className="img-preview-card">
                          <img src={src} alt="預覽" className="img-preview-thumbnail" />
                          <button className="remove-img-btn" onClick={() => removeScreenshot(idx)}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prompt Parameters */}
                <div className="form-group">
                  <label className="form-label">🤖 預設提示詞 (防幻覺固定提示詞)</label>
                  <div className="form-input-static">
                    請結合條文與判例的主旨，並運用具體實例，以深入淺出的方式進行解析。
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">✍️ 追加提示詞 (自由填寫)</label>
                  <textarea 
                    className="form-textarea"
                    placeholder="例如：請特別比較此行為與無權處分的差異、請用列表方式呈現構成要件差異..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                  />
                </div>

                {/* Navigation Actions */}
                <div className="studio-actions">
                  <div></div> {/* Empty for layout align */}
                  <button className="btn btn-primary" onClick={handleGenerateAnalysis}>
                    呼叫 Gemini 生成解析 →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: CHAT AND CORRECT HALLUCINATION */}
            {currentStep === 2 && (
              <div className="studio-step-content animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '20px' }}>Step 2: 深度對話推敲與防 AI 幻覺校正</h2>
                  
                  {/* Google Search Link Retrieval */}
                  <button 
                    className="btn btn-secondary" 
                    style={{ gap: '6px', fontSize: '13px', padding: '8px 16px' }}
                    onClick={handleTriggerSearch}
                    disabled={isSearchingLinks}
                  >
                    {isSearchingLinks ? '正在檢索...' : '🌐 檢索律師權威見解連結'}
                  </button>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  您可以在此與 Gemini 進一步研討。如果擔心 AI 幻覺，請上傳您的「法典相片」或「條文截圖」作為補充證據！
                </p>

                {/* Reference Links Section (if any retrieved) */}
                {referenceLinks.length > 0 && (
                  <div className="search-results-box animate-fade-in">
                    <span className="section-label" style={{ color: 'var(--accent-cyan)' }}>檢索到的外部參考資料：</span>
                    <div className="links-grid" style={{ marginTop: '8px' }}>
                      {referenceLinks.map((link, idx) => (
                        <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="external-link-pill">
                          🔗 {link.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chat Panel */}
                <div className="studio-chat-wrapper">
                  <div className="studio-chat-messages">
                    {chatHistory.map((chat, idx) => (
                      <div key={idx} className={`chat-bubble-wrapper ${chat.role === 'user' ? 'user' : 'assistant'}`}>
                        <span className="chat-bubble-sender">
                          {chat.role === 'user' ? '考生' : 'Gemini AI'}
                        </span>
                        <div className="chat-bubble" style={{ whiteSpace: 'pre-wrap' }}>
                          {chat.content}
                          {chat.attachments && chat.attachments.length > 0 && (
                            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                              {chat.attachments.map((img, iIdx) => (
                                <img 
                                  key={iIdx} 
                                  src={img} 
                                  alt="附件" 
                                  style={{ width: '45px', height: '45px', borderRadius: '4px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Attachment indicator */}
                  {codebookPhotos.length > 0 && (
                    <div className="attachment-indicator-bar animate-fade-in">
                      <span>📎 準備隨訊息發送的法典截圖 ({codebookPhotos.length} 張)：</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {codebookPhotos.map((src, idx) => (
                          <div key={idx} style={{ position: 'relative' }}>
                            <img src={src} alt="法典" style={{ width: '24px', height: '24px', borderRadius: '2px', objectFit: 'cover' }} />
                            <button 
                              style={{ position: 'absolute', top: -3, right: -3, background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '10px', height: '10px', fontSize: '6px', display: 'flex', alignItems: 'center', justify: 'center', cursor: 'pointer' }}
                              onClick={() => removeCodebookPhoto(idx)}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Input Bar */}
                  <div className="studio-chat-input-bar">
                    {/* Add attachment button */}
                    <button 
                      className="chat-action-btn"
                      title="上傳法典佐證相片 (防幻覺)"
                      onClick={() => document.getElementById('codebook-upload').click()}
                    >
                      📎
                    </button>
                    <input 
                      type="file" 
                      id="codebook-upload" 
                      className="file-input" 
                      multiple 
                      accept="image/*"
                      onChange={handleCodebookUpload}
                    />

                    <input 
                      type="text" 
                      className="chat-input"
                      placeholder="輸入您的追問... 上傳法典照片以糾正AI的偏差見解"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendChatMessage();
                      }}
                    />
                    
                    <button 
                      className="chat-action-btn send"
                      onClick={handleSendChatMessage}
                      disabled={!chatInput.trim() && codebookPhotos.length === 0}
                    >
                      ▲
                    </button>
                  </div>
                </div>

                {/* Navigation Actions */}
                <div className="studio-actions">
                  <button className="btn btn-secondary" onClick={() => setCurrentStep(1)}>
                    ← 上一步 (修改題目)
                  </button>
                  <button className="btn btn-primary" onClick={() => setCurrentStep(3)}>
                    繼續下一步 (歸檔儲存) →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: CATEGORIZATION AND CONFIRM SAVE */}
            {currentStep === 3 && (
              <div className="studio-step-content animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Step 3: 選擇論點與確認儲存</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  請選擇該題目所對應的法典論點（點次），此題目將會與其綁定並出現在您的儀表板上。
                </p>

                {/* Point Selection Suggest Search */}
                <div className="form-group suggest-search-container" style={{ marginTop: '20px' }}>
                  <label className="form-label">🔍 選擇歸檔論點標籤 (必填)</label>
                  <input 
                    type="text" 
                    className="search-input"
                    placeholder="請輸入論點關鍵字或科目搜尋（例如：無權代理）..."
                    value={pointSearchQuery}
                    onChange={(e) => {
                      setPointSearchQuery(e.target.value);
                      setShowSuggestDropdown(true);
                    }}
                    onFocus={() => setShowSuggestDropdown(true)}
                  />
                  {showSuggestDropdown && (
                    <div className="suggest-dropdown">
                      {filteredSuggestPoints.length > 0 ? (
                        filteredSuggestPoints.map(pt => {
                          const subName = allSubjects.find(s => s.id === pt.subjectId)?.name || '';
                          return (
                            <div 
                              key={pt.id} 
                              className="suggest-item"
                              onClick={() => handleSelectPoint(pt)}
                            >
                              <span>{pt.name}</span>
                              <span className="suggest-item-subject">{subName}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="suggest-item" style={{ color: 'var(--text-muted)' }}>
                          無相符論點標籤
                        </div>
                      )}
                    </div>
                  )}
                  {selectedPointId && (
                    <div style={{ fontSize: '12px', color: 'var(--accent-cyan)', marginTop: '4px' }}>
                      ✓ 已選定歸檔至：<strong>{allPoints.find(p => p.id === selectedPointId)?.name}</strong>
                    </div>
                  )}
                </div>

                {/* Priority review checkbox */}
                <div 
                  className="priority-checkbox-wrapper" 
                  style={{ marginTop: '20px' }}
                  onClick={() => setIsPriority(!isPriority)}
                >
                  <input 
                    type="checkbox" 
                    checked={isPriority}
                    onChange={(e) => setIsPriority(e.target.checked)}
                    onClick={(e) => e.stopPropagation()} // Avoid double toggling
                  />
                  <div>
                    <span className="priority-label-bold">⭐ 標記為「優先複習」重點題目</span>
                    <p className="priority-subtext" style={{ margin: 0 }}>
                      勾選後，此題目將會在儀表板上以金黃霓虹邊框高亮顯示，便於臨考前快速篩選與衝刺。
                    </p>
                  </div>
                </div>

                {/* Navigation Actions */}
                <div className="studio-actions" style={{ marginTop: '40px' }}>
                  <button className="btn btn-secondary" onClick={() => setCurrentStep(2)}>
                    ← 上一步 (對話校正)
                  </button>
                  <button 
                    className="btn btn-accent" 
                    onClick={handleSaveQuestion}
                    disabled={!selectedPointId}
                  >
                    💾 確認儲存，彙整至儀表板
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
