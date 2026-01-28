# Papers MCP 设计文档

## 设计理念

参考 Context7 的设计模式：**两步式检索架构**

```
用户问题 → 解析标识符 → 查询内容 → 返回结果
```

这种模式的优势：
- 将"发现"与"获取"分离，降低单次调用复杂度
- 标准化标识符便于缓存和引用
- AI 可以在解析阶段做出智能选择

---

## 工具设计

### 工具一：resolve-paper-id

**目的**：将论文名称、作者、关键词解析为 arxiv ID，并返回匹配的论文列表。

**Description 设计**（供 AI 理解）：

```
Resolves a paper title, author name, or search query to a arxiv ID and returns matching papers.

You MUST call this function before 'query-paper' to obtain a valid arxiv ID
UNLESS the user explicitly includes the arxiv ID in the query

Uses arXiv query syntax (Lucene-style field prefixes) to search. For example `abs:"attention mechanism" AND submittedDate:[202301010000 TO 202312312359]` or `all:2512.16906`. Prefer `all:` to maximize coverage.

IMPORTANT: Do not call this tool more than 3 times per question. If you cannot
find what you need after 3 calls, use the best result you have.
```

**参数设计**：

| 参数 | 类型 | 必填 | Description |
|------|------|------|-------------|
| `query` | string | 是 | Paper title, author name, or keywords to search for. |

**返回格式设计**：

```
Available Papers:

Each result includes:
- Title: Full paper title
- Arxiv ID: arxiv identifier (format: arxiv:XXXX.XXXXX)
- Authors: List of authors
- Year: Publication year
- Category: Primary subject category (e.g., cs.CV, cs.CL)
- Comment: Author comments (page count, conference acceptance, code links)
- Journal/DOI: Publication venue and DOI if available
- Abstract: Brief summary of the paper

----------

- Title: Attention Is All You Need
- Arxiv ID: arxiv:1706.03762
- Authors: Vaswani, Shazeer, Parmar, et al.
- Year: 2017
- Category: cs.CL
- Comment: 15 pages, 5 figures
- Journal/DOI: NeurIPS 2017
- Abstract: The dominant sequence transduction models are based on complex...
```

---

### 工具二：query-paper

**目的**：从 Papers MCP 检索论文的具体内容，包括摘要、方法、结果、引用等。

**Description 设计**：

```
Retrieves detailed content from a specific academic paper with arxivID

Call this tool if information returned from `resolve-paper-id` is not sufficient and detailed paper content is required. Prefer this tool than fetching webpages or downloading PDFs as it's more accurate and is in markdown format.

This tool can extract paper content in different level:
- "abstract": Title, author list and abstract for quick preview
- "body": Abstract as well as main body of the paper. Default option for in-depth understanding of the paper.
- "appendix": Appendix section
- "all": abstract, body, references and appendix. May return a lengthy document.
```

**参数设计**：

| 参数 | 类型 | 必填 | Description |
|------|------|------|-------------|
| `arxivID` | string | 是 | arxivID ID (e.g., 'arxiv:1706.03762') retrieved from 'resolve-paper-id'. |
| `level` | enum | 否 | Level of content: "abstract", "body"(default), "appendix" and "all" |


**resolve-paper-id 失败**：

```
No related papers found, please use a less specific query term or use `all:` query prefix to maximize coverage.
```

**内容不可用情况**：

```
Full text is not available, please use other tools to access the full text.
```

