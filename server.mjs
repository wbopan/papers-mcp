#!/usr/bin/env node

/**
 * Papers MCP Server
 * Exposes tools for searching arXiv and retrieving paper content in markdown format
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { searchArxiv, formatOutput } from './arxiv-search.mjs';
import { convertAr5ivToMarkdown } from './ar5iv-to-md.mjs';

// Create server instance
const server = new McpServer({
  name: 'papers-mcp',
  version: '1.0.0',
});

// Tool 1: resolve-paper-id
server.tool(
  'resolve-paper-id',
  `Resolves a paper title, author name, or search query to a arxiv ID and returns matching papers.

You MUST call this function before 'query-paper' to obtain a valid arxiv ID UNLESS the user explicitly includes the arxiv ID in the query.

Uses arXiv query syntax (Lucene-style field prefixes) to search. For example \`abs:"attention mechanism" AND submittedDate:[202301010000 TO 202312312359]\` or \`all:2512.16906\`. Prefer \`all:\` to maximize coverage.

IMPORTANT: Do not call this tool more than 3 times per question. If you cannot find what you need after 3 calls, use the best result you have.`,
  {
    query: z.string().describe('Paper title, author name, or arXiv search query'),
  },
  async ({ query }) => {
    try {
      const results = await searchArxiv(query);
      const output = formatOutput(results);
      return {
        content: [{ type: 'text', text: output }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error searching arXiv: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool 2: extract-paper
server.tool(
  'extract-paper',
  `Retrieves detailed content from a specific academic paper with arxivID.

Call this tool if information returned from \`resolve-paper-id\` is not sufficient and detailed paper content is required. Prefer this tool than fetching webpages or downloading PDFs as it's more accurate and is in markdown format.

This tool can extract paper content in different levels:
- "abstract": Title, author list and abstract for quick preview
- "body": Abstract as well as main body of the paper. Default option for in-depth understanding.
- "appendix": Appendix section
- "all": abstract, body, references and appendix. May return a lengthy document.`,
  {
    arxivId: z.string().describe("arxiv ID (e.g., 'arxiv:1706.03762' or '1706.03762')"),
    level: z
      .enum(['abstract', 'body', 'appendix', 'all'])
      .optional()
      .default('body')
      .describe('Level of detail to extract'),
  },
  async ({ arxivId, level }) => {
    try {
      // Normalize arxiv ID - strip "arxiv:" prefix if present
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
  }
);

// Start server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
