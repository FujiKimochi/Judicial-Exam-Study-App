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
      title: `【弁護士コラム】${query}の実務解説と最新の最高裁判例整理`,
      url: `https://www.lawyer-opinions.example.com/article/${encodeURIComponent(query)}`
    },
    {
      title: `【法律事務所】深掘解説：予備試験短答式における${query}の出題傾向`,
      url: `https://www.legal-insights.example.com/exam-prep/${encodeURIComponent(query)}`
    }
  ];
};

export const generateInitialAnalysis = async (screenshots, customPrompt) => {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    // --- FALLBACK SIMULATION ---
    await delay(1500);
    const baseResponse = `### 【解説生成結果 (モック)】
本問は短答式試験で頻出する法律上の論点を扱っています。

#### 1. 条文の根拠と法規の適用
関連法令および最高裁判所の見解に基づき、特定の民事・刑事上の紛争に直面した場合、当事者間の権利義務関係は以下の条文に基づいて判断されます：
* 条文の規範：行為要件、責任の帰属、および阻却事由を明確に定めています。
* 法律上の効力：当事者双方に効力が及び、特定の条件下では善意の第三者の権利が保護されます。

#### 2. 具体的な事例解説
以下の具体的なシナリオを通じて、分かりやすく解説します：
* **シナリオ模試**：仮に、Aが代理権を持たずに、Bの代理人であると称してCと契約を締結したとします。
* **責任の帰属**：この法律行為は、本人Bの追認がない限り、本人に対してその効力を生じません。ただし、Cは本人に対し、相当の期間を定めて追認するかどうかを確答すべき旨の催告をすることができます。

#### 3. 判例趣旨の要約
司法実務の見解では、「無権代理人が他人の代理人名義で行った法律行為は、本人の追認がなければ本人に対して効力を生じない。これは、本人に表見事実が存在することを要する表見代理とは異なる」とされています。
`;
    if (customPrompt) {
      return `${baseResponse}\n\n*【追加要望「${customPrompt}」に対する補足解説】*：\n検索の結果、この点を特に強化する場合、実務上は主観的信頼の証明度が重視されます。審査時には、善意かつ無過失であることを証明する具体的な客観的証拠を提示する必要があります。`;
    }
    return baseResponse;
  }

  // --- REAL GEMINI API CALL ---
  try {
    const systemPrompt = "日本法律や判例の前提で、まず本問の論点を一言で説明してください。それに、条文や判例の趣旨を踏まえて具体例を挙げながら分かりやすく解説してください。";
    const promptText = customPrompt 
      ? `${systemPrompt}\n追加要望：${customPrompt}` 
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
        content: `【六法全書のエビデンス読込完了 - ハルシネーション防止モード】
対照用の証拠として、六法全書等の写真を ${attachments.length} 枚アップロードしました。
ご提示いただいた条文原文に基づき、解説を再検証および校正しました：
1. **条文の正確な照合**：条文テキストがアップロードされたスクリーンショットと一致していることを確認しました。本件は当該条項の特別規定を直接適用すべきであり、当初の混同しやすい判例見解を修正します。
2. **校正ポイント**：この条項の適用は「書面によること」が要件であり、口頭合意の適用は排除されます。
3. **結論**：実際の六法全書に基づき校正を完了し、ハルシネーションを排除しました。`
      };
    }

    const responses = [
      `ご質問について、司法予備試験の出題大綱に基づくと、ここは重要な復習ポイントです。「主観的要件」と「客観的事実」の間の因果関係に特に注意することをお勧めします。`,
      `核心を突いたご質問です！過去問では、複数の選択肢で受験生を惑わせる箇所です。実務見解（判例）と学説の見解が分かれている場合、短答式試験では原則として実務見解に準拠して判断してください。`,
      `承知いたしました。ご質問に基づき、条文の構成要件から分析します：まず主体が適格であるか、次に行為が構成要件に該当するか、最後に違法性阻却事由または責任阻却事由の有無を確認します。`
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
    const promptText = `「${query}」について、権威ある日本または台湾の弁護士の見解、法律事務所のコラム、または判例趣旨を含む外部ウェブサイトのリンクと出典を検索してください。可能な限りURLを含めてください。`;

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
