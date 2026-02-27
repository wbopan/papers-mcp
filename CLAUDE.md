# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Papers MCP is a Model Context Protocol server for academic paper discovery and extraction. It provides five tools:

- `resolve-paper-id` — search arXiv by title/author/query with Lucene syntax
- `extract-paper` — extract paper content as clean Markdown by arxiv ID
- `search-papers` — search papers with citation-ranked results (via Bright Data proxy)
- `find-citing-papers` — find papers that cite a given paper (by cluster ID)
- `find-related-papers` — find topically related papers (by paper ID)

The tools can be used independently — if you already have an arxiv ID, call `extract-paper` directly.

## Important Note

The MCP tools available in your context (`mcp__papers__*`) come from a separate stable release installation, NOT from this repository. Changes to code here will not be reflected when calling those tools. To test code changes, use the CLI directly:

```bash
node ar5iv-to-md.mjs <arxiv-id> [part]
```

## Environment Variables

- `BRIGHTDATA_API_TOKEN` — Required for `search-papers`, `find-citing-papers`, and `find-related-papers`. Get from Bright Data dashboard.

## Commands

```bash
npm start          # Run MCP server (stdio)
npm run start:http # Run MCP server (HTTP, port 18061)
node ar5iv-to-md.mjs <arxiv-id> [part]  # CLI for paper extraction (part: all|abstract|body|appendix)
node scholar-search.mjs <query>          # CLI for paper search
node scholar-search.mjs --cited-by <cluster_id>   # Find citing papers
node scholar-search.mjs --related <paper_id>       # Find related papers
```

No build step required - pure ES modules (.mjs files).

## Architecture

Four main files, all ES modules:

- **server.mjs** - MCP server exposing five tools via `@modelcontextprotocol/sdk`
- **arxiv-search.mjs** - arXiv API search with Lucene-style query support
- **ar5iv-to-md.mjs** - HTML-to-Markdown converter for paper content
- **scholar-search.mjs** - Paper search via Bright Data proxy (search, cited-by, related)

### Paper Extraction Flow

1. Fetch HTML from ar5iv.labs.arxiv.org (LaTeX-rendered HTML)
2. If ar5iv fails or returns empty `<article class="ltx_document">`, fallback to arxiv.org/html
3. Parse with JSDOM, convert to Markdown preserving math (`$...$`, `$$...$$`), figures, tables, citations

### Key HTML Selectors (ar5iv/arxiv HTML)

- Title: `h1.ltx_title_document`
- Authors: `.ltx_authors`
- Abstract: `.ltx_abstract p.ltx_p`
- Sections: `article.ltx_document > section.ltx_section`
- Appendix: `article.ltx_document > section.ltx_appendix`
- Math: `<math alttext="...">` → extract alttext for LaTeX
