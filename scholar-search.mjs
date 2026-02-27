#!/usr/bin/env node

/**
 * Scholar Search via Bright Data Proxy
 *
 * Usage:
 *   node scholar-search.mjs "attention is all you need"
 *   node scholar-search.mjs --cited-by 2960712678066186980
 *   node scholar-search.mjs --related vMkAHRgWta0J
 *   node scholar-search.mjs --year-low 2023 "LLM reasoning"
 *   node scholar-search.mjs --sort-date "test time training"
 */

import { JSDOM } from 'jsdom';

const BRIGHTDATA_ENDPOINT = 'https://api.brightdata.com/request';
const SCHOLAR_BASE = 'https://scholar.google.com/scholar';

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

function buildSearchUrl(query, { yearLow, yearHigh, sortByDate, start } = {}) {
  const params = new URLSearchParams({ q: query, hl: 'en' });
  if (yearLow) params.set('as_ylo', String(yearLow));
  if (yearHigh) params.set('as_yhi', String(yearHigh));
  if (sortByDate) params.set('scisbd', '1');
  if (start) params.set('start', String(start));
  return `${SCHOLAR_BASE}?${params}`;
}

function buildCitedByUrl(clusterId, { start } = {}) {
  const params = new URLSearchParams({ cites: clusterId, hl: 'en' });
  if (start) params.set('start', String(start));
  return `${SCHOLAR_BASE}?${params}`;
}

function buildRelatedUrl(paperId, { start } = {}) {
  const q = `related:${paperId}:scholar.google.com/`;
  const params = new URLSearchParams({ q, hl: 'en' });
  if (start) params.set('start', String(start));
  return `${SCHOLAR_BASE}?${params}`;
}

// ---------------------------------------------------------------------------
// Bright Data proxy fetch
// ---------------------------------------------------------------------------

function getToken() {
  const token = process.env.BRIGHTDATA_API_TOKEN;
  if (!token) {
    throw new Error(
      'BRIGHTDATA_API_TOKEN environment variable is required. ' +
      'Get your token from the Bright Data dashboard.'
    );
  }
  return token;
}

async function fetchViaProxy(url) {
  const token = getToken();
  const res = await fetch(BRIGHTDATA_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      zone: 'mcp_unlocker',
      url,
      format: 'raw',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bright Data API error (${res.status}): ${body}`);
  }

  return res.text();
}

// ---------------------------------------------------------------------------
// HTML parsing
// ---------------------------------------------------------------------------

function parseMetadataLine(text) {
  // Format: "Author1, Author2… - Venue, Year - publisher"
  // Sometimes: "Author1, Author2… - Year - publisher"
  // Google Scholar uses \u00A0 (non-breaking space) before dashes
  const parts = text.split(/\s-\s/);
  const authors = (parts[0] || '').trim();

  let venue = null;
  let year = null;

  // Look for a 4-digit year in the remaining parts
  for (let i = 1; i < parts.length; i++) {
    const yearMatch = parts[i].match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      year = parseInt(yearMatch[0], 10);
      // Everything before the year in this part is venue info
      const beforeYear = parts[i].substring(0, parts[i].indexOf(yearMatch[0])).trim();
      // Also include prior parts (between authors and this) as venue
      const venueParts = parts.slice(1, i).concat(beforeYear ? [beforeYear] : []);
      const joined = venueParts.join(' - ').replace(/,\s*$/, '').trim();
      if (joined) venue = joined;
      break;
    }
  }

  // If no year found, treat middle parts as venue
  if (!year && parts.length > 2) {
    venue = parts.slice(1, -1).join(' - ').trim() || null;
  }

  return { authors, venue, year };
}

function extractArxivId(titleUrl, pdfUrl) {
  const pattern = /arxiv\.org\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5})/;
  for (const url of [titleUrl, pdfUrl]) {
    if (!url) continue;
    const m = url.match(pattern);
    if (m) return m[1];
  }
  return null;
}

function parseSingleResult(el) {
  // Title and URL
  const titleEl = el.querySelector('h3.gs_rt > a');
  const title = titleEl?.textContent?.trim() || null;
  const url = titleEl?.getAttribute('href') || null;

  // If no title link, might be a [CITATION] or [BOOK] entry — skip
  if (!title) return null;

  // Metadata line
  const metaEl = el.querySelector('div.gs_a');
  const metaText = metaEl?.textContent?.trim() || '';
  const { authors, venue, year } = parseMetadataLine(metaText);

  // Snippet
  const snippetEl = el.querySelector('div.gs_rs');
  const snippet = snippetEl?.textContent?.trim() || null;

  // PDF link
  const pdfEl = el.querySelector('div.gs_or_ggsm a');
  const pdfUrl = pdfEl?.getAttribute('href') || null;

  // Footer links
  const footerLinks = el.querySelectorAll('div.gs_fl.gs_flb a');
  const links = footerLinks.length > 0
    ? footerLinks
    : el.querySelectorAll('div.gs_fl a');

  let citations = null;
  let clusterId = null;
  let paperId = null;

  for (const link of links) {
    const text = link.textContent || '';
    const href = link.getAttribute('href') || '';

    // "Cited by 123"
    const citedMatch = text.match(/Cited by (\d+)/);
    if (citedMatch) {
      citations = parseInt(citedMatch[1], 10);
      const clusterMatch = href.match(/cites=(\d+)/);
      if (clusterMatch) clusterId = clusterMatch[1];
    }

    // "Related articles"
    if (text.includes('Related articles')) {
      const relatedMatch = href.match(/related:([^:]+):/);
      if (relatedMatch) paperId = relatedMatch[1];
    }
  }

  const arxivId = extractArxivId(url, pdfUrl);

  return { title, authors, year, venue, citations, arxivId, clusterId, paperId, url, snippet };
}

function parseResults(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const containers = doc.querySelectorAll('div.gs_r.gs_or.gs_scl');

  const results = [];
  for (const el of containers) {
    const parsed = parseSingleResult(el);
    if (parsed) results.push(parsed);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Output formatting (same style as arxiv-search.mjs)
// ---------------------------------------------------------------------------

function formatOutput(results) {
  if (results.length === 0) {
    return 'No results found.';
  }

  return results.map(r => {
    const lines = [
      '----------',
      `- Title: ${r.title}`,
      `- Authors: ${r.authors || 'N/A'}`,
      `- Year: ${r.year || 'N/A'}`,
    ];
    if (r.venue) lines.push(`- Venue: ${r.venue}`);
    if (r.citations != null) lines.push(`- Citations: ${r.citations}`);
    if (r.arxivId) lines.push(`- Arxiv ID: arxiv:${r.arxivId}`);
    if (r.clusterId) lines.push(`- Cluster ID: ${r.clusterId}`);
    if (r.paperId) lines.push(`- Paper ID: ${r.paperId}`);
    if (r.url) lines.push(`- URL: ${r.url}`);
    if (r.snippet) lines.push(`- Snippet: ${r.snippet}`);
    return lines.join('\n');
  }).join('\n\n') + '\n\n----------';
}

// ---------------------------------------------------------------------------
// Top-level orchestrator
// ---------------------------------------------------------------------------

async function searchScholar({ query, clusterId, paperId, yearLow, yearHigh, sortByDate, start } = {}) {
  let url;
  if (clusterId) {
    url = buildCitedByUrl(clusterId, { start });
  } else if (paperId) {
    url = buildRelatedUrl(paperId, { start });
  } else if (query) {
    url = buildSearchUrl(query, { yearLow, yearHigh, sortByDate, start });
  } else {
    throw new Error('One of query, clusterId, or paperId is required.');
  }

  const html = await fetchViaProxy(url);
  return parseResults(html);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const args = process.argv.slice(2);
  const opts = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--cited-by':
        opts.clusterId = args[++i];
        break;
      case '--related':
        opts.paperId = args[++i];
        break;
      case '--year-low':
        opts.yearLow = parseInt(args[++i], 10);
        break;
      case '--year-high':
        opts.yearHigh = parseInt(args[++i], 10);
        break;
      case '--sort-date':
        opts.sortByDate = true;
        break;
      case '--start':
        opts.start = parseInt(args[++i], 10);
        break;
      default:
        positional.push(args[i]);
    }
  }

  if (positional.length > 0) {
    opts.query = positional.join(' ');
  }

  if (!opts.query && !opts.clusterId && !opts.paperId) {
    console.error('Usage: node scholar-search.mjs [options] <query>');
    console.error('       node scholar-search.mjs --cited-by <cluster_id>');
    console.error('       node scholar-search.mjs --related <paper_id>');
    console.error('Options: --year-low N  --year-high N  --sort-date');
    process.exit(1);
  }

  try {
    const results = await searchScholar(opts);
    console.log(formatOutput(results));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

export { searchScholar, formatOutput };
