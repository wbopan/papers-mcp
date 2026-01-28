#!/usr/bin/env node

import { JSDOM } from 'jsdom';

const AR5IV_BASE = 'https://ar5iv.labs.arxiv.org/html/';
const ARXIV_HTML_BASE = 'https://arxiv.org/html/';

/**
 * Fetch ar5iv HTML page, fallback to arxiv.org/html if ar5iv redirects
 */
async function fetchAr5iv(arxivId) {
  // Try ar5iv first (with redirect: 'manual' to detect 307)
  const ar5ivUrl = `${AR5IV_BASE}${arxivId}`;
  const ar5ivResponse = await fetch(ar5ivUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    },
    redirect: 'manual',
  });

  // If ar5iv returns 307, it means the paper is not available on ar5iv
  if (ar5ivResponse.status === 307) {
    // Fallback to arxiv.org/html
    const arxivUrl = `${ARXIV_HTML_BASE}${arxivId}`;
    const arxivResponse = await fetch(arxivUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
    });

    if (!arxivResponse.ok) {
      throw new Error(`Paper HTML not available: ar5iv redirected, arxiv.org/html returned ${arxivResponse.status}`);
    }

    return arxivResponse.text();
  }

  if (!ar5ivResponse.ok) {
    throw new Error(`Failed to fetch ${ar5ivUrl}: ${ar5ivResponse.status}`);
  }

  return ar5ivResponse.text();
}

/**
 * Convert inline math to markdown
 * Handles both <span class="ltx_Math"><math>...</math></span>
 * and direct <math class="ltx_Math">...</math>
 */
function processMath(element) {
  // If element is already a math element (JSDOM returns lowercase)
  if (element.tagName.toLowerCase() === 'math') {
    const alttext = element.getAttribute('alttext') || '';
    return `$${alttext}$`;
  }
  // If element contains a math element
  const math = element.querySelector('math');
  if (math) {
    const alttext = math.getAttribute('alttext') || '';
    return `$${alttext}$`;
  }
  return '';
}

/**
 * Convert block equation to markdown
 */
function processEquation(element) {
  const math = element.querySelector('math');
  if (math) {
    const alttext = math.getAttribute('alttext') || '';
    const tagEl = element.querySelector('.ltx_tag');
    let tag = tagEl ? tagEl.textContent.trim() : '';
    // Remove surrounding parentheses if present (they're added by ar5iv)
    tag = tag.replace(/^\((.+)\)$/, '$1');
    return `\n$$\n${alttext}\n$$${tag ? ` (${tag})` : ''}\n`;
  }
  return '';
}

/**
 * Process a figure element
 */
function processFigure(figure) {
  const id = figure.id || '';
  const img = figure.querySelector('img');
  const caption = figure.querySelector('figcaption');

  let md = '\n';

  if (img) {
    const src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || 'Figure';
    // Convert relative URL to absolute
    const fullSrc = src.startsWith('/') ? `https://ar5iv.labs.arxiv.org${src}` : src;
    md += `![${alt}](${fullSrc})\n`;
  }

  if (caption) {
    const captionText = processInlineContent(caption);
    md += `\n*${captionText.trim()}*\n`;
  }

  return md + '\n';
}

/**
 * Process a table element
 */
function processTable(table) {
  const rows = table.querySelectorAll('tr');
  if (rows.length === 0) return '';

  let md = '\n';
  let isFirstRow = true;

  rows.forEach((row) => {
    const cells = row.querySelectorAll('td, th');
    const cellTexts = Array.from(cells).map((cell) => {
      return processInlineContent(cell).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
    });

    md += '| ' + cellTexts.join(' | ') + ' |\n';

    if (isFirstRow) {
      md += '| ' + cellTexts.map(() => '---').join(' | ') + ' |\n';
      isFirstRow = false;
    }
  });

  return md + '\n';
}

/**
 * Process inline content (text, math, citations, refs)
 */
function processInlineContent(element) {
  let result = '';

  for (const node of element.childNodes) {
    if (node.nodeType === 3) {
      // Text node
      result += node.textContent;
    } else if (node.nodeType === 1) {
      // Element node
      const el = node;
      const classes = el.classList;
      const tagName = el.tagName.toLowerCase();

      // Handle math elements (both direct <math> and <span class="ltx_Math">)
      if (tagName === 'math' || classes.contains('ltx_Math')) {
        result += processMath(el);
      } else if (classes.contains('ltx_cite')) {
        // Handle both ar5iv (a.ltx_ref) and arxiv.org/html (span.ltx_ref)
        const refs = el.querySelectorAll('a.ltx_ref, span.ltx_ref');
        const citeTexts = Array.from(refs).map((r) => r.textContent.trim()).filter(Boolean);
        result += `[${citeTexts.join(', ')}]`;
      } else if (classes.contains('ltx_ref')) {
        const href = el.getAttribute('href') || '';
        const text = el.textContent || '';
        if (href.startsWith('#')) {
          result += `[${text}](${href})`;
        } else {
          result += `[${text}](${href})`;
        }
      } else if (classes.contains('ltx_note')) {
        // Footnotes - skip or process minimally
        const noteContent = el.textContent || '';
        if (noteContent.trim()) {
          result += ` [^${noteContent.trim().substring(0, 50)}]`;
        }
      } else if (tagName === 'a') {
        const href = el.getAttribute('href') || '';
        const text = el.textContent || '';
        result += `[${text}](${href})`;
      } else if (tagName === 'br') {
        result += '\n';
      } else if (classes.contains('ltx_font_bold') || tagName === 'b' || tagName === 'strong') {
        result += `**${processInlineContent(el)}**`;
      } else if (classes.contains('ltx_font_italic') || tagName === 'i' || tagName === 'em') {
        result += `*${processInlineContent(el)}*`;
      } else if (tagName === 'code') {
        result += `\`${el.textContent}\``;
      } else {
        result += processInlineContent(el);
      }
    }
  }

  return result;
}

/**
 * Process a paragraph
 * Handles mixed content: text paragraphs, equations, figures
 */
function processParagraph(para) {
  let md = '';

  for (const child of para.children) {
    const tagName = child.tagName;
    const classes = child.classList;

    if (tagName === 'P' && classes.contains('ltx_p')) {
      md += processInlineContent(child) + '\n\n';
    } else if (tagName === 'TABLE') {
      if (classes.contains('ltx_equation') || classes.contains('ltx_eqn_table')) {
        md += processEquation(child);
      } else if (classes.contains('ltx_tabular')) {
        md += processTable(child);
      }
    } else if (tagName === 'FIGURE' && classes.contains('ltx_figure')) {
      md += processFigure(child);
    }
    // Skip other elements like ltx_pagination
  }

  // Fallback: if no structured children found, process as inline
  if (md === '') {
    md = processInlineContent(para) + '\n\n';
  }

  return md;
}

/**
 * Process section content recursively
 */
function processSectionContent(section, level = 2) {
  let md = '';

  for (const child of section.children) {
    const classes = child.classList;

    if (child.tagName === 'H1' || child.tagName === 'H2' || child.tagName === 'H3' ||
        child.tagName === 'H4' || child.tagName === 'H5' || child.tagName === 'H6') {
      if (classes.contains('ltx_title')) {
        const titleText = processInlineContent(child).trim();
        md += `${'#'.repeat(level)} ${titleText}\n\n`;
      }
    } else if (classes.contains('ltx_para')) {
      md += processParagraph(child);
    } else if (classes.contains('ltx_subsection')) {
      md += processSectionContent(child, level + 1);
    } else if (classes.contains('ltx_subsubsection')) {
      md += processSectionContent(child, level + 2);
    } else if (child.tagName === 'FIGURE' && classes.contains('ltx_figure')) {
      md += processFigure(child);
    } else if (child.tagName === 'TABLE') {
      if (classes.contains('ltx_equation') || classes.contains('ltx_eqn_table')) {
        md += processEquation(child);
      } else if (classes.contains('ltx_tabular')) {
        md += processTable(child);
      }
    } else if (classes.contains('ltx_theorem') || classes.contains('ltx_proof')) {
      const titleEl = child.querySelector('.ltx_title');
      const title = titleEl ? processInlineContent(titleEl).trim() : '';
      if (title) {
        md += `\n**${title}**\n\n`;
      }
      const paras = child.querySelectorAll('.ltx_para');
      for (const para of paras) {
        md += processParagraph(para);
      }
    } else if (child.tagName === 'DIV' && classes.contains('ltx_logical-block')) {
      // Process logical blocks (often contain figures)
      md += processSectionContent(child, level);
    }
  }

  return md;
}

/**
 * Extract title
 */
function extractTitle(doc) {
  const titleEl = doc.querySelector('h1.ltx_title_document');
  if (titleEl) {
    return processInlineContent(titleEl).trim();
  }
  return '';
}

/**
 * Extract authors
 */
function extractAuthors(doc) {
  const authorsEl = doc.querySelector('.ltx_authors');
  if (authorsEl) {
    return processInlineContent(authorsEl).trim().replace(/\s+/g, ' ');
  }
  return '';
}

/**
 * Extract abstract
 */
function extractAbstract(doc) {
  const abstractEl = doc.querySelector('.ltx_abstract');
  if (abstractEl) {
    const pEl = abstractEl.querySelector('p.ltx_p');
    if (pEl) {
      return processInlineContent(pEl).trim();
    }
  }
  return '';
}

/**
 * Extract body sections (non-appendix)
 */
function extractBody(doc) {
  const sections = doc.querySelectorAll('article.ltx_document > section.ltx_section');
  let md = '';

  for (const section of sections) {
    md += processSectionContent(section, 2);
  }

  return md;
}

/**
 * Extract appendix sections
 */
function extractAppendix(doc) {
  const appendices = doc.querySelectorAll('article.ltx_document > section.ltx_appendix');
  let md = '';

  for (const appendix of appendices) {
    md += processSectionContent(appendix, 2);
  }

  return md;
}

/**
 * Extract bibliography/references
 */
function extractReferences(doc) {
  const bibSection = doc.querySelector('section.ltx_bibliography');
  if (!bibSection) {
    return '';
  }

  let md = '## References\n\n';

  const bibList = bibSection.querySelector('ul.ltx_biblist');
  if (!bibList) {
    return md;
  }

  const items = bibList.querySelectorAll('li.ltx_bibitem');
  for (const item of items) {
    // Try different tag selectors (ltx_tag_bibitem or ltx_bibtag)
    const tagEl = item.querySelector('span.ltx_tag_bibitem') || item.querySelector('span.ltx_bibtag');
    let tag = tagEl ? tagEl.textContent.trim() : '';
    // Remove brackets if present, we'll add them back
    tag = tag.replace(/^\[|\]$/g, '');

    // Collect all bibblock spans
    const blocks = item.querySelectorAll('span.ltx_bibblock');
    const blockTexts = Array.from(blocks).map((b) => {
      return processInlineContent(b).trim();
    }).filter(Boolean);

    if (tag) {
      md += `[${tag}] ${blockTexts.join(' ')}\n\n`;
    } else {
      md += `${blockTexts.join(' ')}\n\n`;
    }
  }

  return md;
}

/**
 * Main conversion function
 */
async function convertAr5ivToMarkdown(arxivId, part = 'all') {
  const html = await fetchAr5iv(arxivId);
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  let md = '';

  const title = extractTitle(doc);
  const authors = extractAuthors(doc);

  // Always include title
  if (title) {
    md += `# ${title}\n\n`;
  }

  // Include authors for all parts except appendix-only
  if (authors && part !== 'appendix') {
    md += `**Authors:** ${authors}\n\n`;
  }

  switch (part) {
    case 'abstract':
      md += `## Abstract\n\n${extractAbstract(doc)}\n`;
      break;

    case 'body':
      const abstractForBody = extractAbstract(doc);
      if (abstractForBody) {
        md += `## Abstract\n\n${abstractForBody}\n\n`;
      }
      md += extractBody(doc);
      break;

    case 'appendix':
      md += extractAppendix(doc);
      break;

    case 'all':
    default:
      const abstract = extractAbstract(doc);
      if (abstract) {
        md += `## Abstract\n\n${abstract}\n\n`;
      }
      md += extractBody(doc);
      md += extractReferences(doc);
      const appendix = extractAppendix(doc);
      if (appendix) {
        md += `---\n\n# Appendix\n\n${appendix}`;
      }
      break;
  }

  return md;
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node ar5iv-to-md.mjs <arxiv-id> [part]

Arguments:
  arxiv-id    The arXiv paper ID (e.g., 2512.16906, 2512.16906v1)
  part        Which part to extract (default: all)
              - all:      Full paper (title + authors + abstract + body + references + appendix)
              - abstract: Title + authors + abstract only
              - body:     Title + authors + abstract + main sections (no references/appendix)
              - appendix: Title + appendix only

Examples:
  node ar5iv-to-md.mjs 2512.16906
  node ar5iv-to-md.mjs 2512.16906v1 abstract
  node ar5iv-to-md.mjs 2512.16906 body
`);
    process.exit(0);
  }

  const arxivId = args[0];
  const part = args[1] || 'all';

  const validParts = ['all', 'abstract', 'body', 'appendix'];
  if (!validParts.includes(part)) {
    console.error(`Error: Invalid part "${part}". Must be one of: ${validParts.join(', ')}`);
    process.exit(1);
  }

  try {
    const markdown = await convertAr5ivToMarkdown(arxivId, part);
    console.log(markdown);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// CLI entry point - only run when executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main();
}

export { convertAr5ivToMarkdown };
