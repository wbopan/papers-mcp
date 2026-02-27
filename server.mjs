#!/usr/bin/env node

/**
 * Papers MCP Server
 * Exposes tools for searching, discovering, and extracting academic papers
 */

import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { searchArxiv, formatOutput } from './arxiv-search.mjs';
import { convertAr5ivToMarkdown } from './ar5iv-to-md.mjs';
import { searchScholar, formatOutput as formatScholarOutput } from './scholar-search.mjs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Create server instance
const server = new McpServer({
  name: 'papers-mcp',
  version: pkg.version,
});

// Tool 1: resolve-arxiv-id
server.registerTool('resolve-arxiv-id', {
  title: 'Resolve Arxiv ID',
  description: `Resolves a paper title, author name, or search query to an arxiv ID. Supports arXiv Lucene-style query syntax: \`abs:"attention mechanism" AND submittedDate:[202301010000 TO 202312312359]\` or \`all:2512.16906\`. Prefer \`all:\` for broadest coverage.`,
  inputSchema: {
    query: z.string().describe('Paper title, author name, or arXiv search query'),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
}, async ({ query }) => {
  try {
    const results = await searchArxiv(query);
    const output = formatOutput(results);
    return {
      content: [{ type: 'text', text: output }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error searching arXiv: ${error.message}. Try search-papers or Web Search to find the arxiv ID instead.` }],
      isError: true,
    };
  }
});

// Tool 2: extract-paper
server.registerTool('extract-paper', {
  title: 'Extract Paper Content',
  description: `Extracts academic paper content as clean markdown with math notation preserved.

Levels: "abstract" (title + authors + abstract), "body" (abstract + main body, default), "appendix" (appendix only), "all" (full paper — may be lengthy).`,
  inputSchema: {
    arxivId: z.string().describe("arxiv ID (e.g., 'arxiv:1706.03762' or '1706.03762')"),
    level: z
      .enum(['abstract', 'body', 'appendix', 'all'])
      .optional()
      .default('body')
      .describe('Level of detail to extract'),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
}, async ({ arxivId, level }) => {
  try {
    const normalizedId = arxivId.replace(/^arxiv:/i, '');
    const markdown = await convertAr5ivToMarkdown(normalizedId, level);
    return {
      content: [{ type: 'text', text: markdown }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error fetching paper: ${error.message}` }],
      isError: true,
    };
  }
});

// Tool 3: search-papers
server.registerTool('search-papers', {
  title: 'Search Papers',
  description: `Searches for academic papers by keyword query. Returns results ranked by citation count and relevance, including citation counts, publication venue, year, and arxiv IDs when available.

Each result includes a clusterId (for find-citing-papers) and paperId (for find-related-papers). Returns arxiv IDs when available for use with extract-paper.`,
  inputSchema: {
    query: z.string().describe('Search query (paper title, author name, or topic keywords)'),
    yearLow: z.number().optional().describe('Filter: earliest publication year'),
    yearHigh: z.number().optional().describe('Filter: latest publication year'),
    sortByDate: z.boolean().optional().default(false).describe('Sort by date instead of relevance'),
    start: z.number().optional().describe('Pagination offset (0, 10, 20, …). Each page has 10 results.'),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
}, async ({ query, yearLow, yearHigh, sortByDate, start }) => {
  try {
    const results = await searchScholar({ query, yearLow, yearHigh, sortByDate, start });
    const output = formatScholarOutput(results);
    return {
      content: [{ type: 'text', text: output }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error searching papers: ${error.message}` }],
      isError: true,
    };
  }
});

// Tool 4: find-citing-papers
server.registerTool('find-citing-papers', {
  title: 'Find Citing Papers',
  description: `Finds papers that cite a specific paper, given its cluster ID from search-papers results.`,
  inputSchema: {
    clusterId: z.string().describe('Cluster ID from search-papers results'),
    start: z.number().optional().describe('Pagination offset (0, 10, 20, …). Each page has 10 results.'),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
}, async ({ clusterId, start }) => {
  try {
    const results = await searchScholar({ clusterId, start });
    const output = formatScholarOutput(results);
    return {
      content: [{ type: 'text', text: output }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error finding citing papers: ${error.message}` }],
      isError: true,
    };
  }
});

// Tool 5: find-related-papers
server.registerTool('find-related-papers', {
  title: 'Find Related Papers',
  description: `Finds papers related to a specific paper by topic similarity, given its paper ID from search-papers results.`,
  inputSchema: {
    paperId: z.string().describe('Paper ID from search-papers results'),
    start: z.number().optional().describe('Pagination offset (0, 10, 20, …). Each page has 10 results.'),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
}, async ({ paperId, start }) => {
  try {
    const results = await searchScholar({ paperId, start });
    const output = formatScholarOutput(results);
    return {
      content: [{ type: 'text', text: output }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error finding related papers: ${error.message}` }],
      isError: true,
    };
  }
});

// Start server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
