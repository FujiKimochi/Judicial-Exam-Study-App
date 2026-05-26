export const INITIAL_SUBJECTS = [
  { id: 'civ', name: '民法' },
  { id: 'crim', name: '刑法' },
  { id: 'const', name: '憲法' },
  { id: 'comm', name: '商法' },
  { id: 'civ-proc', name: '民事訴訟法' },
  { id: 'crim-proc', name: '刑事訴訟法' },
  { id: 'admin', name: '行政法' }
];

export const INITIAL_POINTS = [
  // 民法
  { id: 'civ-1', subjectId: 'civ', name: '無權代理與表見代理' },
  { id: 'civ-2', subjectId: 'civ', name: '消滅時效之起算點與中斷' },
  { id: 'civ-3', subjectId: 'civ', name: '物權變動與登記對抗要件' },
  { id: 'civ-4', subjectId: 'civ', name: '瑕疵擔保責任（買賣契約）' },
  { id: 'civ-5', subjectId: 'civ', name: '不當得利之返還範圍' },
  { id: 'civ-6', subjectId: 'civ', name: '共同侵權行為與求償權' },

  // 刑法
  { id: 'crim-1', subjectId: 'crim', name: '正當防衛與急迫不正侵害' },
  { id: 'crim-2', subjectId: 'crim', name: '緊急避難與法益權衡' },
  { id: 'crim-3', subjectId: 'crim', name: '故意與事實認識錯誤（錯誤論）' },
  { id: 'crim-4', subjectId: 'crim', name: '共同正犯之因果關係與共謀' },
  { id: 'crim-5', subjectId: 'crim', name: '不能犯與未遂犯之區別' },
  { id: 'crim-6', subjectId: 'crim', name: '教唆犯之從屬性原則' },

  // 憲法
  { id: 'const-1', subjectId: 'const', name: '平等原則與合理差別待遇' },
  { id: 'const-2', subjectId: 'const', name: '信教自由與政教分離原則' },
  { id: 'const-3', subjectId: 'const', name: '表現自由之雙重基準與事前審查' },
  { id: 'const-4', subjectId: 'const', name: '生存權與健康最低限度生活' },
  { id: 'const-5', subjectId: 'const', name: '司法權之界限與統治行為論' },
  { id: 'const-6', subjectId: 'const', name: '違憲審查之對象與基準' },

  // 商法
  { id: 'comm-1', subjectId: 'comm', name: '股東會決議之撤銷與無效' },
  { id: 'comm-2', subjectId: 'comm', name: '董事之忠實義務與善管注意義務' },
  { id: 'comm-3', subjectId: 'comm', name: '公司設立登記與表見代表董事' },
  { id: 'comm-4', subjectId: 'comm', name: '票據抗辯與善意取得' },
  { id: 'comm-5', subjectId: 'comm', name: '保險契約之告知義務與惡意' },
  { id: 'comm-6', subjectId: 'comm', name: '發行新股與不公正發行' },

  // 民事訴訟法
  { id: 'civ-proc-1', subjectId: 'civ-proc', name: '管轄協議之效力與專屬管轄' },
  { id: 'civ-proc-2', subjectId: 'civ-proc', name: '當事人適格與訴訟擔當' },
  { id: 'civ-proc-3', subjectId: 'civ-proc', name: '訴訟標的之確定與舊/新實體法說' },
  { id: 'civ-proc-4', subjectId: 'civ-proc', name: '重複起訴之禁止與既判力時之界限' },
  { id: 'civ-proc-5', subjectId: 'civ-proc', name: '處分權主義與訴之變更' },
  { id: 'civ-proc-6', subjectId: 'civ-proc', name: '辯論主義與主張責任、舉證責任' },

  // 刑事訴訟法
  { id: 'crim-proc-1', subjectId: 'crim-proc', name: '強制處分與任意處分之界限' },
  { id: 'crim-proc-2', subjectId: 'crim-proc', name: '現行犯逮捕與緊急逮捕之要件' },
  { id: 'crim-proc-3', subjectId: 'crim-proc', name: '搜查扣押之令狀主義與例外' },
  { id: 'crim-proc-4', subjectId: 'crim-proc', name: '自白任意性原則與法則' },
  { id: 'crim-proc-5', subjectId: 'crim-proc', name: '傳聞法則與傳聞例外之適用' },
  { id: 'crim-proc-6', subjectId: 'crim-proc', name: '上訴之利益與一部上訴' },

  // 行政法
  { id: 'admin-1', subjectId: 'admin', name: '行政處分之概念與公權力性' },
  { id: 'admin-2', subjectId: 'admin', name: '行政裁量之瑕疵與司法審查' },
  { id: 'admin-3', subjectId: 'admin', name: '行政程序之瑕疵與處分效力' },
  { id: 'admin-4', subjectId: 'admin', name: '行政處罰與秩序罰之處罰對象' },
  { id: 'admin-5', subjectId: 'admin', name: '國家賠償法第1條之職務違法性' },
  { id: 'admin-6', subjectId: 'admin', name: '行政訴訟之撤銷訴訟原告適格' }
];

// Initial mock question cards
export const INITIAL_QUESTIONS = [
  {
    id: 'q-mock-1',
    pointId: 'civ-1', // 無權代理與表見代理
    screenshots: [
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300"><rect width="100%" height="100%" fill="%231a1a2e"/><text x="50%" y="40%" font-family="sans-serif" font-size="20" fill="%23e94560" dominant-baseline="middle" text-anchor="middle">【民法 選擇題 第12題】</text><text x="50%" y="60%" font-family="sans-serif" font-size="16" fill="%23ffffff" dominant-baseline="middle" text-anchor="middle">A將不動產登記在B名下，B擅自將該不動產賣給善意第三人C...</text></svg>'
    ],
    prompt: '請幫我特別著重在「民法第94條表見代理的外部授權表現」與「登記名義的信賴保護」作比較。',
    aiResponse: `### 【民法第110條與第117條：表見代理與表現授權之關聯性解析】

本題核心爭點在於**表見代理（表現代理）之成立要件**以及**登記信賴保護**的交互作用。

#### 1. 條文依據與規範要旨
* **民法第109條（代理權消滅後之表見代理）**、**第110條（無權代理人之責任）**：
  無權代理人以他人名義所為之法律行為，原則上非經本人承認，對本人不生效力。然而若本人有「表見事實」（例如交付印鑑、同意登記名義等），使第三人信賴其有代理權，則應負授權人之責任。
* **不動產物權登記信賴保護（民法第759條之1第2項）**：
  不動產物權經登記之人，於信賴登記而為法律行為之第三人，其登記效力不因原登記有瑕疵而受影響。

#### 2. 本案判例主旨與實例解析
本題中，A將不動產「借名登記」於B名下，B以登記名義人身份將其出售予第三人C：
* **處分權層面**：B並非真正所有權人，其將不動產出售予C屬於**無處分權人處分他人財產**（非無權代理，因為B是以自己名義出售，而非以A的名義）。
* **信賴保護適用**：第三人C因信賴地政機關之登記名義，與B進行交易。此時適用**民法第759條之1第2項之善意取得**。C可確定取得該不動產所有權，A僅得向B主張不當得利或侵權行為損害賠償。
* **與表見代理之區別**：
  * **表見代理**：代理人以「本人A」之名義與C交易，但本人有可歸責之表見外觀。
  * **借名登記處分**：受託人以「自己（B）」之名義與C交易，適用登記名義信賴之保護。

#### 3. 實例說明表
| 交易樣態 | 行為名義人 | 適用條文 | 本人責任與對抗關係 |
| :--- | :--- | :--- | :--- |
| **無權代理** | 代理人以「本人」名義 | 民法第170條 | 本人承認才生效，否則無效。 |
| **表見代理** | 代理人以「本人」名義 | 民法第169條 | 本人需負授權人責任，契約直接對本人生效。 |
| **無權處分** | 行為人以「自己」名義 | 民法第118條、759條之1 | 善意第三人受登記信賴保護，直接取得所有權。 |`,
    chatHistory: [
      {
        role: 'user',
        content: '如果C在交易前其實聽說過這是借名登記的財產，這樣還算善意嗎？'
      },
      {
        role: 'assistant',
        content: `在此情況下，C將**無法主張善意取得**。

根據我國民法與最高法院判例：
1. **「善意」之定義**：指不知悉該登記名義與真實權利狀態不符。若第三人C在交易前已經「聽說過」或明知該財產為借名登記（即知悉B非真正所有權人），則在法律上被認定為**惡意**。
2. **舉證責任**：原則上推定第三人為善意，真正權利人A若主張C為惡意，必須負舉證責任（例如證明C知情交易背後的借名關係）。
3. **法律後果**：若A證明C為惡意，則該無權處分行為因A拒絕承認而無效，C無法取得所有權。`
      }
    ],
    referenceLinks: [
      { title: '中華民國法務部：表見代理與無權處分之區別研討', url: 'https://law.moj.gov.tw/' },
      { title: '法律百科：什麼是借名登記？登記名義人賣掉房子有用嗎？', url: 'https://www.legis-pedia.com/' }
    ],
    isPriority: true,
    createdAt: '2026-05-26T12:00:00.000Z'
  },
  {
    id: 'q-mock-2',
    pointId: 'crim-1', // 正當防衛與急迫不正侵害
    screenshots: [
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300"><rect width="100%" height="100%" fill="%231a1a2e"/><text x="50%" y="40%" font-family="sans-serif" font-size="20" fill="%23e94560" dominant-baseline="middle" text-anchor="middle">【刑法 選擇題 第5題】</text><text x="50%" y="60%" font-family="sans-serif" font-size="16" fill="%23ffffff" dominant-baseline="middle" text-anchor="middle">甲見乙持刀向其砍來，慌亂中撿起路邊木棍將乙打傷...</text></svg>'
    ],
    prompt: '請幫我解析此防衛行為是否過當，以及防衛意思的必要性。',
    aiResponse: `### 【刑法第23條：正當防衛成立要件與防衛過當解析】

本題探討的是刑法阻卻違法事由中**正當防衛（自主防衛）**的客觀與主觀要件。

#### 1. 條文依據
> **中華民國刑法第23條**：
> 「對於現在不法之侵害，出自防衛自己或他人權利之行為，不罰。但防衛行為過當者，得減輕或免除其刑。」

#### 2. 正當防衛之成立要件
* **客觀要件**：
  1. **現在**：侵害必須是正在發生或迫在眉睫（尚未結束）。
  2. **不法**：侵害行為必須違反法律秩序（例如攻擊行為、違法逮捕等）。
  3. **侵害**：對人身、財產、自由等權利的侵害。
* **主觀要件**：
  * **防衛意思**：行為人主觀上必須是「為了防衛權利」而發起對抗。若主觀上出於互毆、挑釁防衛或單純報復，則不成立正當防衛（此即主觀阻卻違法事由之必要性）。
* **防衛行為之適當性與必要性（最小侵害原則）**：
  * 防衛手段必須是有效且造成最小損害的方法。若有其他同樣有效且損害更小的手段，卻選擇了過激手段，即屬**防衛過當**。

#### 3. 本案分析
* **侵害的現在性與不法性**：乙持刀砍向甲，構成「現在不法之侵害」，甲生命受嚴重威脅。
* **手段必要性**：甲情急之下撿起木棍將乙打傷，相較於乙持刀的致命威脅，木棍阻擋屬合理且相當之手段，通常不被認定為防衛過當，屬**正當防衛**，不罰。
* **防衛意思之爭議**：若甲與乙本來就在進行決鬥（互毆），則雙方皆無防衛意思，甲不能主張正當防衛。`,
    chatHistory: [
      {
        role: 'user',
        content: '如果是故意挑釁對方來打自己，然後再打傷對方，可以主張正當防衛嗎？'
      },
      {
        role: 'assistant',
        content: `這種情況在法律上稱為**「挑釁防衛」（Abuse of Right of Self-Defense）**，一般**不能**主張正當防衛：

1. **挑釁防衛的本質**：行為人故意激怒或誘使他人對自己發起不法侵害，藉此作為藉口去傷害對方。
2. **法律評價**：
   * **故意挑釁（以防衛為藉口進行不法侵害）**：如果行為人是為了打傷對方而故意誘使對方先動手，此時主觀上並無真正的「防衛意思」，而是藉由挑釁來遂行其傷害故意，因此不具備防衛意思，**不成立正當防衛**。
   * **過失挑釁/權利濫用**：即使具有防衛意思，但因為是自己行為招致侵害，防衛權應受到限制（通常需要先採取迴避、退讓手段，非不得已不能進行強力反擊，否則被認定為違背社會倫理的防衛濫用）。`
      }
    ],
    referenceLinks: [
      { title: '司法院公報：正當防衛與互毆之區別判例', url: 'https://www.judicial.gov.tw/' }
    ],
    isPriority: false,
    createdAt: '2026-05-25T14:30:00.000Z'
  }
];
