// Simulated Gemini API service with Google Search Tool capabilities and multi-modal inputs

// Helper to delay and simulate network API latency
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const generateInitialAnalysis = async (screenshots, customPrompt) => {
  await delay(1500); // Simulate API call

  const baseResponse = `### 【生成解析結果】
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
};

export const chatWithAi = async (chatHistory, userMessage, attachments = []) => {
  await delay(1000); // Simulate API latency
  
  if (attachments && attachments.length > 0) {
    // Anti-hallucination flow
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

  // Normal chat response
  const responses = [
    `針對您的問題，依據司法預備考試的命題大綱，此處是複習重點。建議特別注意「主觀要件」與「客觀事實」之間的因果關係。`,
    `這個問題切中要害！在歷屆試題中，這裡通常會以複數選項來誘騙考生。請記住，實務見解與學說見解在此處有分歧，選擇題請以實務見解（判例、決議）為準。`,
    `好的，根據您的問題，我們可以從法條的構成要件著手分析：首先是主體是否適格，其次是行為是否符合構成要件，最後看有無阻卻違法或阻卻責任事由。`
  ];
  
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];
  return {
    role: 'assistant',
    content: randomResponse
  };
};

export const searchExternalLinks = async (query) => {
  await delay(1200); // Simulate search latency
  
  // Return realistic mock search results with authoritative links
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
