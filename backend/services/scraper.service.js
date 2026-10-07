const axios = require('axios');
const urlModule = require('url');
const cheerio = require('cheerio');

/**
 * Common Browser User-Agent Pool for Scraper
 */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0'
];

/**
 * Pre-configured mock templates strictly for offline demo tests
 */
const SAMPLE_SCRAPES = {
  'godrej-ananda': {
    title: 'Godrej Ananda - Bagalur, North Bengaluru',
    extractedHtml: `
      <html><body>
      <h1>Godrej Ananda</h1>
      <p>Developer: Godrej Properties</p>
      <p>RERA Number: PRM/KA/RERA/1251/309/PR/210331/004084</p>
      <p>Location: Bagalur, North Bengaluru, City: Bengaluru, Zone: North</p>
      <p>Property Type: Apartment | Towers: 6 | Floors: G+28 | Total Units: 806</p>
      <p>Possession Status: Under Construction | Date: 2026-12-31</p>
      <div>
        <h3>Configurations</h3>
        <div>2BHK - 904 sq.ft - Price ₹65.00 Lac to ₹72.00 Lac</div>
        <div>3BHK - 1229 sq.ft - Price ₹88.00 Lac to ₹98.00 Lac</div>
      </div>
      <div>
        <h3>Amenities</h3>
        <span>Swimming Pool</span>, <span>Gymnasium</span>, <span>Clubhouse</span>, <span>Jogging Track</span>, <span>24x7 Security</span>
      </div>
      <div class="faq-section">
        <h3>Frequently Asked Questions</h3>
        <div class="faq-item">
          <h4>What is the RERA registration number of Godrej Ananda?</h4>
          <p>The RERA registration number for Godrej Ananda is PRM/KA/RERA/1251/309/PR/210331/004084.</p>
        </div>
        <div class="faq-item">
          <h4>Where is Godrej Ananda located?</h4>
          <p>Godrej Ananda is strategically located in Bagalur, North Bengaluru near KIADB Aerospace Park.</p>
        </div>
        <div class="faq-item">
          <h4>What apartment configurations are offered at Godrej Ananda?</h4>
          <p>Godrej Ananda offers premium 2BHK (904 sq.ft) and 3BHK (1229 sq.ft) apartments.</p>
        </div>
        <div class="faq-item">
          <h4>What is the estimated possession date for Godrej Ananda?</h4>
          <p>The expected possession date for Godrej Ananda is December 31, 2026.</p>
        </div>
      </div>
      </body></html>
    `,
    screenshotUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
    sampleMetaData: {
      sampleName: 'Godrej Ananda',
      sampleBuilder: 'Godrej Properties',
      sampleCity: 'Bengaluru',
      sampleZone: 'North',
      sampleLocation: 'Hebbal',
      sampleType: 'apartment',
      sampleRera: 'PRM/KA/RERA/1251/309/PR/210331/004084',
      samplePossession: 'Under Construction',
      samplePossessionDate: '2026-12-31',
      sampleUnits: [
        { type: '2BHK', currency: 'INR', minPrice: 6500000, maxPrice: 7200000, interiorArea: 904 },
        { type: '3BHK', currency: 'INR', minPrice: 8800000, maxPrice: 9800000, interiorArea: 1229 }
      ],
      sampleAmenities: ['Swimming Pool', 'Gymnasium', 'Clubhouse', 'Jogging Track', '24x7 Security'],
      sampleFaqs: [
        { question: 'What is the RERA registration number of Godrej Ananda?', answer: 'The RERA registration number for Godrej Ananda is PRM/KA/RERA/1251/309/PR/210331/004084.' },
        { question: 'Where is Godrej Ananda located?', answer: 'Godrej Ananda is strategically located in Bagalur, North Bengaluru near KIADB Aerospace Park.' },
        { question: 'What apartment configurations are offered at Godrej Ananda?', answer: 'Godrej Ananda offers premium 2BHK (904 sq.ft) and 3BHK (1229 sq.ft) apartments.' },
        { question: 'What is the estimated possession date for Godrej Ananda?', answer: 'The expected possession date for Godrej Ananda is December 31, 2026.' }
      ],
      sampleAdvantages: [
        { title: 'Prime Aerospace Park Location', description: 'Situated directly opposite KIADB Aerospace Park with over 100,000+ upcoming tech jobs.' },
        { title: 'Excellent Airport Connectivity', description: 'Just a 15-minute signal-free drive to Kempegowda International Airport (BLR).' },
        { title: '2-Acre Green Park & Clubhouse', description: 'Over 2 acres of dedicated green foliage, reflexology gardens, and a 28,000 sq.ft luxury club.' },
        { title: 'High Rental Yield Zone', description: 'Rapidly appreciating growth corridor in North Bengaluru with high projected ROI.' },
        { title: 'Godrej Brand Legacy', description: 'Unmatched construction quality, timely delivery track record, and trusted brand value.' }
      ],
      sampleImages: [
        { type: 'image', title: 'banner', url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80', alt: 'Godrej Ananda Banner' }
      ]
    }
  },
  'dlf-one-midtown': {
    title: 'DLF One Midtown - Moti Nagar, Delhi',
    extractedHtml: `
      <html><body>
      <h1>DLF One Midtown</h1>
      <p>Builder: DLF India</p>
      <p>RERA: DLRERA2021P0007</p>
      <p>Location: Moti Nagar, City: Delhi NCR, Zone: West</p>
      <p>Type: Penthouse | Towers: 4 | Floors: G+39</p>
      <p>Status: Ready to Move | Possession Date: 2025-10-15</p>
      <div>
        <h3>Configurations</h3>
        <div>3BHK - 2400 sq.ft - Price ₹3.50 Cr to ₹4.20 Cr</div>
        <div>4BHK - 3800 sq.ft - Price ₹5.50 Cr to ₹6.80 Cr</div>
      </div>
      <div>
        <h3>Amenities</h3>
        <span>Swimming Pool</span>, <span>Gymnasium</span>, <span>Clubhouse</span>, <span>Tennis Court</span>, <span>Power Backup</span>
      </div>
      <div class="faq-section">
        <h3>DLF One Midtown FAQs</h3>
        <div class="faq-item">
          <h4>What is the RERA number for DLF One Midtown?</h4>
          <p>The RERA registration number for DLF One Midtown is DLRERA2021P0007.</p>
        </div>
        <div class="faq-item">
          <h4>What unit types and configurations are available at DLF One Midtown?</h4>
          <p>DLF One Midtown features 3BHK (2400 sq.ft) and 4BHK (3800 sq.ft) luxury apartments and penthouses.</p>
        </div>
        <div class="faq-item">
          <h4>What is the possession status of DLF One Midtown?</h4>
          <p>DLF One Midtown is Ready to Move with possession scheduled from October 15, 2025.</p>
        </div>
      </div>
      </body></html>
    `,
    screenshotUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    sampleMetaData: {
      sampleName: 'DLF One Midtown',
      sampleBuilder: 'DLF India',
      sampleCity: 'Delhi NCR',
      sampleZone: 'West',
      sampleLocation: 'Moti Nagar',
      sampleType: 'penthouse',
      sampleRera: 'DLRERA2021P0007',
      samplePossession: 'Ready to Move',
      samplePossessionDate: '2025-10-15',
      sampleUnits: [
        { type: '3BHK', currency: 'INR', minPrice: 35000000, maxPrice: 42000000, interiorArea: 2400 },
        { type: '4BHK', currency: 'INR', minPrice: 55000000, maxPrice: 68000000, interiorArea: 3800 }
      ],
      sampleAmenities: ['Swimming Pool', 'Gymnasium', 'Clubhouse', 'Tennis Court', 'Power Backup'],
      sampleFaqs: [
        { question: 'What is the RERA number for DLF One Midtown?', answer: 'The RERA registration number for DLF One Midtown is DLRERA2021P0007.' },
        { question: 'What unit types and configurations are available at DLF One Midtown?', answer: 'DLF One Midtown features 3BHK (2400 sq.ft) and 4BHK (3800 sq.ft) luxury apartments and penthouses.' },
        { question: 'What is the possession status of DLF One Midtown?', answer: 'DLF One Midtown is Ready to Move with possession scheduled from October 15, 2025.' }
      ],
      sampleAdvantages: [
        { title: 'Heart of Central-West Delhi', description: 'Seamless access to Connaught Place, Karol Bagh, and Central Business Districts.' },
        { title: 'Triple Metro Line Connectivity', description: 'Walking distance to 3 major Delhi Metro lines (Blue, Green, and Pink).' },
        { title: '128-Acre DDA Green Forest View', description: 'Unobstructed scenic views of the lush green reserved forest right from your balcony.' },
        { title: 'Ultra-Luxury 45,000 sq.ft Clubhouse', description: 'World-class infinity pool, private bowling alley, spa, and Michelin-standard dining.' },
        { title: 'Gated 4-Tier High Security', description: 'Advanced biometric access, CCTV monitoring, and 24x7 security personnel.' }
      ],
      sampleImages: [
        { type: 'image', title: 'banner', url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80', alt: 'DLF One Midtown Front' }
      ]
    }
  }
};

const { scrapeWithPlaywright } = require('./playwright.service');

/**
 * Performs web page content scraping for real property URLs using Playwright browser automation
 */
async function scrapePropertyUrl(targetUrl) {
  let parsedUrl;
  try {
    parsedUrl = new urlModule.URL(targetUrl);
  } catch (err) {
    throw new Error(`Invalid URL provided: ${targetUrl}`);
  }

  const domain = parsedUrl.hostname.replace('www.', '');

  // 1. Check if explicitly requesting sample mock URL
  if (targetUrl.includes('mock://') || targetUrl.includes('sample://')) {
    const matchedKey = Object.keys(SAMPLE_SCRAPES).find(key => targetUrl.toLowerCase().includes(key));
    if (matchedKey) {
      const sample = SAMPLE_SCRAPES[matchedKey];
      return {
        sourceUrl: targetUrl,
        sourceDomain: domain,
        screenshotUrl: sample.screenshotUrl,
        extractedHtml: sample.extractedHtml,
        sampleMetaData: sample.sampleMetaData,
        isLiveFetch: false,
        scrapedAt: new Date().toISOString()
      };
    }
  }

  // 2. Perform Primary Browser Scrape via Playwright (executes JavaScript, expands Read More, captures screenshot)
  let fetchedHtml = '';
  let screenshotUrl = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80';
  let isLiveFetch = false;

  try {
    const pwResult = await scrapeWithPlaywright(targetUrl, { timeout: 22000 });
    if (pwResult && pwResult.success && pwResult.html && pwResult.html.length > 300) {
      fetchedHtml = pwResult.html;
      if (pwResult.screenshotUrl) {
        screenshotUrl = pwResult.screenshotUrl;
      }
      isLiveFetch = true;
    }
  } catch (pwErr) {
    console.warn(`[Scraper] Playwright attempt notice for ${targetUrl}:`, pwErr.message);
  }

  // 3. Fallback to Axios HTTP Web Scrape if Playwright was bypassed or failed
  if (!fetchedHtml || fetchedHtml.length < 300) {
    console.log(`[Scraper] Using Axios HTTP fallback for ${targetUrl}...`);
    const randomUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    try {
      const response = await axios.get(targetUrl, {
        headers: {
          'User-Agent': randomUserAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Chromium";v="124", "Not-A.Brand";v="99", "Google Chrome";v="124"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 12000,
        maxRedirects: 5
      });

      fetchedHtml = response.data || '';

      // Extract OpenGraph image if available for screenshot preview
      if (fetchedHtml) {
        const $ = cheerio.load(fetchedHtml);
        const ogImg = $('meta[property="og:image"]').attr('content') ||
                      $('meta[name="twitter:image"]').attr('content') ||
                      $('link[rel="image_src"]').attr('href');
        if (ogImg && ogImg.startsWith('http')) {
          screenshotUrl = ogImg;
        }
        isLiveFetch = fetchedHtml.length > 300;
      }
    } catch (err) {
      console.warn(`[Scraper] Axios fallback for ${targetUrl} encountered error:`, err.message);
    }
  }

  // 4. Extract path cues if needed as fallback metadata
  const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
  const slugPart = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : '';
  const genericName = slugPart
    .replace(/\.html?$/i, '')
    .replace(/-\d+$/, '')
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase()) || parsedUrl.hostname;

  // Final HTML payload
  const finalHtml = fetchedHtml && fetchedHtml.length > 300
    ? fetchedHtml
    : `<html><head><title>${genericName}</title></head><body><h1>${genericName}</h1><p>Property at URL: ${targetUrl}</p></body></html>`;

  return {
    sourceUrl: targetUrl,
    sourceDomain: domain,
    screenshotUrl,
    extractedHtml: finalHtml,
    sampleMetaData: {
      sampleName: genericName,
      sampleCity: 'Bengaluru'
    },
    isLiveFetch,
    scrapedAt: new Date().toISOString()
  };
}

module.exports = { scrapePropertyUrl, SAMPLE_SCRAPES };
