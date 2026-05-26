import React, { useState, useEffect } from 'react';
import { getSubjects, getPoints, getQuestions, togglePriority, deleteQuestion, getPointStats } from '../services/db';

// Simple lightweight Markdown renderer to support key constructs without dependencies
export const renderMarkdown = (text) => {
  if (!text) return '';
  let html = text;

  // Escaping HTML characters
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers (e.g., ### Title)
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

  // Bold (**text**)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italics (*text*)
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Code (\`code\`)
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');

  // Blockquotes (> text)
  html = html.replace(/^&gt;\s*(.*?)$/gm, '<blockquote>$1</blockquote>');

  // Tables
  const lines = html.split('\n');
  let inTable = false;
  let tableRows = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableRows = [line];
      } else {
        tableRows.push(line);
      }
      lines[i] = ''; // Clear line as we will insert the table HTML later
    } else {
      if (inTable) {
        // Render the accumulated table rows
        let tableHtml = '<table>';
        // Check if there is a divider row (e.g. | :--- | :--- |)
        const hasDivider = tableRows.length > 1 && tableRows[1].includes('---');
        const startIndex = hasDivider ? 2 : 1;
        
        // Header
        const headers = tableRows[0].split('|').map(s => s.trim()).filter(s => s);
        tableHtml += '<thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
        
        // Body
        for (let j = startIndex; j < tableRows.length; j++) {
          const cells = tableRows[j].split('|').map(s => s.trim()).filter(s => s);
          tableHtml += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
        }
        tableHtml += '</tbody></table>';
        
        // Insert table HTML at the position before the table started
        lines[i - tableRows.length] = tableHtml;
        inTable = false;
        tableRows = [];
      }
    }
  }
  html = lines.join('\n');

  // Unordered Lists
  html = html.replace(/^\*\s*(.*?)$/gm, '<li>$1</li>');
  // Wrap list items in <ul>. Clean up adjacent list items.
  html = html.replace(/(<li>.*?<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Paragraphs (double newlines to <p>)
  html = html.replace(/\n\n/g, '</p><p>');
  
  return html;
};

export default function Dashboard({ onGoToStudio, triggerToast }) {
  const [subjects, setSubjects] = useState([]);
  const [points, setPoints] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [stats, setStats] = useState({});

  // Active States
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedPointId, setSelectedPointId] = useState('');
  const [pointSearchQuery, setPointSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState(false);
  const [expandedChatId, setExpandedChatId] = useState('');
  const [lightboxImg, setLightboxImg] = useState(null);

  // Load Data
  const loadData = async () => {
    try {
      const subs = await getSubjects();
      const pts = await getPoints();
      const qsts = await getQuestions();
      const stt = await getPointStats();

      setSubjects(subs);
      setPoints(pts);
      setQuestions(qsts);
      setStats(stt);

      // Default to first subject and point if not set
      if (subs.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(subs[0].id);
      }
    } catch (e) {
      console.error('Failed to load data', e);
      triggerToast('載入資料庫失敗，請確認配置', 'warning');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update selected point when subject changes
  useEffect(() => {
    if (selectedSubjectId) {
      const subjectPoints = points.filter(p => p.subjectId === selectedSubjectId);
      if (subjectPoints.length > 0) {
        setSelectedPointId(subjectPoints[0].id);
      } else {
        setSelectedPointId('');
      }
    }
  }, [selectedSubjectId, points]);

  // Actions
  const handleTogglePriority = async (id) => {
    try {
      const updated = await togglePriority(id);
      setQuestions(updated);
      triggerToast('優先複習狀態已變更', 'warning');
    } catch (e) {
      triggerToast('變更狀態失敗', 'warning');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('確定要刪除這筆複習筆記嗎？')) {
      try {
        const updated = await deleteQuestion(id);
        setQuestions(updated);
        const stt = await getPointStats();
        setStats(stt);
        triggerToast('筆記已刪除', 'success');
      } catch (e) {
        triggerToast('刪除失敗', 'warning');
      }
    }
  };

  // Filters
  const filteredPoints = points.filter(p => {
    if (p.subjectId !== selectedSubjectId) return false;
    if (!pointSearchQuery) return true;
    return p.name.toLowerCase().includes(pointSearchQuery.toLowerCase());
  });

  const activePoint = points.find(p => p.id === selectedPointId);

  const filteredQuestions = questions.filter(q => {
    if (q.pointId !== selectedPointId) return false;
    if (priorityFilter && !q.isPriority) return false;
    return true;
  });

  // Calculate subject-level stored count
  const getSubjectCount = (subId) => {
    const subPoints = points.filter(p => p.subjectId === subId);
    return subPoints.reduce((acc, p) => acc + (stats[p.id] || 0), 0);
  };

  return (
    <div className="dashboard-grid animate-fade-in">
      {/* Sidebar: Tier 2 (Points list) */}
      <aside className="glass-panel points-sidebar">
        <div className="sidebar-title">
          <span>論點清單 (Tier 2)</span>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '4px 10px', fontSize: '12px' }}
            onClick={() => onGoToStudio(selectedPointId)}
          >
            + 新增題目
          </button>
        </div>
        
        <div className="search-input-wrapper">
          <input 
            type="text" 
            className="search-input" 
            placeholder="搜尋此科目論點..." 
            value={pointSearchQuery}
            onChange={(e) => setPointSearchQuery(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="points-list">
          {filteredPoints.length > 0 ? (
            filteredPoints.map(p => (
              <div 
                key={p.id} 
                className={`point-item ${selectedPointId === p.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedPointId(p.id);
                  setExpandedChatId(''); // Reset chat expand
                }}
              >
                <span className="point-name" title={p.name}>{p.name}</span>
                <span className={`point-badge ${selectedPointId === p.id ? 'active' : ''}`}>
                  {stats[p.id] || 0}
                </span>
              </div>
            ))
          ) : (
            <div className="empty-state" style={{ padding: '20px 10px', fontSize: '12px' }}>
              找不到相符論點
            </div>
          )}
        </div>
      </aside>

      {/* Main Content: Tier 1 (Subjects) & Tier 3 (Questions Detail) */}
      <main className="detail-area">
        {/* Tier 1 Subjects Selector */}
        <section className="subjects-tabs">
          {subjects.map(s => {
            const count = getSubjectCount(s.id);
            return (
              <button 
                key={s.id} 
                className={`subject-tab ${selectedSubjectId === s.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedSubjectId(s.id);
                  setPointSearchQuery('');
                }}
              >
                <span className="subject-tab-title">{s.name}</span>
                <span className="subject-tab-count">{count} 題已存</span>
              </button>
            );
          })}
        </section>

        {/* Tier 3 Detail view */}
        <section className="glass-panel" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {activePoint ? (
            <>
              <div className="detail-header">
                <div className="detail-title-info">
                  <span className="detail-subject-tag">
                    {subjects.find(s => s.id === selectedSubjectId)?.name}
                  </span>
                  <h2 className="detail-point-title">{activePoint.name}</h2>
                </div>
                
                <label className="priority-toggle-filter">
                  <input 
                    type="checkbox" 
                    checked={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.checked)}
                  />
                  <span>僅顯示優先複習</span>
                </label>
              </div>

              <div className="questions-list">
                {filteredQuestions.length > 0 ? (
                  filteredQuestions.map(q => (
                    <div 
                      key={q.id} 
                      className={`question-card animate-fade-in ${q.isPriority ? 'priority-high' : ''}`}
                    >
                      {/* Card Actions bar */}
                      <div className="question-card-header">
                        <span className="question-date">
                          儲存時間：{new Date(q.createdAt).toLocaleString('zh-TW', { hour12: false })}
                        </span>
                        <div className="question-actions">
                          <button 
                            className={`card-btn ${q.isPriority ? 'active-priority' : ''}`}
                            title={q.isPriority ? "取消優先複習" : "設為優先複習"}
                            onClick={() => handleTogglePriority(q.id)}
                          >
                            ★
                          </button>
                          <button 
                            className="card-btn delete-btn"
                            title="刪除此筆記"
                            onClick={() => handleDelete(q.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Card Content body */}
                      <div className="question-card-body">
                        {/* Left: Screenshots */}
                        <div className="question-media">
                          <span className="section-label">原始題目截圖</span>
                          {q.screenshots && q.screenshots.map((src, index) => (
                            <div 
                              key={index} 
                              className="question-img-wrapper"
                              onClick={() => setLightboxImg(src)}
                            >
                              <img src={src} alt="題目截圖" className="question-img" />
                              <span className="question-img-label">圖 {index + 1} (點擊放大)</span>
                            </div>
                          ))}
                        </div>

                        {/* Right: AI Analysis */}
                        <div className="question-details">
                          <span className="section-label">Gemini 校正後法律解析</span>
                          <div 
                            className="analysis-md"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(q.aiResponse) }}
                          />

                          {/* External Lawyer Links */}
                          {q.referenceLinks && q.referenceLinks.length > 0 && (
                            <div className="external-links-section">
                              <span className="section-label">外部權威見解與參考連結</span>
                              <div className="links-grid">
                                {q.referenceLinks.map((link, lidx) => (
                                  <a 
                                    key={lidx} 
                                    href={link.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="external-link-pill"
                                  >
                                    🔗 {link.title}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Chat History Drawer */}
                      {q.chatHistory && q.chatHistory.length > 0 && (
                        <div className="chat-history-drawer">
                          <button 
                            className="drawer-toggle"
                            onClick={() => setExpandedChatId(expandedChatId === q.id ? '' : q.id)}
                          >
                            <span>💬 對話歷程與法典佐證檔案 ({q.chatHistory.length} 條對話)</span>
                            <span>{expandedChatId === q.id ? '▲ 收起' : '▼ 展開'}</span>
                          </button>
                          
                          {expandedChatId === q.id && (
                            <div className="drawer-content animate-fade-in">
                              {q.chatHistory.map((chat, cIdx) => (
                                <div 
                                  key={cIdx} 
                                  className={`chat-bubble-wrapper ${chat.role === 'user' ? 'user' : 'assistant'}`}
                                >
                                  <span className="chat-bubble-sender">
                                    {chat.role === 'user' ? '考生' : 'Gemini AI'}
                                  </span>
                                  <div className="chat-bubble">
                                    {chat.content}
                                    {chat.attachments && chat.attachments.length > 0 && (
                                      <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                                        {chat.attachments.map((att, aIdx) => (
                                          <img 
                                            key={aIdx} 
                                            src={att} 
                                            alt="法典佐證" 
                                            style={{ width: '60px', height: '60px', borderRadius: '4px', cursor: 'zoom-in', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }}
                                            onClick={() => setLightboxImg(att)}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <h3>此論點暫無已保存試題</h3>
                    <p>請點擊右上方「+ 新增題目」或前往「工作台」新增題目截圖與生成解析！</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ flex: 1 }}>
              <div className="empty-icon">📂</div>
              <h3>請選擇或建立論點</h3>
              <p>在左側論點清單中點選以查看對應的歷屆試題解析。</p>
            </div>
          )}
        </section>
      </main>

      {/* Lightbox Modal */}
      {lightboxImg && (
        <div className="lightbox" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="放大截圖" className="lightbox-img" />
        </div>
      )}
    </div>
  );
}
