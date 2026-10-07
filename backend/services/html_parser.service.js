const cheerio = require('cheerio');

/**
 * Deterministic HTML & Metadata Parser for Real Estate Web Pages
 */

// Regex patterns for Indian RERA numbers across major states
const RERA_PATTERNS = [
  // Karnataka (e.g. PRM/KA/RERA/1251/309/PR/210331/004084 or PR/KN/170729/000001)
  /PRM\/[A-Z]{2}\/RERA\/\d{3,5}\/\d{3,5}\/[A-Z]{2}\/\d{6}\/\d{6}/i,
  /PR\/[A-Z]{2}\/\d{6}\/\d{6}/i,
  // Maharashtra (e.g. P51800001234, P51900005678)
  /P[0-9]{11}/i,
  // Delhi (e.g. DLRERA2021P0007)
  /DLRERA\d{4}[A-Z]\d{4}/i,
  // Haryana (e.g. HRERA-PKL-123-2022 or 123 of 2022)
  /HRERA[A-Z0-9\-\/ ]+/i,
  // Generic RERA patterns
  /RERA\s*(?:NO|NUMBER|ID|REGISTRATION|REG)?[\s:\-\.]*([A-Z0-9\/\-]{8,35})/i
];

// Price regexes for Indian real estate format
const PRICE_PATTERNS = [
  /(?:₹|Rs\.?|INR)\s*([\d\.]+)\s*(?:Cr(?:ore)?s?)/gi,
  /(?:₹|Rs\.?|INR)\s*([\d\.]+)\s*(?:L(?:ac|akh)?s?)/gi,
  /([\d\.]+)\s*(?:Cr(?:ore)?s?)/gi,
  /([\d\.]+)\s*(?:L(?:ac|akh)?s?)/gi
];

/**
 * Parse JSON-LD script tags from HTML
 */
function extractJsonLd(html) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const jsonLdData = [];

  $('script[type="application/ld+json"]').each((_, elem) => {
    try {
      const text = $(elem).html()?.trim();
      if (text) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          jsonLdData.push(...parsed);
        } else {
          jsonLdData.push(parsed);
        }
      }
    } catch (e) {
      // Ignore malformed JSON-LD scripts
    }
  });

  return jsonLdData;
}

/**
 * Extract OpenGraph & standard Meta tags
 */
function extractMetaTags(html) {
  if (!html) return {};
  const $ = cheerio.load(html);

  const getMeta = (nameOrProp) =>
    $(`meta[name="${nameOrProp}"]`).attr('content') ||
    $(`meta[property="${nameOrProp}"]`).attr('content') ||
    null;

  return {
    title: $('title').text()?.trim() || getMeta('og:title') || getMeta('twitter:title') || null,
    description: getMeta('description') || getMeta('og:description') || getMeta('twitter:description') || null,
    image: getMeta('og:image') || getMeta('twitter:image') || null,
    siteName: getMeta('og:site_name') || null,
    locality: getMeta('og:locality') || getMeta('geo.placename') || null,
    region: getMeta('og:region') || null
  };
}

/**
 * Deterministically extract RERA number from HTML or raw text
 */
function extractReraNumber(text) {
  if (!text) return null;
  for (const pattern of RERA_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const found = match[1] || match[0];
      const cleaned = found.trim().replace(/^RERA\s*[:\-\.]?\s*/i, '');
      if (cleaned.length >= 7) return cleaned;
    }
  }
  return null;
}

const MONTH_MAP = {
  'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
  'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
  'january': '01', 'february': '02', 'march': '03', 'april': '04', 'june': '06',
  'july': '07', 'august': '08', 'september': '09', 'october': '10', 'november': '11', 'december': '12'
};

function parsePossessionDateToIso(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim();

  // Pattern: "30-Jun-2034" or "30/06/2034" or "30-06-2034"
  const dmyMatch = clean.match(/^(\d{1,2})[\s\-\/]([A-Za-z]{3,9}|\d{1,2})[\s\-\/](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    let month = dmyMatch[2].toLowerCase();
    if (MONTH_MAP[month]) {
      month = MONTH_MAP[month];
    } else {
      month = month.padStart(2, '0');
    }
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Pattern: "Jun-2034" or "June 2034" or "Dec 2027"
  const myMatch = clean.match(/^([A-Za-z]{3,9})[\s\-\/](\d{4})$/);
  if (myMatch) {
    const month = MONTH_MAP[myMatch[1].toLowerCase()] || '12';
    const year = myMatch[2];
    const lastDay = ['04', '06', '09', '11'].includes(month) ? '30' : (month === '02' ? '28' : '31');
    return `${year}-${month}-${lastDay}`;
  }

  // Pattern: "2034-06-30" (Already ISO)
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  return null;
}

/**
 * Deterministically extract Possession Date from top summary card, chips, or text
 */
function extractPossessionDate(html, rawText = '') {
  if (!html && !rawText) return null;

  if (html) {
    const $ = cheerio.load(html);

    // 1. Check direct element following a "Possession" label in top info card
    let foundDate = null;
    $('p, span, div, dt, td').each((_, el) => {
      if (foundDate) return;
      const t = $(el).clone().children().remove().end().text().trim();
      if (/^possession(?:\s*date)?$/i.test(t)) {
        const nextVal = $(el).next().text().trim() ||
                        $(el).parent().find('p:not(:first-child), span:not(:first-child), dd').last().text().trim();
        if (nextVal && !nextVal.toLowerCase().includes('possession')) {
          const iso = parsePossessionDateToIso(nextVal);
          if (iso) foundDate = iso;
        }
      }
    });

    if (foundDate) return foundDate;

    // 2. Check elements containing "Possession" with date string in same container
    $('div, section').each((_, el) => {
      if (foundDate) return;
      const t = $(el).text().trim();
      const match = t.match(/Possession[\s:\-]*([0-9]{1,2}[\s\-\/][A-Za-z]{3,9}[\s\-\/][0-9]{4}|[A-Za-z]{3,9}[\s\-\/][0-9]{4})/i);
      if (match && match[1]) {
        const iso = parsePossessionDateToIso(match[1]);
        if (iso) foundDate = iso;
      }
    });

    if (foundDate) return foundDate;
  }

  // 3. Fallback regex on raw text
  const textMatch = (rawText || '').match(/(?:possession(?:\s*(?:date|expected|timeline|by))?[\s:\-]*)([0-9]{1,2}[\s\-\/][A-Za-z]{3,9}[\s\-\/][0-9]{4}|[A-Za-z]{3,9}\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i);
  if (textMatch && textMatch[1]) {
    return parsePossessionDateToIso(textMatch[1]);
  }

  return null;
}

/**
 * Deterministically extract 6-digit Indian Pincode from address header, DOM, or text
 */
function extractPincode(html, text = '') {
  if (!html && !text) return null;

  if (html) {
    const $ = cheerio.load(html);

    // 1. Check address element in header card (e.g. .text-slate-500, [class*="address"], [itemprop="address"])
    let foundPin = null;
    $('[class*="address"], .text-slate-500, .address, [itemprop="streetAddress"], [itemprop="postalCode"], .location-address').each((_, el) => {
      if (foundPin) return;
      const t = $(el).text().trim();
      const pinMatch = t.match(/\b([1-9][0-9]{5})\b/);
      if (pinMatch && pinMatch[1]) {
        foundPin = pinMatch[1];
      }
    });

    if (foundPin) return foundPin;
  }

  const allText = (text || '') + '\n' + (html ? cheerio.load(html).text() : '');

  // Look for explicit "pincode: 560018" or "pin - 560018" or "Mumbai 400013"
  const explicitMatch = allText.match(/(?:pin(?:code)?|postal\s*code|zip\s*code|pin\s*no\.?|mumbai|bengaluru|bangalore|pune|hyderabad|delhi|chennai|kolkata)[\s:\-,\.a-zA-Z]*\b([1-9][0-9]{5})\b/i);
  if (explicitMatch && explicitMatch[1]) {
    return explicitMatch[1];
  }

  // Fallback: match standalone 6 digit pincodes that are NOT part of URLs, RERA numbers, or dates
  const standaloneMatches = allText.match(/\b([1-9][0-9]{5})\b/g);
  if (standaloneMatches) {
    for (const m of standaloneMatches) {
      if (!allText.includes(`/${m}`) && !allText.includes(`-${m}`)) {
        return m;
      }
    }
  }

  return null;
}

/**
 * Extract Geographic Coordinates (Latitude, Longitude) from HTML meta or JSON-LD
 */
function extractCoordinates(html, jsonLdData = []) {
  if (!html) return { latitude: null, longitude: null };
  const $ = cheerio.load(html);

  // Check meta tags: geo.position (e.g. "12.9716;77.5946" or "12.9716, 77.5946") or ICBM
  const geoPos = $('meta[name="geo.position"]').attr('content') ||
                 $('meta[name="ICBM"]').attr('content') ||
                 $('meta[property="place:location:latitude"]').attr('content');

  if (geoPos) {
    const parts = geoPos.split(/[;,]/).map(s => s.trim());
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }
  }

  const latAttr = $('meta[property="place:location:latitude"]').attr('content') ||
                  $('meta[name="latitude"]').attr('content');
  const lngAttr = $('meta[property="place:location:longitude"]').attr('content') ||
                  $('meta[name="longitude"]').attr('content');

  if (latAttr && lngAttr) {
    const lat = parseFloat(latAttr);
    const lng = parseFloat(lngAttr);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  // Check JSON-LD geo coordinates
  for (const item of jsonLdData) {
    if (item && item.geo) {
      const lat = parseFloat(item.geo.latitude);
      const lng = parseFloat(item.geo.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }
  }

  return { latitude: null, longitude: null };
}

/**
 * Convert Indian formatted string (Cr, Lakh) to integer in INR
 */
function parseIndianPrice(priceStr) {
  if (!priceStr || typeof priceStr !== 'string') return null;
  const clean = priceStr.replace(/,/g, '').trim();

  const crMatch = clean.match(/([\d\.]+)\s*(?:Cr(?:ore)?s?)/i);
  if (crMatch) {
    return Math.round(parseFloat(crMatch[1]) * 10000000);
  }

  const lacMatch = clean.match(/([\d\.]+)\s*(?:L(?:ac|akh)?s?)/i);
  if (lacMatch) {
    return Math.round(parseFloat(lacMatch[1]) * 100000);
  }

  const directNum = parseInt(clean.replace(/[^\d]/g, ''), 10);
  if (!isNaN(directNum) && directNum > 10000) {
    return directNum;
  }

  return null;
}

/**
 * Extract FAQs from JSON-LD FAQPage schemas
 */
function extractFaqsFromJsonLd(jsonLdData) {
  if (!Array.isArray(jsonLdData) || jsonLdData.length === 0) return [];
  const faqs = [];

  for (const item of jsonLdData) {
    if (!item || typeof item !== 'object') continue;

    // Direct FAQPage schema: { "@type": "FAQPage", "mainEntity": [ ... ] }
    if (item['@type'] === 'FAQPage' || item['@type']?.includes?.('FAQPage')) {
      const entities = Array.isArray(item.mainEntity) ? item.mainEntity : (item.mainEntity ? [item.mainEntity] : []);
      for (const ent of entities) {
        if (!ent) continue;
        const qText = (ent.name || ent.text || '').trim();
        let aText = '';
        if (ent.acceptedAnswer) {
          aText = typeof ent.acceptedAnswer === 'string'
            ? ent.acceptedAnswer
            : (ent.acceptedAnswer.text || ent.acceptedAnswer.name || '');
        } else if (ent.suggestedAnswer) {
          aText = typeof ent.suggestedAnswer === 'string'
            ? ent.suggestedAnswer
            : (ent.suggestedAnswer.text || ent.suggestedAnswer.name || '');
        }

        // Clean HTML tags from answer text
        aText = aText.replace(/<[^>]+>/g, ' ').replace(/\s\s+/g, ' ').trim();

        if (qText && aText && !faqs.some(f => f.question.toLowerCase() === qText.toLowerCase())) {
          faqs.push({ question: qText, answer: aText });
        }
      }
    }

    // Direct Question entities
    if (item['@type'] === 'Question') {
      const qText = (item.name || item.text || '').trim();
      const aText = (item.acceptedAnswer?.text || item.acceptedAnswer?.name || '').replace(/<[^>]+>/g, ' ').trim();
      if (qText && aText && !faqs.some(f => f.question.toLowerCase() === qText.toLowerCase())) {
        faqs.push({ question: qText, answer: aText });
      }
    }
  }

  return faqs;
}

/**
 * Extract FAQs from common HTML accordion / FAQ structures
 */
function extractFaqsFromHtml(html) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const faqs = [];

  // Pattern 1: schema.org Microdata (<div itemscope itemtype="https://schema.org/Question">)
  $('[itemtype*="schema.org/Question"], [itemtype*="schema.org/FAQPage"]').each((_, elem) => {
    const qElem = $(elem).find('[itemprop="name"], [itemprop="text"]').first();
    const aElem = $(elem).find('[itemprop="acceptedAnswer"], [itemprop="text"]').last();
    const q = qElem.text().trim();
    const a = aElem.text().trim();
    if (q && a && q !== a && !faqs.some(f => f.question.toLowerCase() === q.toLowerCase())) {
      faqs.push({ question: q, answer: a });
    }
  });

  // Pattern 2: HTML5 <details><summary>Question</summary><p>Answer</p></details>
  $('details').each((_, elem) => {
    const q = $(elem).find('summary').text().trim();
    // Clone and remove summary to get clean answer
    const clone = $(elem).clone();
    clone.find('summary').remove();
    const a = clone.text().replace(/\s\s+/g, ' ').trim();
    if (q && a && q.length > 5 && a.length > 5 && !faqs.some(f => f.question.toLowerCase() === q.toLowerCase())) {
      faqs.push({ question: q, answer: a });
    }
  });

  // Pattern 3: Common FAQ container classes (.faq-item, .accordion-item, [id*="faq"], [class*="faq-card"])
  $('.faq-item, .faq-box, .faq_item, .faq-card, .accordion-item, .faq-row').each((_, elem) => {
    const qElem = $(elem).find('h2, h3, h4, h5, .faq-question, .accordion-header, .accordion-title, .question, .faq-title').first();
    const aElem = $(elem).find('.faq-answer, .accordion-body, .accordion-content, .answer, p, .faq-desc').first();
    const q = qElem.text().trim();
    const a = aElem.text().trim();
    if (q && a && q.length > 5 && a.length > 5 && !faqs.some(f => f.question.toLowerCase() === q.toLowerCase())) {
      faqs.push({ question: q, answer: a });
    }
  });

  return faqs;
}

/**
 * Check if a text is a generic portal SEO boilerplate (e.g. "Explore 1,2,3 BHK... on Houssed")
 */
function isGenericSeoDescription(text) {
  if (!text || typeof text !== 'string') return true;
  const clean = text.trim().toLowerCase();
  if (clean.length < 30) return true;
  // Generic portal advertisement / SEO templates
  if (/\b(on houssed|on 99acres|on magicbricks|on housing\.com|on nobroker|on squareyards|on justdial)\b/i.test(clean)) return true;
  if (/^explore\s+[\d,\.\s]+bhk\b/i.test(clean) && clean.includes('check updated prices')) return true;
  if (/^find\s+[\d,\.\s]+bhk\b/i.test(clean) && clean.includes('verified homes')) return true;
  if (/^search\s+[\d,\.\s]+bhk\b/i.test(clean)) return true;
  return false;
}

/**
 * Check if a paragraph is a locality/neighborhood description rather than a project description
 */
function isLocalityParagraph(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim();
  
  if (/^[A-Za-z\s\.-]+\s+is\s+a\s+(?:fast-developing|prominent|well-connected|popular|prime|developing|bustling|thriving|sought-after)\s+(?:residential|commercial|micro-market|neighbourhood|neighborhood|locality|area|suburb|hub)\b/i.test(clean)) {
    return true;
  }
  if (/^(?:with increasing residential development|the locality offers access to daily conveniences|connectivity to major commercial hubs|real estate in [a-z\s]+ is driven by)/i.test(clean)) {
    return true;
  }
  if (/^(?:about|overview of)\s+(?:the\s+)?locality\b/i.test(clean)) {
    return true;
  }
  if (/\b(?:locality offers|neighbourhood offers|infrastructure growth in|living in [A-Za-z\s]+ offers)\b/i.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Deterministically extract authentic multi-paragraph project description from HTML DOM
 */
function extractProjectDescription(html) {
  if (!html) return null;
  const $ = cheerio.load(html);

  // Strategy 1: High-Priority search for dedicated "Project Overview of <Project>" card / section
  let projectOverviewDesc = null;
  $('h1, h2, h3, h4').each((_, h) => {
    if (projectOverviewDesc) return;
    const txt = $(h).text().replace(/\s\s+/g, ' ').trim();
    if (/^project\s+overview(?:\s+of)?\b/i.test(txt)) {
      const section = $(h).closest('section, div.rounded-2xl, div[class*="shadow"]');
      if (section.length > 0) {
        const contentDivs = section.find('div[class*="line-clamp"], div.text-sm.leading-7, div.blog-content, div:not([class*="grid"]):not([class*="flex"])');
        contentDivs.each((_, cd) => {
          if (projectOverviewDesc) return;
          const clone = $(cd).clone();
          clone.find('button, svg, a, script, style, table, thead, tbody').remove();
          clone.find('br').replaceWith('\n');
          const cleanText = clone.text().replace(/\n\s*\n\s*\n/g, '\n\n').trim();
          if (cleanText.length > 80 && !cleanText.toLowerCase().includes('project status') && !isGenericSeoDescription(cleanText) && !isLocalityParagraph(cleanText)) {
            projectOverviewDesc = cleanText;
          }
        });
      }
    }
  });

  if (projectOverviewDesc) return projectOverviewDesc;

  // Strategy 2: Content selectors across real estate portals and builder project landing pages
  const candidateSelectors = [
    '#project-overview',
    '#overview',
    '#about-project',
    '#about',
    '#description',
    '.project-overview',
    '.overview-section',
    '.about-project',
    '.project-description',
    '.property-description',
    '.overview-description',
    '.overview-details',
    '.read-more-content',
    '.readMoreContent',
    '.read-more-wrap',
    '.read-more-text',
    '[class*="overview"] [class*="description"]',
    '[class*="overview"] [class*="content"]',
    '[class*="about"] [class*="content"]',
    '[class*="about"] [class*="desc"]',
    '[class*="project-details"] [class*="description"]',
    '[data-qa="project-overview"]',
    '[data-qa="description"]',
    'section[id*="overview"]',
    'section[class*="overview"]',
    'section[id*="about"]',
    'section[class*="about"]'
  ];

  let rawParagraphs = [];

  for (const selector of candidateSelectors) {
    const el = $(selector);
    if (el.length > 0) {
      el.find('p, span.text, div.text, div.desc, div.paragraph').each((_, p) => {
        const txt = $(p).text().replace(/\s\s+/g, ' ').trim();
        // Skip button labels, disclaimers, or Read More/Less toggles
        if (txt && txt.length > 35 && !txt.match(/^(read\s*(more|less)|view\s*(more|less)|show\s*(more|less)|enquire\s*now|download\s*brochure|disclaimer:)\s*\^?$/i)) {
          if (!isGenericSeoDescription(txt) && !isLocalityParagraph(txt)) {
            rawParagraphs.push(txt);
          }
        }
      });
      if (rawParagraphs.length > 0) break;
    }
  }

  // Strategy 3: Heading-based search
  if (rawParagraphs.length === 0) {
    $('h1, h2, h3, h4').each((_, h) => {
      if (rawParagraphs.length > 0) return;
      const hText = $(h).text().toLowerCase().trim();
      if (hText.includes('overview') || (hText.includes('about') && !hText.includes('builder') && !hText.includes('developer') && !hText.includes('locality')) || hText.includes('project details')) {
        const parentSection = $(h).closest('section, div.rounded-2xl, div[class*="card"], div[class*="container"]');
        if (parentSection.length > 0) {
          parentSection.find('p').each((_, p) => {
            const pt = $(p).text().replace(/\s\s+/g, ' ').trim();
            if (pt.length > 35 && !isGenericSeoDescription(pt) && !isLocalityParagraph(pt) && !pt.toLowerCase().startsWith('disclaimer')) {
              rawParagraphs.push(pt);
            }
          });
        }
      }
    });
  }

  // Deduplicate paragraphs preserving natural order
  const unique = [];
  for (const p of rawParagraphs) {
    if (!unique.some(u => u.toLowerCase() === p.toLowerCase())) {
      unique.push(p);
    }
  }

  return unique.length > 0 ? unique.join('\n\n') : null;
}

/**
 * Clean and compact HTML down to meaningful text/structural DOM for AI
 * Strips script, style, svg, header, footer, nav, tracking tags while preserving
 * collapsible content (such as Read More description blocks)
 */
function cleanHtmlForAi(html, maxLength = 35000) {
  if (!html) return { cleanedText: '', discoveredImages: [] };
  const $ = cheerio.load(html);

  // Remove noise elements (avoid removing .hidden / display:none as description paragraphs are often collapsible)
  $('script, style, noscript, svg, iframe, nav, footer, header, form, link, meta, .cookie-banner, .modal, .popup, #cookie-consent').remove();

  // Extract images before stripping attributes
  const images = [];
  $('img').each((_, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-lazy-src');
    const alt = $(img).attr('alt') || '';
    if (src && !src.includes('data:image') && !src.includes('icon') && !src.includes('logo') && !src.includes('pixel') && !src.includes('avatar')) {
      images.push({ url: src, alt: alt.trim() });
    }
  });

  // Get text representation with key structure
  let bodyText = $('body').text() || $('html').text() || '';
  // Collapse whitespace
  bodyText = bodyText.replace(/\s\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim();

  if (bodyText.length > maxLength) {
    bodyText = bodyText.substring(0, maxLength);
  }

  return {
    cleanedText: bodyText,
    discoveredImages: images.slice(0, 10)
  };
}

/**
 * Deterministically extract structured specs (Towers, Floors, Total Units, Land Parcel, Possession Status)
 * from Project Overview cards / specification tables
 */
function extractProjectOverviewSpecs(html, rawText = '') {
  const result = {
    towers: null,
    floors: null,
    totalUnits: null,
    landParcel: null,
    possessionStatus: null
  };

  if (!html) return result;
  const $ = cheerio.load(html);

  // 1. Check Project Overview section grid chips (e.g. Houssed / Project Overview of <Project>)
  $('h1, h2, h3, h4').each((_, h) => {
    const hText = $(h).text().replace(/\s\s+/g, ' ').trim();
    if (/^project\s+overview(?:\s+of)?\b/i.test(hText)) {
      const section = $(h).closest('section, div.rounded-2xl, div[class*="shadow"]');
      if (section.length > 0) {
        section.find('div.grid > div, .flex.items-start, div[class*="flex"]').each((_, el) => {
          const label = $(el).find('p.text-xs, p.text-slate-400, span.text-xs, span.label, dt').first().text().replace(/\s\s+/g, ' ').trim();
          const val = $(el).find('p.text-sm, p.font-semibold, span.value, dd').last().text().replace(/\s\s+/g, ' ').trim();

          if (!label || !val || label.toLowerCase() === val.toLowerCase()) return;

          const lLower = label.toLowerCase();

          // No. of Units
          if (lLower.includes('no. of units') || lLower.includes('total units') || (lLower.includes('units') && !lLower.includes('bhk'))) {
            const numMatch = val.match(/(\d+)/);
            if (numMatch) {
              result.totalUnits = parseInt(numMatch[1], 10);
            } else if (val) {
              result.totalUnits = val;
            }
          }

          // Project Area / Land Parcel
          if (lLower.includes('project area') || lLower.includes('land parcel') || lLower.includes('plot area') || lLower.includes('total area')) {
            result.landParcel = val;
          }

          // Towers / Floors
          if (lLower.includes('towers') || lLower.includes('floors')) {
            const towersMatch = val.match(/(\d+)\s*Towers?/i);
            const floorsMatch = val.match(/(\d+)\s*Floors?/i);
            if (towersMatch) result.towers = parseInt(towersMatch[1], 10);
            if (floorsMatch) result.floors = parseInt(floorsMatch[1], 10);
            if (!result.floors && val.match(/G\s*\+\s*\d+/i)) {
              result.floors = val.match(/G\s*\+\s*\d+/i)[0];
            }
            if (!result.towers && val.match(/^(\d+)\s*$/)) {
              result.towers = parseInt(val, 10);
            }
          }

          // Project Status (New Launch, Under Construction, Ready to Move, Pre Launch)
          if (lLower.includes('project status') || lLower.includes('possession status') || lLower.includes('status')) {
            if (/new\s*launch/i.test(val)) result.possessionStatus = 'New Launch';
            else if (/pre\s*launch/i.test(val)) result.possessionStatus = 'Pre Launch';
            else if (/ready\s*to\s*move/i.test(val)) result.possessionStatus = 'Ready to Move';
            else if (/under\s*construction/i.test(val)) result.possessionStatus = 'Under Construction';
            else if (val) result.possessionStatus = val;
          }
        });
      }
    }
  });

  // 2. Fallback: Search general table / specification chips across page
  if (!result.totalUnits || !result.landParcel || !result.towers || !result.floors) {
    $('div, table, dl').each((_, el) => {
      const text = $(el).text();
      if (!result.towers) {
        const tm = text.match(/(\d+)\s*Towers?\s*[\/\|,\s]+\s*(\d+)\s*Floors?/i) || text.match(/Total\s*Towers?[\s:\-]+(\d+)/i);
        if (tm && tm[1]) result.towers = parseInt(tm[1], 10);
        if (tm && tm[2] && !result.floors) result.floors = parseInt(tm[2], 10);
      }
      if (!result.floors) {
        const fm = text.match(/Total\s*Floors?[\s:\-]+(\d+|G\s*\+\s*\d+)/i) || text.match(/(\d+)\s*Floors?/i);
        if (fm && fm[1]) result.floors = fm[1].includes('G') ? fm[1] : parseInt(fm[1], 10);
      }
      if (!result.totalUnits) {
        const um = text.match(/(?:Total\s*Units?|No\.\s*of\s*Units?)[\s:\-]+(\d+)/i);
        if (um && um[1]) result.totalUnits = parseInt(um[1], 10);
      }
      if (!result.landParcel) {
        const lm = text.match(/(?:Project\s*Area|Land\s*Parcel|Total\s*Area)[\s:\-]+([\d\.]+\s*(?:Acres?|Sq\.?\s*Yards?|Hectares?))/i);
        if (lm && lm[1]) result.landParcel = lm[1].trim();
      }
    });
  }

  return result;
}

/**
 * Full deterministic parser runner
 */
function parseHtmlSignals(rawHtml, sourceUrl = '') {
  const jsonLd = extractJsonLd(rawHtml);
  const meta = extractMetaTags(rawHtml);
  const rera = extractReraNumber(rawHtml);
  const { cleanedText, discoveredImages } = cleanHtmlForAi(rawHtml);
  const domDescription = extractProjectDescription(rawHtml);
  const projectOverviewSpecs = extractProjectOverviewSpecs(rawHtml, cleanedText);

  // Deterministically extract FAQs from JSON-LD and HTML structures
  const jsonLdFaqs = extractFaqsFromJsonLd(jsonLd);
  const htmlFaqs = extractFaqsFromHtml(rawHtml);
  const combinedFaqs = [...jsonLdFaqs];
  htmlFaqs.forEach(hf => {
    if (!combinedFaqs.some(f => f.question.toLowerCase() === hf.question.toLowerCase())) {
      combinedFaqs.push(hf);
    }
  });

  // Attempt to extract structured fields from JSON-LD if available
  let structuredName = null;
  let structuredDescription = null;
  let structuredImage = null;
  let structuredAddress = null;

  for (const item of jsonLd) {
    if (item.name && !structuredName) structuredName = item.name;
    if (item.description && !structuredDescription) structuredDescription = item.description;
    if (item.image && !structuredImage) {
      structuredImage = typeof item.image === 'string' ? item.image : (item.image.url || null);
    }
    if (item.address) {
      structuredAddress = item.address;
    }
  }

  // Extract pincode, coordinates, & possession date
  const pincode = extractPincode(rawHtml, cleanedText);
  const coords = extractCoordinates(rawHtml, jsonLd);
  const possessionDate = extractPossessionDate(rawHtml, cleanedText);

  // Extract builder name
  const structuredTitle = structuredName || meta.title;
  const structuredBuilder = extractBuilderName(rawHtml, cleanedText, jsonLd, structuredTitle, sourceUrl);

  return {
    meta,
    jsonLd,
    deterministicRera: rera,
    deterministicPincode: pincode,
    deterministicPossessionDate: possessionDate,
    deterministicCoordinates: coords,
    deterministicSpecs: projectOverviewSpecs,
    deterministicFaqs: combinedFaqs,
    structuredName: structuredTitle,
    structuredBuilder: structuredBuilder,
    structuredDescription: domDescription || structuredDescription || (isGenericSeoDescription(meta.description) ? null : meta.description),
    primaryImage: structuredImage || meta.image,
    discoveredImages,
    cleanedText
  };
}

const KNOWN_BUILDER_PREFIXES = [
  { prefix: /^godrej\b/i, name: 'Godrej Properties' },
  { prefix: /^prestige\b/i, name: 'Prestige Group' },
  { prefix: /^sobha\b/i, name: 'Sobha Limited' },
  { prefix: /^brigade\b/i, name: 'Brigade Group' },
  { prefix: /^puravankara\b/i, name: 'Puravankara' },
  { prefix: /^purva\b/i, name: 'Puravankara' },
  { prefix: /^assetz\b/i, name: 'Assetz Property Group' },
  { prefix: /^total\s*environment\b/i, name: 'Total Environment' },
  { prefix: /^casagrand\b/i, name: 'Casagrand' },
  { prefix: /^mahindra\b/i, name: 'Mahindra Lifespaces' },
  { prefix: /^shriram\b/i, name: 'Shriram Properties' },
  { prefix: /^bhartiya\b/i, name: 'Bhartiya City' },
  { prefix: /^l&t\b|^l\s*and\s*t\b/i, name: 'L&T Realty' },
  { prefix: /^tata\b/i, name: 'Tata Housing' },
  { prefix: /^embassy\b/i, name: 'Embassy Group' },
  { prefix: /^sattva\b|^salarpuria\b/i, name: 'Sattva Group' },
  { prefix: /^lodha\b/i, name: 'Lodha Group' },
  { prefix: /^hiranandani\b/i, name: 'Hiranandani' },
  { prefix: /^dlf\b/i, name: 'DLF Limited' },
  { prefix: /^kolte\s*patil\b/i, name: 'Kolte Patil' },
  { prefix: /^rohan\b/i, name: 'Rohan Builders' },
  { prefix: /^shapoorji\b/i, name: 'Shapoorji Pallonji' },
  { prefix: /^vtp\b/i, name: 'VTP Realty' },
  { prefix: /^goyal\b/i, name: 'Goyal & Co' },
  { prefix: /^sumadhura\b/i, name: 'Sumadhura Group' },
  { prefix: /^sowparnika\b/i, name: 'Sowparnika Projects' },
  { prefix: /^concorde\b/i, name: 'Concorde Group' },
  { prefix: /^provident\b/i, name: 'Provident Housing' },
  { prefix: /^mana\b/i, name: 'Mana Projects' },
  { prefix: /^ozone\b/i, name: 'Ozone Group' },
  { prefix: /^century\b/i, name: 'Century Real Estate' },
  { prefix: /^divyasree\b/i, name: 'DivyaSree' },
  { prefix: /^aparna\b/i, name: 'Aparna Constructions' },
  { prefix: /^my\s*home\b/i, name: 'My Home Group' },
  { prefix: /^rustomjee\b/i, name: 'Rustomjee' },
  { prefix: /^runwal\b/i, name: 'Runwal Group' },
  { prefix: /^kalpataru\b/i, name: 'Kalpataru' },
  { prefix: /^piramal\b/i, name: 'Piramal Realty' },
  { prefix: /^oberoi\b/i, name: 'Oberoi Realty' },
  { prefix: /^dosti\b/i, name: 'Dosti Realty' },
  { prefix: /^sunteck\b/i, name: 'Sunteck Realty' },
  { prefix: /^adani\b/i, name: 'Adani Realty' },
  { prefix: /^k\s*raheja\b|^raheja\b/i, name: 'K Raheja Corp' }
];

function slugToTitle(slug) {
  if (!slug) return '';
  return slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => {
      const lower = w.toLowerCase();
      if (lower === 'and') return '&';
      if (lower === 'pvt' || lower === 'ltd' || lower === 'llp') return lower.toUpperCase();
      if (lower === 'lt' || lower === 'l&t') return 'L&T';
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

function extractBuilderName(html, rawText, jsonLdData = [], projectName = '', sourceUrl = '') {
  if (!html && !rawText && !projectName && !sourceUrl) return null;

  // 1. Check URL Structure for known portal patterns (e.g. houssed.com/city/builder-slug/project-slug)
  if (sourceUrl) {
    try {
      const parsedUrl = new URL(sourceUrl);
      const segments = parsedUrl.pathname.split('/').filter(Boolean);
      if (parsedUrl.hostname.includes('houssed.com') && segments.length >= 3) {
        // segments[0] = city, segments[1] = builder-slug, segments[2] = project-slug
        const builderSlug = segments[1];
        if (builderSlug && !builderSlug.match(/^(project|property|search|buy|rent|properties|projects)$/i)) {
          return slugToTitle(builderSlug);
        }
      }
    } catch {
      // ignore URL parsing errors
    }
  }

  // 2. Check JSON-LD
  if (Array.isArray(jsonLdData)) {
    for (const item of jsonLdData) {
      if (!item || typeof item !== 'object') continue;
      const candidate = item.brand?.name || item.author?.name || item.publisher?.name || item.creator?.name || item.provider?.name || item.developer?.name || item.legalName;
      if (candidate && typeof candidate === 'string' && candidate.trim().length > 2 && candidate.trim().length < 50) {
        return candidate.trim();
      }
    }
  }

  // 3. Check DOM Elements
  if (html) {
    const $ = cheerio.load(html);
    const candidateEl = $('.developer_name, .developer-name, .builder_name, .builder-name, .dev-name, [class*="developer-title"], [class*="builder-title"]').first();
    if (candidateEl.length > 0) {
      const txt = candidateEl.text().replace(/\s\s+/g, ' ').trim();
      if (txt && txt.length > 2 && txt.length < 50 && !txt.toLowerCase().includes('about')) {
        return txt;
      }
    }
  }

  // 4. Regex match in clean text / raw html
  const textToSearch = (rawText || '') + '\n' + (html || '');
  const builderPatterns = [
    /(?:developed|built|promoted|constructed|project)\s+by[\s:\-\.]*([A-Za-z0-9\s&,.'-]{3,40}?)(?:\n|<|,|\.|\s*-\s*|\s*\||\s*\(|\s*RERA)/i,
    /(?:developer|builder|promoter)\s*[:\-\.]\s*([A-Za-z0-9\s&,.'-]{3,40}?)(?:\n|<|,|\.|\s*-\s*|\s*\||\s*\()/i,
    /About\s+(?:the\s+)?(?:Builder|Developer|Group)\s*[:\-\.]*\s*([A-Za-z0-9\s&,.'-]{3,40}?)(?:\n|<|,|\.|\s*-\s*|\s*\|)/i
  ];

  for (const pat of builderPatterns) {
    const match = textToSearch.match(pat);
    if (match && match[1]) {
      const clean = match[1].trim();
      if (clean.length >= 3 && clean.length <= 45 && !clean.match(/^(a|an|the|this|project|home|bangalore|mumbai|rera|details)$/i)) {
        return clean;
      }
    }
  }

  // 5. Match prefix of Project Name against top known developers
  const nameToCheck = (projectName || '').trim();
  if (nameToCheck) {
    for (const kb of KNOWN_BUILDER_PREFIXES) {
      if (kb.prefix.test(nameToCheck)) {
        return kb.name;
      }
    }
  }

  return null;
}

module.exports = {
  parseHtmlSignals,
  extractJsonLd,
  extractMetaTags,
  extractReraNumber,
  extractPincode,
  extractPossessionDate,
  extractCoordinates,
  extractFaqsFromJsonLd,
  extractFaqsFromHtml,
  extractProjectDescription,
  extractProjectOverviewSpecs,
  extractBuilderName,
  slugToTitle,
  isGenericSeoDescription,
  isLocalityParagraph,
  parseIndianPrice,
  cleanHtmlForAi
};
