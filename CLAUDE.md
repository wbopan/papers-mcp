# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Papers MCP is a Model Context Protocol server that searches arXiv and extracts academic papers as clean Markdown. It provides two tools: `resolve-paper-id` (search by title/author/query) and `extract-paper` (content extraction by arxiv ID). The tools can be used independently — if you already have an arxiv ID, call `extract-paper` directly.

## Important Note

The MCP tools available in your context (`mcp__papers__*`) come from a separate stable release installation, NOT from this repository. Changes to code here will not be reflected when calling those tools. To test code changes, use the CLI directly:

```bash
node ar5iv-to-md.mjs <arxiv-id> [part]
```

## Commands

```bash
npm start          # Run MCP server
node ar5iv-to-md.mjs <arxiv-id> [part]  # CLI for paper extraction (part: all|abstract|body|appendix)
```

No build step required - pure ES modules (.mjs files).

## Architecture

Three main files, all ES modules:

- **server.mjs** - MCP server exposing two tools via `@modelcontextprotocol/sdk`
- **arxiv-search.mjs** - arXiv API search with Lucene-style query support
- **ar5iv-to-md.mjs** - HTML-to-Markdown converter for paper content

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
