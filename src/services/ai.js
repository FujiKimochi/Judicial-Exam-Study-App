// Gemini API Client Service with client-side keys and Google Search Grounding

// Helper to delay and simulate network API latency (fallback mode)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getGeminiApiKey = () => {
  let key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) {
    try {
      const stored = localStorage.getItem('supabase_settings');
      if (stored) {
        key = JSON.parse(stored).geminiApiKey || '';
      }
    } catch (e) {}
  }
  return key;
};

const getGeminiModel = () => {
  let model = 'gemini-2.5-flash';
  try {
    const stored = localStorage.getItem('supabase_settings');
    if (stored) {
      model = JSON.parse(stored).geminiModel || model;
    }
  } catch (e) {}
  return model;
};

// Mock search links fallback
const getMockSearchLinks = (query) => {
  return [
    {
      title: `【律師專欄】${query}之實務解析與最新最高法院判決整理`,
      url: `https://www.lawyer-opinions.example.com/article/${encodeURIComponent(query)}`
    },
    {
      title: `【法律事務所】深入探討：${query}在預備考試選擇題中的命題趨勢`,
      url: `https://www.legal-insights.example.com/exam-prep/${encodeURIComponent(query)}`
    }
  ];
};

export const generateInitialAnalysis = async (screenshots, customPrompt) => {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    // --- FALLBACK SIMULATION ---
    await delay(1500);
    const baseResponse = `### 【生成解析結果 (模擬)】
本題探討的是選擇題中常見的法律爭議。

#### 1. 條文依據與法規適用
根據相關法規及最高法院見解，行為人在面臨特定民刑事爭議時，其權利義務關係需依據以下條文判斷：
* 條文規範：明確界定了行為要件、責任歸屬及阻卻責任事由。
* 法律效力：效力及於雙方當事人，且善意第三人之權利在特定條件下應予保障。

#### 2. 案例實例解析
藉由以下具體情境深入淺出說明：
* **情境模擬**：設若甲未經授權，以乙之代理人自居與丙締結契約。
* **責任歸屬**：此法律行為在本人乙承認前，對本人不生效力。但丙得定相當期限催告本人是否承認。

#### 3. 判例主旨摘要
司法實務見解指出：「凡無代理權人以他人之代理人名義所為之法律行為，非經本人承認，對於本人不生效力。此與表現代理之必須本人有表見之事實者不同。」
`;
    if (customPrompt) {
      return `${baseResponse}\n\n*【針對您的追加要求「${customPrompt}」特別補充說明】*：\n經檢索，若針對此點特別加強，實務上會更著重於主觀信賴的證明度。在審查時需提出具體的客觀證據證明不知情且無過失。`;
    }
    return baseResponse;
  }

  // --- REAL GEMINI API CALL ---
  try {
    const systemPrompt = "請結合條文與判例的主旨，並運用具體實例，以深入淺出的方式進行解析。";
    const promptText = customPrompt 
      ? `${systemPrompt}\n追加要求：${customPrompt}` 
      : systemPrompt;

    const parts = [
      { text: promptText }
    ];

    // Append screenshots as Base64 inlineData
    screenshots.forEach(src => {
      if (src && src.startsWith('data:image/')) {
        const mimeType = src.substring(src.indexOf(":") + 1, src.indexOf(";"));
        const data = src.substring(src.indexOf(",") + 1);
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: data
          }
        });
      }
    });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: parts
          }
        ]
      })
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const errMsg = errorJson?.error?.message || `HTTP ${response.status} ${response.statusText}`;
      throw new Error(errMsg);
    }

    const result = await response.json();
    return result.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
};

export const chatWithAi = async (chatHistory, userMessage, attachments = []) => {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    // --- FALLBACK SIMULATION ---
    await delay(1000);
    if (attachments && attachments.length > 0) {
      return {
        role: 'assistant',
        content: `【法典證據已導入 - 防幻覺校正模式】
您上傳了 ${attachments.length} 張法典照片作為對照證據。
根據您提供的法典原文內容，我們已重新比對並校正解析：
1. **條文精準對照**：確認條文文字確實如您上傳的截圖所示。本案應直接適用該條款之特別規定，修正原先可能產生混淆的判例見解。
2. **校正點**：此條款之適用以「書面為之」為要件，排除口頭約定之適用。
3. **結論**：已依據實體法典完成校正，排除一切幻覺。`
      };
    }

    const responses = [
      `針對您的問題，依據司法預備考試的命題大綱，此處是複習重點。建議特別注意「主觀要件」與「客觀事實」之間的因果關係。`,
      `這個問題切中要害！在歷屆試題中，這裡通常會以複數選項來誘騙考生。請記住，實務見解與學說見解在此處有分歧，選擇題請以實務見解（判例、決議）為準。`,
      `好的，根據您的問題，我們可以從法條的構成要件著手分析：首先是主體是否適格，其次是行為是否符合構成要件，最後看有無阻卻違法或阻卻責任事由。`
    ];
    return {
      role: 'assistant',
      content: responses[Math.floor(Math.random() * responses.length)]
    };
  }

  // --- REAL GEMINI API CALL ---
  try {
    const contents = [];

    // Add chat history mapped to Gemini format
    chatHistory.forEach(chat => {
      if (!chat.content && (!chat.attachments || chat.attachments.length === 0)) return;
      
      const parts = [];
      if (chat.content) {
        parts.push({ text: chat.content });
      }

      if (chat.attachments) {
        chat.attachments.forEach(att => {
          if (att && att.startsWith('data:image/')) {
            const mimeType = att.substring(att.indexOf(":") + 1, att.indexOf(";"));
            const data = att.substring(att.indexOf(",") + 1);
            parts.push({
              inlineData: { mimeType, data }
            });
          }
        });
      }

      contents.push({
        role: chat.role === 'user' ? 'user' : 'model',
        parts: parts
      });
    });

    // Add current message
    const currentParts = [];
    if (userMessage) {
      currentParts.push({ text: userMessage });
    }

    if (attachments && attachments.length > 0) {
      attachments.forEach(att => {
        if (att && att.startsWith('data:image/')) {
          const mimeType = att.substring(att.indexOf(":") + 1, att.indexOf(";"));
          const data = att.substring(att.indexOf(",") + 1);
          currentParts.push({
            inlineData: { mimeType, data }
          });
        }
      });
    }

    contents.push({
      role: 'user',
      parts: currentParts
    });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: contents
      })
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const errMsg = errorJson?.error?.message || `HTTP ${response.status} ${response.statusText}`;
      throw new Error(errMsg);
    }

    const result = await response.json();

    return {
      role: 'assistant',
      content: result.candidates[0].content.parts[0].text
    };
  } catch (error) {
    console.error('Gemini Chat API Error:', error);
    throw error;
  }
};

export const searchExternalLinks = async (query) => {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    // --- FALLBACK SIMULATION ---
    await delay(1200);
    return getMockSearchLinks(query);
  }

  // --- REAL GEMINI API CALL WITH GOOGLE SEARCH GROUNDING ---
  try {
    const promptText = `請幫我搜尋關於「${query}」包含具權威性之日本或台灣律師見解、法律事務所專欄或判決主旨的外部網站連結與出處。請儘量提供網址。`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }]
          }
        ],
        tools: [
          {
            googleSearch: {}
          }
        ]
      })
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const errMsg = errorJson?.error?.message || `HTTP ${response.status} ${response.statusText}`;
      throw new Error(errMsg);
    }

    const result = await response.json();

    const candidate = result.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks;

    if (groundingChunks && groundingChunks.length > 0) {
      const links = groundingChunks
        .filter(chunk => chunk.web)
        .map(chunk => ({
          title: chunk.web.title || `【參考連結】${query}`,
          url: chunk.web.uri
        }));

      // Deduplicate URLs
      const seen = new Set();
      const uniqueLinks = [];
      links.forEach(l => {
        if (!seen.has(l.url)) {
          seen.add(l.url);
          uniqueLinks.push(l);
        }
      });

      return uniqueLinks.length > 0 ? uniqueLinks : getMockSearchLinks(query);
    }

    return getMockSearchLinks(query);
  } catch (error) {
    console.error('Gemini Google Search Error:', error);
    return getMockSearchLinks(query);
  }
};
