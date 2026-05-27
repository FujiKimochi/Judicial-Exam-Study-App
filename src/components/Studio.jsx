import React, { useState, useEffect, useRef } from 'react';
import { getPoints, getSubjects, saveQuestion } from '../services/db';
import { generateInitialAnalysis, chatWithAi, searchExternalLinks } from '../services/ai';
import { renderMarkdown } from './Dashboard';

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

  // Highlighter & Edit States
  const [highlighterMode, setHighlighterMode] = useState(true);
  const [selectionInfo, setSelectionInfo] = useState(null);
  const [editingIdx, setEditingIdx] = useState(-1);
  const [editingText, setEditingText] = useState('');

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

  // Scroll chat to bottom only when messages are added
  const prevHistoryLength = useRef(0);
  useEffect(() => {
    if (chatHistory.length > prevHistoryLength.current) {
      if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevHistoryLength.current = chatHistory.length;
  }, [chatHistory]);

  // Handle text highlighting and manual edits in Step 2
  const handleTextSelection = (idx, e) => {
    if (!highlighterMode) return;
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (!text || editingIdx !== -1) {
      setSelectionInfo(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelectionInfo({
      text: text,
      chatIdx: idx,
      top: rect.top + window.scrollY - 36,
      left: rect.left + window.scrollX + (rect.width / 2) - 40
    });
  };

  const handleApplyHighlight = (color) => {
    if (!selectionInfo) return;
    const { text, chatIdx } = selectionInfo;
    
    setChatHistory(prev => {
      const updated = [...prev];
      const chat = updated[chatIdx];
      
      // Escape special characters in text for regex
      const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Pattern to match any existing highlight: ==text== or ==color:text==
      const regexPattern = new RegExp(`==(?:pink:|yellow:|green:|blue:|purple:)?${escapedText}==`, 'gi');
      
      let newContent;
      const isAlreadyHighlighted = regexPattern.test(chat.content);
      
      if (color === 'remove') {
        if (isAlreadyHighlighted) {
          newContent = chat.content.replace(regexPattern, text);
        } else {
          newContent = chat.content;
        }
      } else {
        if (isAlreadyHighlighted) {
          newContent = chat.content.replace(regexPattern, `==${color}:${text}==`);
        } else {
          newContent = chat.content.replace(text, `==${color}:${text}==`);
        }
      }
      
      updated[chatIdx] = {
        ...chat,
        content: newContent
      };

      if (chatIdx === 0) {
        setInitialResponse(newContent);
      }
      
      return updated;
    });

    window.getSelection().removeAllRanges();
    setSelectionInfo(null);
  };

  const handleToggleEdit = (idx) => {
    if (editingIdx === idx) {
      handleSaveEdit(idx);
    } else {
      setEditingIdx(idx);
      setEditingText(chatHistory[idx].content);
      setSelectionInfo(null);
    }
  };

  const handleSaveEdit = (idx) => {
    setChatHistory(prev => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        content: editingText
      };
      if (idx === 0) {
        setInitialResponse(editingText);
      }
      return updated;
    });
    setEditingIdx(-1);
  };

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
    
    triggerToast(`問題のスクリーンショットを ${files.length} 枚アップロードしました`, 'success');
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
    triggerToast(`法帖のエビデンス画像を ${files.length} 枚添付しました`, 'success');
  };

  const removeCodebookPhoto = (idx) => {
    setCodebookPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  // Step 1 Submit: Generate initial analysis
  const handleGenerateAnalysis = async () => {
    if (screenshots.length === 0) {
      triggerToast('問題のスクリーンショットを少なくとも1枚アップロードしてください', 'warning');
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
      triggerToast('AI解説の初期生成が完了しました！', 'success');
    } catch (err) {
      console.error(err);
      triggerToast(`Geminiの呼び出しに失敗しました: ${err.message || err}`, 'warning');
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
      triggerToast(`AI対話エラー: ${e.message || e}`, 'warning');
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
      triggerToast('外部の専門的見解の検索に成功しました', 'success');
    } catch (e) {
      triggerToast('ウェブ検索に失敗しました', 'warning');
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
      triggerToast('保存先の論点タグを選択してください', 'warning');
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
      triggerToast('ノートが正常に保存されました！', 'success');
      onSaveSuccess();
    } catch (e) {
      console.error('Save question failed:', e);
      const errDetail = (e && e.message) ? e.message : (typeof e === 'string' ? e : JSON.stringify(e));
      triggerToast('保存に失敗しました: ' + errDetail, 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="studio-container animate-fade-in">
      {/* Sidebar: Step Indicator */}
      <aside className="glass-panel studio-steps-sidebar">
        <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '8px' }}>ワークスペースナビ</h3>
        
        <div className={`step-indicator ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
          <div className="step-number">1</div>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Step 1</p>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>アップロードと初期生成</span>
          </div>
        </div>

        <div className={`step-indicator ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
          <div className="step-number">2</div>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Step 2</p>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>対話校正とハルシネーション対策</span>
          </div>
        </div>

        <div className={`step-indicator ${currentStep === 3 ? 'active' : ''}`}>
          <div className="step-number">3</div>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Step 3</p>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>確認と分類保存</span>
          </div>
        </div>

        <div style={{ marginTop: 'auto', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          💡 <strong>ハルシネーション対策のコツ</strong>：ステップ2で六法全書の写真をアップロードすると、Geminiが画像テキストを読み取り、条文内容を100%正確に校正します！
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="glass-panel studio-main-card">
        {/* Loading Spinner Overlays */}
        {isLoading ? (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <h3 style={{ fontFamily: 'var(--font-title)' }}>Gemini AIが思考中...</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>条文と判例の趣旨を組み合わせ、法律上の要件を分析しています...</p>
          </div>
        ) : (
          <>
            {/* STEP 1: INPUT AND PRELIMINARY ANALYSIS */}
            {currentStep === 1 && (
              <div className="studio-step-content animate-fade-in">
                <h2 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>Step 1: 問題スクリーンショットのアップロードと初期生成</span>
                </h2>

                {/* Drop Zone */}
                <div 
                  className="drop-zone"
                  onClick={() => document.getElementById('screenshot-upload').click()}
                >
                  <div className="drop-zone-icon">📁</div>
                  <p className="drop-zone-text">複数の問題スクリーンショットをここにドラッグ＆ドロップするか、<strong>クリックしてファイルを選択</strong></p>
                  <p className="drop-zone-subtext">JPEG、PNGなどの画像形式に対応（複数画像の同時アップロード対応）</p>
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
                    <label className="form-label">アップロード済みのスクリーンショット ({screenshots.length} 枚)</label>
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
                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label className="form-label">🤖 AIへの指示（プリセット）</label>
                  <div className="form-input-static" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                    日本法律や判例の前提で、まず本問の論点を一言で説明してください。それに、条文や判例の趣旨を踏まえて具体例を挙げながら分かりやすく解説してください。
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label className="form-label">✍️ 追加プロンプト (自由入力)</label>
                  <textarea 
                    className="form-textarea"
                    placeholder="例：この解説に加えて、AとBの構成要件の違いを表形式で比較してください..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                  />
                </div>

                {/* Navigation Actions */}
                <div className="studio-actions">
                  <div></div> {/* Empty for layout align */}
                  <button className="btn btn-primary" onClick={handleGenerateAnalysis}>
                    Geminiで解説を生成 →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: CHAT AND CORRECT HALLUCINATION */}
            {currentStep === 2 && (
              <div className="studio-step-content animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '20px' }}>Step 2: 詳細な対話校正とAIハルシネーション対策</h2>
                  
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {/* Highlighter Toggle */}
                    <label className="priority-toggle-filter" style={{ background: highlighterMode ? 'rgba(0, 245, 225, 0.1)' : 'rgba(255,255,255,0.03)', borderColor: highlighterMode ? 'var(--accent-cyan)' : 'var(--border-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', userSelect: 'none' }}>
                      <input 
                        type="checkbox" 
                        checked={highlighterMode}
                        onChange={(e) => setHighlighterMode(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '13px', color: highlighterMode ? 'white' : 'var(--text-secondary)' }}>
                        🎨 蛍光筆モード {highlighterMode ? 'ON' : 'OFF'}
                      </span>
                    </label>

                    {/* Google Search Link Retrieval */}
                    <button 
                      className="btn btn-secondary" 
                      style={{ gap: '6px', fontSize: '13px', padding: '8px 16px' }}
                      onClick={handleTriggerSearch}
                      disabled={isSearchingLinks}
                    >
                      {isSearchingLinks ? '検索中...' : '🌐 弁護士の見解リンクを検索'}
                    </button>
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  ここでGeminiとさらに深く検討できます。ハルシネーション（AIの嘘）が心配な場合は、六法全書の写真や条文スクリーンショットを添付ファイルとして追加してください！{highlighterMode && ' (テキストを選択すると蛍光筆でハイライトできます)'}
                </p>

                {/* Reference Links Section (if any retrieved) */}
                {referenceLinks.length > 0 && (
                  <div className="search-results-box animate-fade-in">
                    <span className="section-label" style={{ color: 'var(--accent-cyan)' }}>検索された外部参考資料：</span>
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
                <div className="studio-chat-wrapper" style={{ position: 'relative' }}>
                  {/* Floating Highlighter Toolbar */}
                  {selectionInfo && (
                    <div 
                      className="floating-highlighter-toolbar animate-fade-in"
                      style={{
                        position: 'fixed',
                        top: `${selectionInfo.top}px`,
                        left: `${selectionInfo.left}px`,
                        zIndex: 3000,
                        background: 'rgba(30, 30, 38, 0.95)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: '24px',
                        padding: '6px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
                      }}
                    >
                      {[
                        { name: 'pink', label: 'ピンク', color: '#ff4081' },
                        { name: 'yellow', label: 'イエロー', color: '#ffeb3b' },
                        { name: 'green', label: 'グリーン', color: '#00e676' },
                        { name: 'blue', label: 'ブルー', color: '#00b0ff' },
                        { name: 'purple', label: 'パープル', color: '#d500f9' }
                      ].map((item) => (
                        <button
                          key={item.name}
                          className="highlighter-color-dot"
                          title={item.label}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: item.color,
                            border: '1px solid rgba(255,255,255,0.3)',
                            cursor: 'pointer',
                            padding: 0,
                            boxShadow: '0 0 6px rgba(0,0,0,0.3)',
                            transition: 'transform 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'}
                          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleApplyHighlight(item.name);
                          }}
                        />
                      ))}
                      
                      <div style={{ width: '1px', height: '16px', background: 'var(--border-light)' }}></div>
                      
                      <button
                        title="消しゴム"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ff4d4d',
                          cursor: 'pointer',
                          fontSize: '12px',
                          padding: '2px 4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'transform 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'}
                        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleApplyHighlight('remove');
                        }}
                      >
                        🧹
                      </button>
                    </div>
                  )}

                  <div className="studio-chat-messages">
                    {chatHistory.map((chat, idx) => (
                      <div key={idx} className={`chat-bubble-wrapper ${chat.role === 'user' ? 'user' : 'assistant'}`}>
                        <span className="chat-bubble-sender" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                          <span>{chat.role === 'user' ? '受験生' : 'Gemini AI'}</span>
                          {chat.role !== 'user' && (
                            <button 
                              className="chat-bubble-edit-btn" 
                              onClick={() => handleToggleEdit(idx)}
                              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            >
                              {editingIdx === idx ? '💾 保存' : '✏️ 編集'}
                            </button>
                          )}
                        </span>
                        
                        {editingIdx === idx ? (
                          <div className="chat-bubble" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-medium)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch', width: '100%' }}>
                            <textarea
                              className="chat-bubble-textarea"
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              style={{ width: '100%', minHeight: '150px', background: 'transparent', color: '#fff', border: 'none', outline: 'none', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', lineHeight: '1.6' }}
                              placeholder="解答を編集します。==テキスト== で蛍光筆でハイライトできます。"
                            />
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '3px 8px', fontSize: '11px' }}
                                onClick={() => setEditingIdx(-1)}
                              >
                                キャンセル
                              </button>
                              <button 
                                className="btn btn-primary" 
                                style={{ padding: '3px 8px', fontSize: '11px' }}
                                onClick={() => handleSaveEdit(idx)}
                              >
                                保存
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="chat-bubble"
                            style={{ cursor: highlighterMode ? 'text' : 'default' }}
                            onMouseUp={(e) => handleTextSelection(idx, e)}
                          >
                            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(chat.content) }} />
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
                        )}
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Attachment indicator */}
                  {codebookPhotos.length > 0 && (
                    <div className="attachment-indicator-bar animate-fade-in">
                      <span>📎 メッセージと同時に送信する六法全書写真 ({codebookPhotos.length} 枚)：</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {codebookPhotos.map((src, idx) => (
                          <div key={idx} style={{ position: 'relative' }}>
                            <img src={src} alt="六法全書" style={{ width: '24px', height: '24px', borderRadius: '2px', objectFit: 'cover' }} />
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
                      placeholder="質問を入力してください... 六法全書の写真を添付してAIの誤りを正せます"
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
                    ← 戻る (問題の編集)
                  </button>
                  <button className="btn btn-primary" onClick={() => setCurrentStep(3)}>
                    次へ (分類して保存) →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: CATEGORIZATION AND CONFIRM SAVE */}
            {currentStep === 3 && (
              <div className="studio-step-content animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Step 3: 論点の選択と保存確認</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  この問題に対応する論点を選択してください。選択した論点にバインドされ、ダッシュボードに表示されます。
                </p>

                {/* Point Selection Suggest Search */}
                <div className="form-group suggest-search-container" style={{ marginTop: '20px' }}>
                  <label className="form-label">🔍 保存先論点タグの選択 (必須)</label>
                  <input 
                    type="text" 
                    className="search-input"
                    placeholder="論点キーワードまたは科目名で検索（例：無権代理）..."
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
                          一致する論点タグが見つかりません
                        </div>
                      )}
                    </div>
                  )}
                  {selectedPointId && (
                    <div style={{ fontSize: '12px', color: 'var(--accent-cyan)', marginTop: '4px' }}>
                      ✓ 保存先に選定されました：<strong>{getShortPointName(allPoints.find(p => p.id === selectedPointId)?.name)}</strong>
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
                    <span className="priority-label-bold">⭐「優先復習」の重要問題としてマークする</span>
                    <p className="priority-subtext" style={{ margin: 0 }}>
                      チェックを入れると、この問題がダッシュボード上で黄色のネオン枠で強調表示され、試験直前のクイックフィルターとラストスパートに役立ちます。
                    </p>
                  </div>
                </div>

                {/* Navigation Actions */}
                <div className="studio-actions" style={{ marginTop: '40px' }}>
                  <button className="btn btn-secondary" onClick={() => setCurrentStep(2)}>
                    ← 戻る (対話校正)
                  </button>
                  <button 
                    className="btn btn-accent" 
                    onClick={handleSaveQuestion}
                    disabled={!selectedPointId}
                  >
                    💾 保存してダッシュボードに統合
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
