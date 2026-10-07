const { chromium } = require('playwright');
const cheerio = require('cheerio');

let browserInstance = null;

/**
 * Get or launch shared Playwright Chromium browser instance
 */
async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1920,1080'
      ]
    });
  }
  return browserInstance;
}

/**
 * Scrape target real estate URL using Playwright Chromium
 * Handles dynamic client-side JS rendering, accordions, and "Read More" expansions
 */
async function scrapeWithPlaywright(targetUrl, options = {}) {
  const timeoutMs = options.timeout || 20000;
  let context = null;
  let page = null;

  try {
    const browser = await getBrowser();
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      deviceScaleFactor: 1,
      locale: 'en-US'
    });

    page = await context.newPage();

    // Abort heavy media / tracker requests to accelerate rendering
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      const url = route.request().url();
      if (
        resourceType === 'media' ||
        resourceType === 'font' ||
        url.includes('google-analytics') ||
        url.includes('doubleclick') ||
        url.includes('facebook') ||
        url.includes('hotjar')
      ) {
        return route.abort();
      }
      return route.continue();
    });

    console.log(`[Playwright] Navigating to: ${targetUrl}`);
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs
    });

    // Wait a brief moment for dynamic client hydration (React/Next.js/Vue)
    try {
      await page.waitForLoadState('networkidle', { timeout: 4000 });
    } catch (_) {
      // Network idle timeout is acceptable
    }

    // Auto-expand "Read More", "Overview", or "Description" toggles if present
    const readMoreSelectors = [
      'button:has-text("Read More")',
      'a:has-text("Read More")',
      'span:has-text("Read More")',
      'div:has-text("Read More")',
      '.read-more-btn',
      '.readMoreBtn',
      '.read-more-toggle',
      '[class*="readMore"]',
      '[class*="read-more"]',
      '[id*="readMore"]',
      '[id*="read-more"]'
    ];

    for (const selector of readMoreSelectors) {
      try {
        const toggleBtn = await page.$(selector);
        if (toggleBtn) {
          const isVisible = await toggleBtn.isVisible();
          if (isVisible) {
            await toggleBtn.click({ timeout: 1500 });
            await page.waitForTimeout(300);
          }
        }
      } catch (_) {
        // Continue if selector is not clickable
      }
    }

    // Capture dynamic rendered HTML content
    const renderedHtml = await page.content();

    // Capture page screenshot as base64 JPEG
    let screenshotUrl = null;
    try {
      const buffer = await page.screenshot({ type: 'jpeg', quality: 75, fullPage: false }); 
      screenshotUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch (ssErr) {
      console.warn('[Playwright] Screenshot capture notice:', ssErr.message);
    }

    // Extract OpenGraph / primary image if screenshot not captured
    if (!screenshotUrl && renderedHtml) {
      const $ = cheerio.load(renderedHtml);
      screenshotUrl = $('meta[property="og:image"]').attr('content') ||
                      $('meta[name="twitter:image"]').attr('content') ||
                      null;
    }

    console.log(`[Playwright] Successfully rendered and captured ${renderedHtml.length} bytes of HTML.`);

    return {
      success: true,
      html: renderedHtml,
      screenshotUrl,
      sourceUrl: targetUrl
    };
  } catch (err) {
    console.warn(`[Playwright] Scraping error for ${targetUrl}:`, err.message);
    return {
      success: false,
      error: err.message
    };
  } finally {
    if (page) {
      try { await page.close(); } catch (_) {}
    }
    if (context) {
      try { await context.close(); } catch (_) {}
    }
  }
}

/**
 * Gracefully close browser instance on application shutdown
 */
async function closeBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.close();
      browserInstance = null;
    } catch (_) {}
  }
}

module.exports = {
  scrapeWithPlaywright,
  closeBrowser
};
