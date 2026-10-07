const axios = require('axios');
const cheerio = require('cheerio');
const urlModule = require('url');
const { v4: uuidv4 } = require('uuid');

const { readData, writeData } = require('../config/db');
const { scrapePropertyUrl } = require('./scraper.service');
const { extractPropertyData } = require('./ai_extraction.service');
const { resolveEntitiesAndDeduplicate } = require('./entity_resolver.service');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0'
];

/**
 * Known real estate portal detail page URL patterns
 */
const DETAIL_PATTERNS = [
  // 99acres (e.g. /project-name-locality-city-npxid-r12345 or /pdpid-123)
  /-npxid-[a-z0-9]+/i,
  /-pdpid-[a-z0-9]+/i,
  // Houssed (e.g. /mumbai/project-slug, /pune/project-slug, /bangalore/project-slug)
  /houssed\.com\/(?:mumbai|pune|bangalore|bengaluru|delhi|hyderabad|thane|navi-mumbai)\/[a-z0-9\-]{4,}/i,
  // Generic portals
  /\/project\/[a-z0-9\-]+/i,
  /\/property\/[a-z0-9\-]+/i,
  /\/residential\/[a-z0-9\-]+/i,
  /\/apartments\/[a-z0-9\-]+/i
];

/**
 * Filter out non-property links (navigation, search filters, commercial, co-working, login, blogs, etc.)
 */
const EXCLUDE_PATTERNS = [
  /\/login/i, /\/signup/i, /\/register/i, /\/about/i, /\/contact/i,
  /\/privacy/i, /\/terms/i, /\/blog/i, /\/news/i, /\/careers/i,
  /\/faq/i, /\/sitemap/i, /\/agent/i, /\/builder\/?$/i, /\/city\/?$/i,
  /\/commercial/i, /\/co-working/i, /\/location-review/i, /\/insights/i,
  /\/articles/i, /\/press/i, /\/help/i, /\/feedback/i, /\/advertis/i,
  /\/sale\/flats/i, /\/sale\/villas/i, /\/sale\/plots/i, /\/sale\/commercial/i,
  // Rental & Lease exclusions (Only developer new sale projects allowed)
  /\/rent\//i, /\/rental\//i, /\/lease\//i, /\/paying-guest/i, /\/pg\//i,
  /\/rent-property/i, /\/flats-for-rent/i, /\/house-for-rent/i, /\/apartments-for-rent/i,
  /\/commercial-rent/i, /\/resale\//i, /\/buy\/sale/i,
  /\.pdf$/i, /\.jpg$/i, /\.png$/i, /\.css$/i, /\.js$/i, /mailto:/i, /tel:/i, /javascript:/i
];

/**
 * Build browser spoof headers
 */
function getBrowserHeaders(referer = 'https://www.google.com/') {
  const randomUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  return {
    'User-Agent': randomUserAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    'Referer': referer,
    'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
}

/**
 * Extract candidate property detail URLs from an HTML page
 */
function extractPropertyLinks(html, baseUrl) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const discovered = new Set();
  const parsedBase = new urlModule.URL(baseUrl);

  $('a[href]').each((_, el) => {
    let href = $(el).attr('href')?.trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    try {
      const fullUrl = new urlModule.URL(href, baseUrl).toString();
      const parsedFull = new urlModule.URL(fullUrl);

      // Must be same domain
      if (parsedFull.hostname.replace('www.', '') !== parsedBase.hostname.replace('www.', '')) return;

      // Check excludes
      if (EXCLUDE_PATTERNS.some(pat => pat.test(parsedFull.pathname))) return;

      // Check if matches known property detail pattern or heuristic
      const pathSegments = parsedFull.pathname.split('/').filter(Boolean);
      const isKnownPattern = DETAIL_PATTERNS.some(pat => pat.test(fullUrl));
      const isHeuristicSlug = pathSegments.length === 2 && pathSegments[1].length >= 4 && !pathSegments[1].includes('search');

      if (isKnownPattern || isHeuristicSlug) {
        // Strip trailing slash & search params for clean dedup
        const cleanUrl = `${parsedFull.protocol}//${parsedFull.host}${parsedFull.pathname}`.replace(/\/$/, '');
        discovered.add(cleanUrl);
      }
    } catch (e) {
      // Ignore malformed URLs
    }
  });

  return Array.from(discovered);
}

/**
 * Discover pagination links from an HTML page
 */
function extractPaginationLinks(html, baseUrl, maxPages = 3) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const pages = new Set();
  const parsedBase = new urlModule.URL(baseUrl);

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim();
    const text = $(el).text()?.trim();

    if (!href) return;

    try {
      const fullUrl = new urlModule.URL(href, baseUrl).toString();
      const isPagePattern = /page[=\/\-_]\d+/i.test(fullUrl) || /^\d+$/.test(text) || text.toLowerCase().includes('next');

      if (isPagePattern && new urlModule.URL(fullUrl).hostname === parsedBase.hostname) {
        pages.add(fullUrl);
      }
    } catch (e) {
      // Ignore malformed pagination URLs
    }
  });

  return Array.from(pages).slice(0, maxPages - 1);
}

/**
 * Crawls a website or directory listing page to discover & batch-process property detail pages
 */
async function crawlAndExtractWebsite(startUrl, options = {}) {
  const maxPages = options.maxPages || 3;
  const maxProperties = options.maxProperties || 20;
  const skipExisting = options.skipExisting !== false;
  const provider = options.provider || 'auto';

  const existingProjects = readData();
  const existingUrls = new Set(existingProjects.map(p => p.source_url?.toLowerCase().replace(/\/$/, '')));

  const discoveredPropertyUrls = new Set();
  const crawledListingPages = new Set();
  const pagesToCrawl = [startUrl];
  let crawlError = null;

  console.log(`[Crawler] Starting crawl at: ${startUrl} (Max Pages: ${maxPages}, Max Props: ${maxProperties})`);

  // Step 1: Discover property links across listing pages & pagination
  while (pagesToCrawl.length > 0 && crawledListingPages.size < maxPages) {
    const currentPageUrl = pagesToCrawl.shift();
    if (crawledListingPages.has(currentPageUrl)) continue;

    crawledListingPages.add(currentPageUrl);
    console.log(`[Crawler] Fetching directory page ${crawledListingPages.size}/${maxPages}: ${currentPageUrl}`);

    try {
      const headers = getBrowserHeaders(startUrl);
      const res = await axios.get(currentPageUrl, {
        headers,
        timeout: 12000,
        maxRedirects: 5
      });

      const html = res.data || '';
      const links = extractPropertyLinks(html, currentPageUrl);
      console.log(`[Crawler] Found ${links.length} property links on page ${currentPageUrl}`);
      links.forEach(l => discoveredPropertyUrls.add(l));

      // Find more pagination links if under limit
      if (crawledListingPages.size < maxPages) {
        const nextPages = extractPaginationLinks(html, currentPageUrl, maxPages);
        nextPages.forEach(p => {
          if (!crawledListingPages.has(p) && !pagesToCrawl.includes(p)) {
            pagesToCrawl.push(p);
          }
        });
      }
    } catch (err) {
      const status = err.response?.status;
      console.warn(`[Crawler] Error fetching directory page ${currentPageUrl}: ${status ? `HTTP ${status}` : err.message}`);
      if (status === 403) {
        crawlError = `The website (${startUrl}) blocked access with HTTP 403 (Anti-Bot Cloudflare protection). Try using a city/category directory URL like https://houssed.com/mumbai or individual property links.`;
      } else {
        crawlError = err.message;
      }
    }
  }

  const allDiscovered = Array.from(discoveredPropertyUrls);
  console.log(`[Crawler] Discovered ${allDiscovered.length} total property links.`);

  if (allDiscovered.length === 0 && crawlError) {
    throw new Error(crawlError);
  }

  // Step 2: Filter out existing URLs already in staging/database
  const toProcess = [];
  const skippedUrls = [];

  for (const url of allDiscovered) {
    const clean = url.toLowerCase().replace(/\/$/, '');
    if (skipExisting && existingUrls.has(clean)) {
      skippedUrls.push(url);
    } else {
      toProcess.push(url);
    }
    if (toProcess.length >= maxProperties) break;
  }

  console.log(`[Crawler] Filtered: ${toProcess.length} new URLs to process, ${skippedUrls.length} already in DB.`);

  // Step 3: Batch-execute the extraction pipeline on each discovered property
  const processedResults = [];
  const stagedProjects = readData();

  for (let i = 0; i < toProcess.length; i++) {
    const targetUrl = toProcess[i];
    console.log(`[Crawler Batch] Processing property ${i + 1}/${toProcess.length}: ${targetUrl}`);

    try {
      // 1. Scrape
      const scraped = await scrapePropertyUrl(targetUrl);

      // 2. Extract
      const extracted = await extractPropertyData(scraped, { provider });

      // 3. Resolve & Deduplicate
      const resolved = await resolveEntitiesAndDeduplicate(extracted);

      const { _meta, ...cleanExtractedData } = extracted;

      // 4. Create staged record
      const stagedItem = {
        id: uuidv4(),
        source_url: scraped.sourceUrl,
        source_domain: scraped.sourceDomain,
        screenshot_url: scraped.screenshotUrl,
        scraped_at: scraped.scrapedAt,
        extracted_data: cleanExtractedData,
        resolved_builder_id: resolved.resolved_builder_id,
        resolved_city_id: resolved.resolved_city_id,
        resolved_zone_id: resolved.resolved_zone_id,
        resolved_location_id: resolved.resolved_location_id,
        confidence_score: resolved.confidence_score,
        validation_warnings: resolved.validation_warnings,
        candidates: resolved.candidates || {},
        matched_project_id: resolved.matched_project_id,
        is_duplicate: resolved.is_duplicate,
        action_type: resolved.action_type,
        price_change_diff: resolved.price_change_diff,
        pipeline_logs: [
          { step: 'crawler_discovery', status: 'success', source: startUrl },
          { step: 'ai_extraction', status: 'success', model: extracted._meta?.modelUsed || 'default' },
          { step: 'entity_resolution', status: 'success', confidence_score: resolved.confidence_score }
        ],
        status: resolved.action_type === 'update' ? 'update_pending' : 'pending_review',
        reviewed_by: null,
        review_notes: `Batch crawled from ${startUrl}`,
        reviewed_at: null,
        created_project_id: null,
        pushed_at: null,
        push_error: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      stagedProjects.unshift(stagedItem);
      processedResults.push({
        url: targetUrl,
        name: cleanExtractedData.name,
        confidence_score: resolved.confidence_score,
        status: 'staged',
        id: stagedItem.id
      });

      // Save to disk incrementally
      writeData(stagedProjects);

      // Gentle rate-limiting pause between items (longer for local LLM to avoid CPU queue socket drops)
      if (i < toProcess.length - 1) {
        const pauseMs = provider === 'local' ? 1200 : 400;
        await new Promise(r => setTimeout(r, pauseMs));
      }
    } catch (err) {
      console.error(`[Crawler Batch Error] Failed processing ${targetUrl}:`, err.message);
      processedResults.push({
        url: targetUrl,
        status: 'error',
        error: err.message
      });
    }
  }

  return {
    startUrl,
    pagesCrawledCount: crawledListingPages.size,
    totalDiscoveredCount: allDiscovered.length,
    alreadyInDbSkippedCount: skippedUrls.length,
    processedCount: processedResults.filter(r => r.status === 'staged').length,
    results: processedResults
  };
}

module.exports = {
  crawlAndExtractWebsite,
  extractPropertyLinks,
  extractPaginationLinks
};
