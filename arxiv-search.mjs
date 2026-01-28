#!/usr/bin/env node

/**
 * arXiv Search CLI
 * Usage: node arxiv-search.mjs <query>
 * Example: node arxiv-search.mjs "transformer attention"
 */

const ARXIV_API = 'https://export.arxiv.org/api/query';
const MAX_RESULTS = 5;

async function searchArxiv(query) {
  // Don't add 'all:' prefix if query already has a field prefix
  const hasFieldPrefix = /^(ti|au|abs|co|jr|cat|rn|all|id):/.test(query);
  const searchQuery = hasFieldPrefix ? query : `all:${query}`;

  const params = new URLSearchParams({
    search_query: searchQuery,
    start: 0,
    max_results: MAX_RESULTS,
    sortBy: 'relevance',
    sortOrder: 'descending'
  });

  const response = await fetch(`${ARXIV_API}?${params}`);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const xml = await response.text();
  return parseResults(xml);
}

function parseResults(xml) {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];

  return entries.map(entry => {
    const id = extractTag(entry, 'id');
    const arxivId = id.match(/(\d{4}\.\d{4,5})(v\d+)?$/)?.[1] || id;

    const authors = [...entry.matchAll(/<author>\s*<name>([^<]+)<\/name>\s*<\/author>/g)]
      .map(m => m[1]);

    const published = extractTag(entry, 'published');
    const year = published ? new Date(published).getFullYear() : null;

    const abstract = extractTag(entry, 'summary')
      ?.replace(/\s+/g, ' ')
      .trim();

    // Extract primary category
    const categoryMatch = entry.match(/<arxiv:primary_category[^>]*term="([^"]+)"/);
    const category = categoryMatch?.[1] || null;

    // Extract comment
    const comment = extractTag(entry, 'arxiv:comment')
      ?.replace(/\s+/g, ' ')
      .trim() || null;

    // Extract journal reference and DOI
    const journalRef = extractTag(entry, 'arxiv:journal_ref')
      ?.replace(/\s+/g, ' ')
      .trim() || null;
    const doi = extractTag(entry, 'arxiv:doi') || null;

    return {
      title: extractTag(entry, 'title')?.replace(/\s+/g, ' ').trim(),
      arxivId: `arxiv:${arxivId}`,
      authors,
      year,
      category,
      comment,
      journalRef,
      doi,
      abstract
    };
  });
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match?.[1] || null;
}

function formatOutput(results) {
  if (results.length === 0) {
    return 'No results found.';
  }

  return results.map(r => {
    const lines = [
      '----------',
      `- Title: ${r.title}`,
      `- Arxiv ID: ${r.arxivId}`,
      `- Authors: ${r.authors.join(', ')}`,
      `- Year: ${r.year}`,
      `- Category: ${r.category || 'N/A'}`,
    ];
    if (r.comment) lines.push(`- Comment: ${r.comment}`);
    if (r.journalRef || r.doi) {
      const journalDoi = [r.journalRef, r.doi].filter(Boolean).join(' / ');
      lines.push(`- Journal/DOI: ${journalDoi}`);
    }
    lines.push(`- Abstract: ${r.abstract}`);
    return lines.join('\n');
  }).join('\n\n') + '\n\n----------';
}

// CLI entry point - only run when executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const query = process.argv.slice(2).join(' ');

  if (!query) {
    console.error('Usage: node arxiv-search.mjs <query>');
    console.error('Example: node arxiv-search.mjs "transformer attention"');
    process.exit(1);
  }

  try {
    const results = await searchArxiv(query);
    console.log(formatOutput(results));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

export { searchArxiv, formatOutput };
