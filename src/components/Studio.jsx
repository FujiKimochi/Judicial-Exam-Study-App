import React, { useState, useEffect, useRef } from 'react';
import { getPoints, getSubjects, saveQuestion } from '../services/db';
import { generateInitialAnalysis, chatWithAi, searchExternalLinks } from '../services/ai';

const getShortPointName = (name) => {
  if (!name) return '';
  return name.replace(/^.*?\d+章\s*/, '');
};

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

  // Load points and subjects asynchronously
  useEffect(() => {
    const loadPointsAndSubjects = async () => {
      try {
        const pts = await getPoints();
        const subs = await getSubjects();
        setAllPoints(pts);
        setAllSubjects(subs);
        
        if (initialPointId) {
          const pt = pts.find(p => p.id === initialPointId);
          if (pt) {
            setPointSearchQuery(pt.name);
          }
        }
      } catch (e) {
        console.error('Failed to load points/subjects', e);
      }
    };
    loadPointsAndSubjects();
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
    
    triggerToast(`Uploaded ${files.length} problem screenshots.`, 'success');
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
    triggerToast(`Attached ${files.length} reference law screenshots.`, 'success');
  };

  const removeCodebookPhoto = (idx) => {
    setCodebookPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  // Step 1 Submit: Generate initial analysis
  const handleGenerateAnalysis = async () => {
    if (screenshots.length === 0) {
      triggerToast('Please upload at least one problem screenshot.', 'warning');
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
      triggerToast('AI explanation generated!', 'success');
    } catch (err) {
      console.error(err);
      triggerToast(`Gemini failed: ${err.message || err}`, 'warning');
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
      console.error(e);
      triggerToast(`AI chat error: ${e.message || e}`, 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2 Actions: Google Web Search
  const handleTriggerSearch = async () => {
    setIsSearchingLinks(true);
    const activePointName = allPoints.find(p => p.id === selectedPointId)?.name || 'Legal Provisions and Precedents';
    try {
      const results = await searchExternalLinks(activePointName);
      setReferenceLinks(prev => {
        // Avoid duplicate links
        const existingUrls = prev.map(l => l.url);
        const uniqueNew = results.filter(r => !existingUrls.includes(r.url));
        return [...prev, ...uniqueNew];
      });
      triggerToast('Expert legal links search completed.', 'success');
    } catch (e) {
      triggerToast('Web search failed.', 'warning');
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
  const handleSaveQuestion = async () => {
    if (!selectedPointId) {
      triggerToast('Please select a point tag to save.', 'warning');
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

    setIsLoading(true);
    try {
      await saveQuestion(questionData);
      triggerToast('Note saved successfully!', 'success');
      onSaveSuccess();
    } catch (e) {
      console.error('Save question failed:', e);
      const errDetail = (e && e.message) ? e.message : (typeof e === 'string' ? e : JSON.stringify(e));
      triggerToast('Save failed: ' + errDetail, 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="studio-container animate-fade-in">
      {/* Sidebar: Step Indicator */}
      <aside className="glass-panel studio-steps-sidebar">
        <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '8px' }}>Workspace Nav</h3>
        
        <div className={`step-indicator ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
          <div className="step-number">1</div>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Step 1</p>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Upload & Generate</span>
          </div>
        </div>

        <div className={`step-indicator ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
          <div className="step-number">2</div>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Step 2</p>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Chat & Verify</span>
          </div>
        </div>

        <div className={`step-indicator ${currentStep === 3 ? 'active' : ''}`}>
          <div className="step-number">3</div>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Step 3</p>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Categorize & Save</span>
          </div>
        </div>

        <div style={{ marginTop: 'auto', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          💡 <strong>Anti-Hallucination Tip</strong>: In Step 2, upload photos of reference laws. Gemini will cross-examine them to ensure 100% factual accuracy.
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="glass-panel studio-main-card">
        {/* Loading Spinner Overlays */}
        {isLoading ? (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <h3 style={{ fontFamily: 'var(--font-title)' }}>Gemini AI is thinking...</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Analyzing code requirements and precedents...</p>
          </div>
        ) : (
          <>
            {/* STEP 1: INPUT AND PRELIMINARY ANALYSIS */}
            {currentStep === 1 && (
              <div className="studio-step-content animate-fade-in">
                <h2 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>Step 1: Upload Screenshots & Generate Explanation</span>
                </h2>

                {/* Drop Zone */}
                <div 
                  className="drop-zone"
                  onClick={() => document.getElementById('screenshot-upload').click()}
                >
                  <div className="drop-zone-icon">📁</div>
                  <p className="drop-zone-text">Drag & drop multiple screenshots here, or <strong>click to select files</strong></p>
                  <p className="drop-zone-subtext">Supports JPEG, PNG (multiple files supported)</p>
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
                    <label className="form-label">Uploaded Screenshots ({screenshots.length})</label>
                    <div className="image-previews-grid">
                      {screenshots.map((src, idx) => (
                        <div key={idx} className="img-preview-card">
                          <img src={src} alt="Screenshot" className="img-preview-thumbnail" />
                          <button className="remove-img-btn" onClick={() => removeScreenshot(idx)}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prompt Parameters */}
                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label className="form-label">🤖 AI Instructions (Preset)</label>
                  <div className="form-input-static" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                    日本法律や判例の前提で、まず本問の論点を一言で説明してください。それに、条文や判例の趣旨を踏まえて具体例を挙げながら分かりやすく解説してください。
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label className="form-label">✍️ Additional Instructions (Optional)</label>
                  <textarea 
                    className="form-textarea"
                    placeholder="e.g. Compare the elements of liability/crime in a table format..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                  />
                </div>

                {/* Navigation Actions */}
                <div className="studio-actions">
                  <div></div> {/* Empty for layout align */}
                  <button className="btn btn-primary" onClick={handleGenerateAnalysis}>
                    Generate Explanation →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: CHAT AND CORRECT HALLUCINATION */}
            {currentStep === 2 && (
              <div className="studio-step-content animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '20px' }}>Step 2: Follow-up Chat & Reference Verification</h2>
                  
                  {/* Google Search Link Retrieval */}
                  <button 
                    className="btn btn-secondary" 
                    style={{ gap: '6px', fontSize: '13px', padding: '8px 16px' }}
                    onClick={handleTriggerSearch}
                    disabled={isSearchingLinks}
                  >
                    {isSearchingLinks ? 'Searching...' : '🌐 Search Expert Legal Links'}
                  </button>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Feel free to ask follow-up questions to refine the analysis. You can attach reference law photos to prevent AI hallucination.
                </p>

                {/* Reference Links Section (if any retrieved) */}
                {referenceLinks.length > 0 && (
                  <div className="search-results-box animate-fade-in">
                    <span className="section-label" style={{ color: 'var(--accent-cyan)' }}>Retrieved external references:</span>
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
                          {chat.role === 'user' ? 'User' : 'Gemini AI'}
                        </span>
                        <div className="chat-bubble" style={{ whiteSpace: 'pre-wrap' }}>
                          {chat.content}
                          {chat.attachments && chat.attachments.length > 0 && (
                            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                              {chat.attachments.map((img, iIdx) => (
                                <img 
                                  key={iIdx} 
                                  src={img} 
                                  alt="Attachment" 
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
                      <span>📎 Reference law photos to attach ({codebookPhotos.length}):</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {codebookPhotos.map((src, idx) => (
                          <div key={idx} style={{ position: 'relative' }}>
                            <img src={src} alt="Reference" style={{ width: '24px', height: '24px', borderRadius: '2px', objectFit: 'cover' }} />
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
                      title="Upload reference law photos"
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
                      placeholder="Type a follow-up question... upload law photos to correct the AI."
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
                    ← Back (Edit Problem)
                  </button>
                  <button className="btn btn-primary" onClick={() => setCurrentStep(3)}>
                    Next (Categorize & Save) →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: CATEGORIZATION AND CONFIRM SAVE */}
            {currentStep === 3 && (
              <div className="studio-step-content animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Step 3: Categorize & Save</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Please select a point to categorize this study note. It will show up on your dashboard.
                </p>

                {/* Point Selection Suggest Search */}
                <div className="form-group suggest-search-container" style={{ marginTop: '20px' }}>
                  <label className="form-label">🔍 Select Point Tag (Required)</label>
                  <input 
                    type="text" 
                    className="search-input"
                    placeholder="Search key terms or subjects (e.g. agency, tort)..."
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
                              <span>{getShortPointName(pt.name)}</span>
                              <span className="suggest-item-subject">{subName}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="suggest-item" style={{ color: 'var(--text-muted)' }}>
                          No matching points found
                        </div>
                      )}
                    </div>
                  )}
                  {selectedPointId && (
                    <div style={{ fontSize: '12px', color: 'var(--accent-cyan)', marginTop: '4px' }}>
                      ✓ Categorized under: <strong>{getShortPointName(allPoints.find(p => p.id === selectedPointId)?.name)}</strong>
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
                    <span className="priority-label-bold">⭐ Mark as High Priority for Review</span>
                    <p className="priority-subtext" style={{ margin: 0 }}>
                      Highlights this note on the dashboard for quick access and last-minute cramming.
                    </p>
                  </div>
                </div>

                {/* Navigation Actions */}
                <div className="studio-actions" style={{ marginTop: '40px' }}>
                  <button className="btn btn-secondary" onClick={() => setCurrentStep(2)}>
                    ← Back (Chat)
                  </button>
                  <button 
                    className="btn btn-accent" 
                    onClick={handleSaveQuestion}
                    disabled={!selectedPointId}
                  >
                    💾 Save & Add to Dashboard
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
