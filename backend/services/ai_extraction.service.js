const axios = require('axios');
const { parseHtmlSignals, parseIndianPrice, isGenericSeoDescription, isLocalityParagraph } = require('./html_parser.service');
const { validateAndCleanExtractedData } = require('./validation.service');

// Priority list of currently active & responsive Gemini models on v1beta API
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-3.7-flash'
];

/**
 * Normalizes extracted JSON keys into standard schema expected by backend & frontend
 */
function normalizeExtractedJson(rawObj, deterministicSignals = {}) {
  if (!rawObj || typeof rawObj !== 'object') rawObj = {};

  // Prefer deterministic RERA if present, or fallback to AI output
  const reraNumber = deterministicSignals.deterministicRera ||
    rawObj.rera || rawObj.rera_number || rawObj.reraNumber || rawObj.rera_no || null;

  // Extract full authentic description
  let rawDesc = rawObj.description || rawObj.overview || rawObj.about || null;
  const domDesc = deterministicSignals.structuredDescription || null;

  let finalDescription = rawDesc;
  if (isGenericSeoDescription(finalDescription) || (domDesc && typeof domDesc === 'string' && domDesc.length > (finalDescription?.length || 0))) {
    finalDescription = domDesc || (isGenericSeoDescription(rawDesc) ? null : rawDesc);
  }

  // Filter out any locality-specific paragraphs and clean trailing button labels
  if (finalDescription && typeof finalDescription === 'string') {
    const paragraphs = finalDescription
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 25 && !isGenericSeoDescription(p) && !isLocalityParagraph(p));

    finalDescription = (paragraphs.length > 0 ? paragraphs.join('\n\n') : finalDescription)
      .replace(/\s*(Read\s*Less|Read\s*More|View\s*More|Show\s*More)\s*\^?/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  const normalized = {
    // Step 1: Basic Details
    name: rawObj.name || rawObj.project_name || rawObj.projectName || rawObj.title || rawObj.property_name || deterministicSignals.structuredName || null,
    builderName: rawObj.builderName || rawObj.builder_name || rawObj.builder || rawObj.developer || rawObj.developerName || deterministicSignals.structuredBuilder || null,
    builder: rawObj.builderName || rawObj.builder_name || rawObj.builder || rawObj.developer || rawObj.developerName || deterministicSignals.structuredBuilder || null,
    description: finalDescription || domDesc || null,
    type: (rawObj.type || rawObj.property_type || rawObj.propertyType || 'apartment').toLowerCase(),
    sourceLink: rawObj.sourceLink || rawObj.propertySourceLink || rawObj.source_url || deterministicSignals.sourceUrl || null,
    tags: rawObj.tags || rawObj.tag || 'Featured Properties',
    possessionStatus: deterministicSignals.deterministicSpecs?.possessionStatus || rawObj.possessionStatus || rawObj.possession_status || rawObj.status || 'Under Construction',
    possessionDate: deterministicSignals.deterministicPossessionDate || rawObj.possessionDate || rawObj.possession_date || null,
    rera: reraNumber,

    // Step 2: Location
    city: rawObj.city || rawObj.city_name || rawObj.cityName || null,
    zone: rawObj.zone || rawObj.zone_name || rawObj.zoneName || null,
    location: rawObj.location || rawObj.location_name || rawObj.locality || rawObj.area || null,
    coordinateInputMethod: rawObj.coordinateInputMethod || 'Manual Entry',
    latitude: rawObj.latitude || deterministicSignals.deterministicCoordinates?.latitude || null,
    longitude: rawObj.longitude || deterministicSignals.deterministicCoordinates?.longitude || null,
    pincode: deterministicSignals.deterministicPincode || rawObj.pincode || rawObj.pinCode || rawObj.postalCode || null,

    // Step 3: Property Info
    towers: deterministicSignals.deterministicSpecs?.towers !== undefined && deterministicSignals.deterministicSpecs?.towers !== null ? deterministicSignals.deterministicSpecs.towers : (rawObj.towers || rawObj.total_towers || null),
    floors: deterministicSignals.deterministicSpecs?.floors !== undefined && deterministicSignals.deterministicSpecs?.floors !== null ? deterministicSignals.deterministicSpecs.floors : (rawObj.floors || rawObj.total_floors || null),
    totalUnits: deterministicSignals.deterministicSpecs?.totalUnits !== undefined && deterministicSignals.deterministicSpecs?.totalUnits !== null ? deterministicSignals.deterministicSpecs.totalUnits : (rawObj.totalUnits || rawObj.total_units || rawObj.units_count || null),
    landParcel: deterministicSignals.deterministicSpecs?.landParcel || rawObj.landParcel || rawObj.land_parcel || rawObj.project_size || null,
    transactionTag: rawObj.transactionTag || rawObj.transaction_tag || 'Sale',

    // Step 4: Units & Pricing
    units: [],

    // Step 5: Amenities
    amenities: rawObj.amenities || rawObj.facilities || [],

    // Step 6: Other Details (Advantages / Key Features & FAQs)
    advantages: [],
    faqs: [],

    // Step 7: Upload Files / Medias
    images: []
  };

  // Normalize Advantages / Key Features (Unique Selling Points)
  const rawAdvantages = rawObj.advantages || rawObj.key_features || rawObj.keyFeatures || rawObj.highlights || rawObj.usps || [];
  const normalizedAdvantages = [];
  if (Array.isArray(rawAdvantages)) {
    rawAdvantages.forEach((adv, idx) => {
      if (typeof adv === 'string') {
        normalizedAdvantages.push({
          title: `Key Highlight ${idx + 1}`,
          description: adv.trim()
        });
      } else if (typeof adv === 'object' && adv !== null) {
        const title = (adv.title || adv.name || adv.heading || `Key Feature ${idx + 1}`).trim();
        const desc = (adv.description || adv.desc || adv.detail || adv.text || '').trim();
        if (title || desc) {
          normalizedAdvantages.push({
            title: title || `Advantage ${idx + 1}`,
            description: desc || title
          });
        }
      }
    });
  }
  normalized.advantages = normalizedAdvantages;

  // Normalize FAQs array from AI output and deterministic page signals
  const rawFaqs = rawObj.faqs || rawObj.faq || rawObj.questions || rawObj.frequently_asked_questions || [];
  const combinedFaqs = [];

  // Add deterministic FAQs first if available
  if (Array.isArray(deterministicSignals.deterministicFaqs)) {
    deterministicSignals.deterministicFaqs.forEach(f => {
      if (f && f.question && f.answer) {
        combinedFaqs.push({
          question: f.question.trim(),
          answer: f.answer.trim()
        });
      }
    });
  }

  // Merge AI extracted FAQs
  if (Array.isArray(rawFaqs)) {
    rawFaqs.forEach(f => {
      if (typeof f === 'object' && f !== null) {
        const q = (f.question || f.q || f.title || '').trim();
        const a = (f.answer || f.a || f.response || f.desc || '').trim();
        if (q && a && !combinedFaqs.some(existing => existing.question.toLowerCase() === q.toLowerCase())) {
          combinedFaqs.push({ question: q, answer: a });
        }
      }
    });
  }

  normalized.faqs = combinedFaqs;

  // Normalize units array with all admin panel pricing & area attributes
  const rawUnits = rawObj.units || rawObj.unit_types || rawObj.unit_configurations || rawObj.configurations || [];
  if (Array.isArray(rawUnits)) {
    normalized.units = rawUnits.map(u => {
      if (typeof u === 'string') {
        return {
          type: u,
          areaStatus: 'Available',
          areaVisibility: 'Public',
          minArea: null,
          maxArea: null,
          interiorArea: null,
          priceStatus: 'Available',
          priceVisibility: 'Public',
          currency: 'INR',
          minPrice: null,
          maxPrice: null,
          floorPlanImage: null
        };
      }
      const minPrice = typeof u.minPrice === 'string' ? parseIndianPrice(u.minPrice) : (u.minPrice || u.min_price || (typeof u.price === 'string' ? parseIndianPrice(u.price) : u.price) || null);
      const maxPrice = typeof u.maxPrice === 'string' ? parseIndianPrice(u.maxPrice) : (u.maxPrice || u.max_price || (typeof u.price === 'string' ? parseIndianPrice(u.price) : u.price) || null);
      const minArea = typeof u.minArea === 'string' ? parseInt(u.minArea.replace(/[^\d]/g, ''), 10) : (u.minArea || (typeof u.interiorArea === 'string' ? parseInt(u.interiorArea.replace(/[^\d]/g, ''), 10) : (u.interiorArea || u.area || u.sqft || null)));
      const maxArea = typeof u.maxArea === 'string' ? parseInt(u.maxArea.replace(/[^\d]/g, ''), 10) : (u.maxArea || minArea || null);

      return {
        type: u.type || u.unit_type || '2BHK',
        areaStatus: u.areaStatus || 'Available',
        areaVisibility: u.areaVisibility || 'Public',
        minArea: minArea || null,
        maxArea: maxArea || minArea || null,
        interiorArea: minArea || null,
        priceStatus: u.priceStatus || 'Available',
        priceVisibility: u.priceVisibility || 'Public',
        currency: u.currency || 'INR',
        minPrice: minPrice || null,
        maxPrice: maxPrice || minPrice || null,
        floorPlanImage: u.floorPlanImage || u.floorPlan || null
      };
    });
  }

  // Combine discovered images with AI extracted images
  const discoveredImages = (deterministicSignals.discoveredImages || []).map(img => ({
    type: 'image',
    title: img.alt || normalized.name || 'Property Image',
    url: img.url,
    alt: img.alt || normalized.name || 'Property Image'
  }));

  const aiImages = (Array.isArray(rawObj.images) ? rawObj.images : []).map(img => {
    if (typeof img === 'string') {
      return { type: 'image', title: normalized.name || 'Property Image', url: img, alt: normalized.name || 'Property Image' };
    }
    return img;
  });

  if (deterministicSignals.primaryImage) {
    normalized.images.push({
      type: 'image',
      title: 'banner',
      url: deterministicSignals.primaryImage,
      alt: normalized.name || 'Property Banner'
    });
  }

  aiImages.forEach(img => {
    if (img && img.url && !normalized.images.some(i => i.url === img.url)) {
      normalized.images.push(img);
    }
  });

  discoveredImages.forEach(img => {
    if (img && img.url && !normalized.images.some(i => i.url === img.url)) {
      normalized.images.push(img);
    }
  });

  if (normalized.images.length === 0) {
    normalized.images = [
      { type: 'image', title: 'banner', url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80', alt: normalized.name || 'Property Image' }
    ];
  }

  normalized.logo = rawObj.logo || deterministicSignals.logo || null;
  normalized.thumbnail = rawObj.thumbnail || deterministicSignals.primaryImage || (normalized.images?.[0]?.url) || null;
  normalized.videos = Array.isArray(rawObj.videos) ? rawObj.videos : [];

  return normalized;
}

const http = require('http');
const localHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 10 });

/**
 * Helper to call Local OpenAI-Compatible LLM (Qwen 2.5 Coder in Docker)
 * Optimizes prompt to strictly fit within the 2048 token context limit
 */
async function extractWithLocalLlm(promptText, deterministicSignals = {}) {
  const localUrl = process.env.LOCAL_LLM_URL || 'http://localhost:8000/v1';
  const localModel = process.env.LOCAL_LLM_MODEL || 'qwen2.5-coder-7b-instruct';

  const endpoint = `${localUrl.replace(/\/$/, '')}/chat/completions`;
  const compactText = (deterministicSignals.cleanedText || promptText).substring(0, 2800);
  const compactPrompt = `Extract property JSON from this real estate page text:
Title: ${deterministicSignals.structuredName || 'N/A'}
RERA: ${deterministicSignals.deterministicRera || 'N/A'}
Text:
${compactText}

Return ONLY this JSON schema with no extra commentary:
{
  "name": "project name",
  "builderName": "developer name or null",
  "description": "full authentic project description paragraphs from the webpage text",
  "type": "apartment|villa|plot|penthouse",
  "sourceLink": "${deterministicSignals.sourceUrl || ''}",
  "tags": "Featured Properties",
  "rera": "${deterministicSignals.deterministicRera || 'RERA string or null'}",
  "city": "Bengaluru|Mumbai|Delhi NCR|Hyderabad|Pune",
  "zone": "East|West|North|South",
  "location": "neighborhood/locality",
  "coordinateInputMethod": "Manual Entry",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "pincode": "${deterministicSignals.deterministicPincode || '560001'}",
  "towers": 4,
  "floors": "G+24",
  "totalUnits": 500,
  "landParcel": "5 Acres",
  "transactionTag": "Sale",
  "possessionStatus": "Under Construction|Ready to Move",
  "possessionDate": "YYYY-MM-DD or null",
  "units": [{"type": "2BHK", "areaStatus": "Available", "areaVisibility": "Public", "minArea": 900, "maxArea": 1100, "priceStatus": "Available", "priceVisibility": "Public", "currency": "INR", "minPrice": 7500000, "maxPrice": 8500000}],
  "amenities": ["Swimming Pool", "Gym", "Club House"],
  "advantages": [{"title": "Strategic Location", "description": "Near major metro and tech hubs"}],
  "faqs": [{"question": "question text", "answer": "answer text"}]
}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`[Local LLM] Attempt ${attempt}/2 via Qwen Docker (${localModel})`);
      const response = await axios.post(
        endpoint,
        {
          model: localModel,
          messages: [
            { role: 'system', content: 'You are a real estate JSON extraction parser. Output pure JSON only.' },
            { role: 'user', content: compactPrompt }
          ],
          temperature: 0.1,
          max_tokens: 800
        },
        {
          timeout: 40000,
          httpAgent: localHttpAgent
        }
      );

      let rawContent = response.data?.choices?.[0]?.message?.content?.trim();
      if (rawContent) {
        rawContent = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(rawContent);
        console.log(`[Local LLM] Successfully extracted JSON via Qwen Coder (${localModel})`);
        return { data: parsed, model: `local-${localModel}` };
      }
    } catch (err) {
      const errDetail = err.response?.data?.detail || err.response?.data || err.message;
      console.warn(`[Local LLM] Attempt ${attempt} failed:`, errDetail);
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  return null;
}

/**
 * AI Extraction Module using Multi-Signal Parsing, Google Gemini API, & Local Qwen Coder Docker fallback
 */
async function extractPropertyData(scrapedPayload, options = {}) {
  const preferredProvider = options.provider || process.env.AI_PROVIDER || 'auto'; // 'gemini' | 'local' | 'auto'
  const apiKey = process.env.GEMINI_API_KEY;
  const rawHtml = scrapedPayload.extractedHtml || '';

  // 1. Run deterministic parser on HTML
  const sourceUrl = scrapedPayload.sourceUrl || scrapedPayload.source_url || scrapedPayload.url || '';
  const deterministicSignals = parseHtmlSignals(rawHtml, sourceUrl);

  // 2. Prepare structured context and prompt
  const promptText = `
You are a senior real estate data extraction specialist for JustFlip.in.
Extract detailed and accurate project information from the provided real estate webpage content.

CRITICAL EXTRACTION RULES:
1. Strict JSON output only.
2. Prices MUST be pure integers in INR (Indian Rupees):
   - Example: "₹1.45 Cr" or "1.45 Crores" -> 14500000
   - Example: "₹85 Lac" or "85 Lakhs" -> 8500000
   - Example: "₹65,00,000" -> 6500000
   - If price is "Price on Request" or not stated, return null.
3. RERA Numbers:
   - Extract exact full RERA registration string (e.g., "PRM/KA/RERA/1251/309/PR/210331/004084", "P51800012345", "DLRERA2021P0007").
   - If no RERA found, return null. NEVER fabricate.
4. City & Location:
   - Disambiguate accurately (Bengaluru, Mumbai, Delhi NCR, Hyderabad, Pune, Chennai).
   - "zone" should be one of: East, West, North, South, Central.
5. Unit Configurations:
   - Extract individual unit configurations with standard types ("1BHK", "2BHK", "3BHK", "4BHK", "Penthouse", "Villa").
   - Include interiorArea in sq.ft as integer if found.
6. Primary Developer Sales ONLY (CRITICAL):
   - We ONLY extract primary developer sale / new launch properties.
   - Do NOT extract monthly rental, lease, or PG accommodation listings.
   - If this page is a rental property (e.g., price per month), set "isRental": true.
7. Project Description (CRITICAL):
   - Extract the FULL, complete, authentic multi-paragraph project description / overview exactly as written on the webpage.
   - Do NOT extract generic portal SEO sentences (e.g., "Explore 1,2,3 BHK... Check updated prices... on Houssed/99acres"). Extract the real project overview paragraphs.
   - Include all paragraphs detailing the architecture, amenities, location advantages, and living experience.
   - Do NOT summarize into 1 line if full descriptive paragraphs exist on the page.
8. Advantages / Key Features (Unique Selling Points):
   - Extract 3 to 5 key advantages, USPs, location connectivity benefits, or architectural highlights.
   - Return as array: [{"title": "Short Heading", "description": "Detailed explanation"}].
9. Frequently Asked Questions (FAQs):
   - Extract all project-specific FAQs (Question & Answer pairs) found in the page text, accordion sections, or FAQ schema.
   - Return them as an array of objects: [{"question": "...", "answer": "..."}].
   - If no FAQs are present on the page, return an empty array [].
10. If a field is absent from the page, return null.

Target Schema (Exact match for JustFlip Admin Panel):
{
  "name": "string (project/property name)",
  "builderName": "string (builder/developer company name)",
  "description": "string (complete multi-paragraph project description/overview exactly as on the webpage)",
  "type": "apartment|villa|plot|penthouse|row house",
  "sourceLink": "string (original property URL)",
  "tags": "Featured Properties|New Launch|Hot Project",
  "isRental": false,
  "rera": "string or null",
  "city": "string",
  "zone": "string (East|West|North|South)",
  "location": "string (locality/neighborhood)",
  "coordinateInputMethod": "Manual Entry",
  "latitude": "number or null",
  "longitude": "number or null",
  "pincode": "string (6-digit Indian PIN) or null",
  "towers": "number or string or null",
  "floors": "string or null (e.g. B + G + 21 Floors)",
  "totalUnits": "number or null",
  "landParcel": "string or null (e.g. 5 Acres)",
  "transactionTag": "Sale|Rent|Resale",
  "possessionStatus": "Under Construction|Ready to Move|Pre-Launch",
  "possessionDate": "ISO date string YYYY-MM-DD or null",
  "units": [
    {
      "type": "2BHK",
      "areaStatus": "Available",
      "areaVisibility": "Public",
      "minArea": 900,
      "maxArea": 1100,
      "priceStatus": "Available",
      "priceVisibility": "Public",
      "currency": "INR",
      "minPrice": 7500000,
      "maxPrice": 8500000
    }
  ],
  "amenities": ["Swimming Pool", "Gym", "Club House", "24x7 Security"],
  "advantages": [
    { "title": "Prime Location", "description": "Close to major IT corridors and upcoming metro." }
  ],
  "faqs": [
    { "question": "What is the RERA registration number of the project?", "answer": "The RERA registration number is PRM/KA/RERA/..." }
  ]
}

KNOWN DETERMINISTIC SIGNALS FROM PAGE:
- Page Title: ${deterministicSignals.structuredName || 'Not found'}
- Detected RERA: ${deterministicSignals.deterministicRera || 'Not found'}
- Detected Pincode: ${deterministicSignals.deterministicPincode || 'Not found'}
- Meta Locality: ${deterministicSignals.meta.locality || 'Not found'}
- Detected FAQs: ${deterministicSignals.deterministicFaqs?.length || 0} found
- Detected Project Description: ${deterministicSignals.structuredDescription ? deterministicSignals.structuredDescription.substring(0, 300) + '...' : 'Not found'}

PAGE TEXT CONTENT:
${deterministicSignals.cleanedText || rawHtml.substring(0, 15000)}
`;

  let extractedRaw = null;
  let modelUsed = null;

  // Path A: Local Qwen First if provider === 'local'
  if (preferredProvider === 'local') {
    const localRes = await extractWithLocalLlm(promptText, deterministicSignals);
    if (localRes) {
      extractedRaw = localRes.data;
      modelUsed = localRes.model;
    }
  }

  // Path B: Gemini Cloud API (if provider === 'gemini' or 'auto' and not already extracted)
  if (!extractedRaw && (preferredProvider === 'gemini' || preferredProvider === 'auto')) {
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      for (const model of GEMINI_MODELS) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const response = await axios.post(
              url,
              {
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: {
                  responseMimeType: "application/json",
                  temperature: 0.1
                }
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'x-goog-api-key': apiKey
                },
                timeout: 18000
              }
            );

            const rawJsonStr = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawJsonStr) {
              console.log(`[AI Extraction] Successfully extracted live JSON via Gemini API (${model})`);
              extractedRaw = JSON.parse(rawJsonStr);
              modelUsed = model;
              break;
            }
          } catch (err) {
            const errMsg = err.response?.data?.error?.message || err.message;
            console.warn(`[AI Extraction] Model ${model} attempt ${attempt} returned:`, errMsg);

            if (errMsg.toLowerCase().includes('high demand') || errMsg.toLowerCase().includes('quota') || err.response?.status === 429 || err.response?.status === 503) {
              if (attempt < 2) {
                await new Promise(r => setTimeout(r, 1200));
                continue;
              }
            }
            break; // Try next model
          }
        }
        if (extractedRaw) break;
      }
    }
  }

  // Path C: Local Qwen Fallback (if provider === 'auto' and Gemini was unavailable)
  if (!extractedRaw && preferredProvider === 'auto') {
    console.log('[AI Extraction] Gemini unavailable or rate-limited. Trying local Qwen Coder Docker fallback...');
    const localRes = await extractWithLocalLlm(promptText, deterministicSignals);
    if (localRes) {
      extractedRaw = localRes.data;
      modelUsed = localRes.model;
    }
  }

  // Fallback if AI unavailable: use deterministic signals & sample metadata
  if (!extractedRaw) {
    console.log('[AI Extraction] Using deterministic and structured signals parser');
    const meta = scrapedPayload.sampleMetaData || {};
    extractedRaw = {
      name: deterministicSignals.structuredName || meta.sampleName || 'Real Estate Project',
      builderName: meta.sampleBuilder || null,
      description: deterministicSignals.structuredDescription || `Real estate property located in ${meta.sampleLocation || 'Bengaluru'}.`,
      type: meta.sampleType || 'apartment',
      rera: deterministicSignals.deterministicRera || meta.sampleRera || null,
      city: meta.sampleCity || 'Bengaluru',
      zone: meta.sampleZone || 'East',
      location: meta.sampleLocation || 'Whitefield',
      towers: 4,
      floors: 'G+24',
      totalUnits: 500,
      landParcel: '6.5 Acres',
      possessionStatus: meta.samplePossession || 'Under Construction',
      possessionDate: meta.samplePossessionDate || '2027-12-31',
      units: meta.sampleUnits || [
        { type: '2BHK', currency: 'INR', minPrice: 7500000, maxPrice: 8500000, interiorArea: 1100 },
        { type: '3BHK', currency: 'INR', minPrice: 11000000, maxPrice: 12500000, interiorArea: 1500 }
      ],
      amenities: meta.sampleAmenities || ['Swimming Pool', 'Gymnasium', 'Clubhouse', '24x7 Security'],
      advantages: meta.sampleAdvantages || [
        { title: 'Strategic Location', description: `Conveniently situated in ${meta.sampleLocation || 'Whitefield'} with seamless access to tech hubs.` },
        { title: 'World-Class Amenities', description: 'Comprehensive lifestyle amenities including pool, clubhouse, and 24x7 security.' },
        { title: 'High Investment Growth', description: 'Rapidly appreciating micro-market with excellent rental yield and capital appreciation.' }
      ],
      faqs: (deterministicSignals.deterministicFaqs && deterministicSignals.deterministicFaqs.length > 0)
        ? deterministicSignals.deterministicFaqs
        : (meta.sampleFaqs || [
          { question: 'What is the RERA registration number of the project?', answer: `The RERA number is ${deterministicSignals.deterministicRera || meta.sampleRera || 'PRM/KA/RERA/1251/309/PR/210331/004084'}.` },
          { question: 'Where is the property located?', answer: `The property is located in ${meta.sampleLocation || 'Whitefield'}, ${meta.sampleCity || 'Bengaluru'}.` },
          { question: 'What is the possession timeline?', answer: `Possession is scheduled for ${meta.samplePossessionDate || 'December 2027'}.` }
        ])
    };
    modelUsed = 'deterministic_fallback';
  }

  // 3. Normalize JSON schema
  const normalized = normalizeExtractedJson(extractedRaw, deterministicSignals);

  // 4. Run post-extraction validation and sanitization
  const validation = validateAndCleanExtractedData(normalized);

  return {
    ...validation.cleanedData,
    _meta: {
      modelUsed,
      deterministicReraFound: !!deterministicSignals.deterministicRera,
      validationWarnings: validation.warnings,
      validationFlags: validation.flags
    }
  };
}

module.exports = { extractPropertyData, normalizeExtractedJson, extractWithLocalLlm };
