# Papers MCP - Academic Papers for Any Prompt

[![NPM Version](https://img.shields.io/npm/v/papers-mcp)](https://www.npmjs.com/package/papers-mcp) [![MIT licensed](https://img.shields.io/npm/l/papers-mcp)](./LICENSE)

## Why Papers MCP?

LLMs struggle with academic papers. You get:

- Hallucinated paper titles and authors that don't exist
- Inability to access paper content beyond abstracts
- Garbled math equations and broken formatting from PDFs
- No way to search for relevant papers by topic

## With Papers MCP

Papers MCP searches arXiv and extracts full paper content as clean Markdown — directly into your LLM's context.

```txt
What are the key contributions of the "Attention Is All You Need" paper?
```

```txt
Find recent papers on diffusion models for image generation and summarize their methods.
```

Papers MCP fetches the actual paper content with properly formatted math equations, figures, tables, and citations. No more hallucinated references or broken PDFs.

## Installation

### Claude Code

```sh
claude mcp add papers-mcp -- npx papers-mcp
```

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "papers": {
      "command": "npx",
      "args": ["papers-mcp"]
    }
  }
}
```

### Cursor

Add to your Cursor MCP config (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "papers": {
      "command": "npx",
      "args": ["papers-mcp"]
    }
  }
}
```

## Available Tools

Papers MCP provides two tools following a two-step retrieval pattern:

### `resolve-paper-id`

Resolves a paper title, author name, or search query to arXiv IDs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Paper title, author name, or arXiv search query |

Supports arXiv query syntax (Lucene-style field prefixes):
- `all:transformer attention` - Search all fields
- `ti:"attention is all you need"` - Search by title
- `au:vaswani` - Search by author
- `abs:"large language model"` - Search in abstract
- `cat:cs.CL` - Search by category

### `extract-paper`

Retrieves detailed content from a paper using its arXiv ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `arxivId` | string | Yes | arXiv ID (e.g., `arxiv:1706.03762` or `1706.03762`) |
| `level` | enum | No | Level of detail to extract (default: `body`) |

Extraction levels:
- `abstract` - Title, authors, and abstract only
- `body` - Abstract + main body sections (default)
- `appendix` - Appendix sections only
- `all` - Full paper including references and appendix

## Features

- **Clean Markdown output** - Properly formatted with headers, lists, and code blocks
- **Math equation support** - LaTeX equations converted to `$inline$` and `$$block$$` format
- **Figures and tables** - Preserved with captions and proper formatting
- **Citations** - Inline citations linked to references
- **Fallback support** - Tries ar5iv first, falls back to arxiv.org/html

## Example Usage

Ask your LLM:

```txt
Find the original GPT paper and explain the architecture.
```

The LLM will:
1. Call `resolve-paper-id` with query "GPT language model"
2. Get back matching papers with arXiv IDs
3. Call `extract-paper` with the relevant arXiv ID
4. Receive the full paper content in Markdown
5. Answer your question with accurate information

## License

MIT
