# Papers MCP

[![NPM Version](https://img.shields.io/npm/v/papers-mcp)](https://www.npmjs.com/package/papers-mcp) [![MIT licensed](https://img.shields.io/npm/l/papers-mcp)](./LICENSE)

An MCP server for searching, extracting, and exploring academic papers with citation-aware ranking.

- Search arXiv with Lucene query syntax
- Extract paper content as clean Markdown with math, figures, and tables
- Citation-ranked search with venue, year filters, and pagination
- Citation graph traversal and related paper discovery

## Installation

### Claude Code

```sh
claude mcp add papers-mcp -- npx papers-mcp
```

### Claude Desktop / Cursor / Windsurf

Add to your MCP client config:

```json
{
  "mcpServers": {
    "papers-mcp": {
      "command": "npx",
      "args": ["-y", "papers-mcp"]
    }
  }
}
```

Config file locations:
- Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Cursor: `~/.cursor/mcp.json`
- Windsurf: `~/.codeium/windsurf/mcp_config.json`

## Tools

### `resolve-arxiv-id`

Search arXiv by title, author, or Lucene query to resolve paper IDs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Paper title, author name, or arXiv search query |

Supports arXiv Lucene-style field prefixes: `ti:`, `au:`, `abs:`, `cat:`, `all:`.

### `extract-paper`

Extract paper content as clean Markdown with math notation preserved.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `arxivId` | string | Yes | arXiv ID (e.g., `1706.03762`) |
| `level` | enum | No | `abstract`, `body` (default), `appendix`, or `all` |

### `search-papers`

Search papers with citation-ranked results, including citation counts, venue, year, and arXiv IDs when available. Requires `BRIGHTDATA_API_TOKEN`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `yearLow` | number | No | Earliest publication year |
| `yearHigh` | number | No | Latest publication year |
| `sortByDate` | boolean | No | Sort by date instead of relevance |
| `start` | number | No | Pagination offset (0, 10, 20, …) |

### `find-citing-papers`

Find papers that cite a given paper by cluster ID (from `search-papers` results). Requires `BRIGHTDATA_API_TOKEN`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `clusterId` | string | Yes | Cluster ID from `search-papers` results |
| `start` | number | No | Pagination offset (0, 10, 20, …) |

### `find-related-papers`

Find topically related papers by paper ID (from `search-papers` results). Requires `BRIGHTDATA_API_TOKEN`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `paperId` | string | Yes | Paper ID from `search-papers` results |
| `start` | number | No | Pagination offset (0, 10, 20, …) |

## Environment Variables

| Variable | Required | Used by |
|----------|----------|---------|
| `BRIGHTDATA_API_TOKEN` | For citation search tools | `search-papers`, `find-citing-papers`, `find-related-papers` |

To set it in your MCP config, add an `env` block:

```json
{
  "mcpServers": {
    "papers-mcp": {
      "command": "npx",
      "args": ["-y", "papers-mcp"],
      "env": {
        "BRIGHTDATA_API_TOKEN": "your-token"
      }
    }
  }
}
```

## License

MIT
