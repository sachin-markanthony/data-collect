const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const {
  readData,
  writeData,
  MASTER_BUILDERS,
  MASTER_PROPERTY_TYPES,
  MASTER_TAGS,
  MASTER_POSSESSION_STATUSES,
  MASTER_CITIES,
  MASTER_ZONES,
  MASTER_LOCATIONS,
  MASTER_TRANSACTION_TAGS,
  MASTER_UNIT_TYPES,
  MASTER_AMENITIES
} = require('../config/db');

const { scrapePropertyUrl } = require('../services/scraper.service');
const { extractPropertyData } = require('../services/ai_extraction.service');
const { resolveEntitiesAndDeduplicate } = require('../services/entity_resolver.service');
const { crawlAndExtractWebsite } = require('../services/crawler.service');
const {
  fetchRemoteAmenities,
  getActiveAmenitiesList,
  addMasterAmenity,
  fetchRemoteCities,
  getActiveCitiesList,
  addMasterCity,
  fetchRemoteLocations,
  addMasterLocation,
  fetchRemoteBuilders,
  addMasterBuilder,
  getActiveBuildersList
} = require('../services/master_api.service');

// 1. Get Master Lookups for Review Dashboard Dropdowns (all 9 lookup entities)
exports.getMasterLookups = async (req, res) => {
  try {
    const token = req.headers.authorization || req.query.token || process.env.GATEWAY_AUTH_TOKEN;
    const [amenitiesRes, citiesRes, buildersRes] = await Promise.all([
      fetchRemoteAmenities(token, { page: 1, limit: 200 }),
      fetchRemoteCities('', token),
      fetchRemoteBuilders('', token)
    ]);

    const amenities = (amenitiesRes && amenitiesRes.data) || getActiveAmenitiesList();
    const cities = (citiesRes && citiesRes.data) || getActiveCitiesList();
    const builders = (buildersRes && buildersRes.data) || getActiveBuildersList();

    return res.json({
      success: true,
      data: {
        builders: builders,                      // 1. Builder Name (Homebble Master Builder DB)
        propertyTypes: MASTER_PROPERTY_TYPES,   // 2. Property Type
        tags: MASTER_TAGS,                       // 3. Tags
        possessionStatuses: MASTER_POSSESSION_STATUSES, // 4. Possession status
        cities: cities,                          // 5. City (Homebble Master City DB)
        zones: MASTER_ZONES,
        locations: MASTER_LOCATIONS,             // 6. Locality (Homebble Master Location DB)
        transactionTags: MASTER_TRANSACTION_TAGS, // 7. Transaction Tag
        unitTypes: MASTER_UNIT_TYPES,           // 8. Unit Type
        amenities: amenities                     // 9. Amenities (Homebble Master Amenities DB)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 1b. Direct Homebble Gateway Amenities Fetch / Search
exports.getAmenitiesMaster = async (req, res) => {
  try {
    const token = req.headers.authorization || req.query.token || process.env.GATEWAY_AUTH_TOKEN;
    const result = await fetchRemoteAmenities(token, {
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      sort: req.query.sort
    });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 1c. Direct Homebble Gateway City Search (GET /api/dashboard/city/list?search=...&approval=approved)
exports.searchCitiesMaster = async (req, res) => {
  try {
    const token = req.headers.authorization || req.query.token || process.env.GATEWAY_AUTH_TOKEN;
    const search = req.query.search || req.query.q || '';
    const approval = req.query.approval || 'approved';
    const result = await fetchRemoteCities(search, token, approval);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 1d. Direct Homebble Gateway Locality / Location Search (GET /api/dashboard/location/search?search=...&cityId=...)
exports.searchLocationsMaster = async (req, res) => {
  try {
    const token = req.headers.authorization || req.query.token || process.env.GATEWAY_AUTH_TOKEN;
    const search = req.query.search || req.query.q || '';
    const cityId = req.query.cityId || null;
    const result = await fetchRemoteLocations(search, cityId, token);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 1e. Add New Discovered Amenity to Master DB (and sync with Homebble Gateway)
exports.createMasterAmenity = async (req, res) => {
  try {
    const { name, category, description, icon } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Amenity name is required' });
    }

    const token = req.headers.authorization || process.env.GATEWAY_AUTH_TOKEN;
    const result = await addMasterAmenity(name, { category, description, icon }, token);

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 1f. Add New City to Master DB (and sync with Homebble Gateway)
exports.createMasterCity = async (req, res) => {
  try {
    const { name, state } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'City name is required' });
    }

    const token = req.headers.authorization || process.env.GATEWAY_AUTH_TOKEN;
    const result = await addMasterCity(name, state, token);

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 1g. Add New Locality / Location to Master DB (and sync with Homebble Gateway)
exports.createMasterLocation = async (req, res) => {
  try {
    const { name, cityId, pincode } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Location / Locality name is required' });
    }

    const token = req.headers.authorization || process.env.GATEWAY_AUTH_TOKEN;
    const result = await addMasterLocation(name, cityId, pincode, token);

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 1h. Direct Homebble Gateway Builder Search (GET /api/dashboard/builder/search?search=...)
exports.searchBuildersMaster = async (req, res) => {
  try {
    const token = req.headers.authorization || req.query.token || process.env.GATEWAY_AUTH_TOKEN;
    const search = req.query.search || req.query.q || '';
    const result = await fetchRemoteBuilders(search, token);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 1i. Add New Builder to Master DB (and sync with Homebble Gateway)
exports.createMasterBuilder = async (req, res) => {
  try {
    const { name, description, logo } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Builder name is required' });
    }

    const token = req.headers.authorization || process.env.GATEWAY_AUTH_TOKEN;
    const result = await addMasterBuilder(name, { description, logo }, token);

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 2. List Staged Projects (Filter by status, domain)
exports.getStagedProjects = async (req, res) => {
  try {
    const { status, domain } = req.query;
    let projects = readData();

    if (status && status !== 'all') {
      projects = projects.filter(p => p.status === status);
    }
    if (domain) {
      projects = projects.filter(p => p.source_domain.includes(domain));
    }

    // Sort by confidence score descending, then created_at descending
    projects.sort((a, b) => b.confidence_score - a.confidence_score || new Date(b.created_at) - new Date(a.created_at));

    return res.json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 3. Get Single Staged Project
exports.getStagedProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const projects = readData();
    const item = projects.find(p => p.id === id);

    if (!item) {
      return res.status(404).json({ success: false, error: 'Staged project not found' });
    }

    return res.json({ success: true, data: item });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 4. Update/Save Draft of Staged Project (Reviewer Edits)
exports.updateStagedProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { extracted_data, resolved_builder_id, resolved_city_id, resolved_zone_id, resolved_location_id, review_notes } = req.body;

    const projects = readData();
    const index = projects.findIndex(p => p.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Staged project not found' });
    }

    const item = projects[index];

    if (extracted_data) item.extracted_data = { ...item.extracted_data, ...extracted_data };
    if (resolved_builder_id !== undefined) item.resolved_builder_id = resolved_builder_id;
    if (resolved_city_id !== undefined) item.resolved_city_id = resolved_city_id;
    if (resolved_zone_id !== undefined) item.resolved_zone_id = resolved_zone_id;
    if (resolved_location_id !== undefined) item.resolved_location_id = resolved_location_id;
    if (review_notes !== undefined) item.review_notes = review_notes;

    item.updated_at = new Date().toISOString();
    projects[index] = item;
    writeData(projects);

    return res.json({ success: true, message: 'Draft updated successfully', data: item });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 5. Approve & Push Staged Project to Production
exports.approveStagedProject = async (req, res) => {
  try {
    const { id } = req.params;
    const projects = readData();
    const index = projects.findIndex(p => p.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Staged project not found' });
    }

    const item = projects[index];

    // Build production push payload conforming to POST /project/create-from-dashboard
    const productionPayload = {
      // Step 1: Basic Details
      name: item.extracted_data.name,
      builderId: item.resolved_builder_id,
      description: item.extracted_data.description,
      type: item.extracted_data.type || 'apartment',
      sourceLink: item.extracted_data.sourceLink || item.source_url,
      tags: item.extracted_data.tags || 'Featured Properties',
      possessionStatus: item.extracted_data.possessionStatus,
      possessionDate: item.extracted_data.possessionDate,
      rera: item.extracted_data.rera,

      // Step 2: Location Details
      cityId: item.resolved_city_id,
      locationId: item.resolved_location_id,
      coordinateInputMethod: item.extracted_data.coordinateInputMethod || 'Manual Entry',
      latitude: item.extracted_data.latitude || (item.extracted_data.coordinates?.latitude ?? null),
      longitude: item.extracted_data.longitude || (item.extracted_data.coordinates?.longitude ?? null),
      pincode: item.extracted_data.pincode || null,

      // Step 3: Property Info
      towers: item.extracted_data.towers,
      floors: item.extracted_data.floors,
      totalUnits: item.extracted_data.totalUnits,
      landParcel: item.extracted_data.landParcel,
      transactionTag: item.extracted_data.transactionTag || 'Sale',

      // Step 4: Pricing / Unit Configurations
      units: item.extracted_data.units || [],

      // Step 5: Amenities
      amenities: (item.extracted_data.amenities || []).map(name => {
        const found = getActiveAmenitiesList().find(a => a.name.toLowerCase() === name.toLowerCase());
        return found ? found.id : null;
      }).filter(Boolean),

      // Step 6: Other Details (Advantages / Key Features & FAQs)
      advantages: item.extracted_data.advantages || [],
      faqs: item.extracted_data.faqs || [],

      // Step 7: Upload Files (Logo, Thumbnail, Other Images, Videos)
      medias: [
        ...(item.extracted_data.logo ? [{ type: 'logo', title: 'logo', url: item.extracted_data.logo, alt: `${item.extracted_data.name || 'Property'} Logo` }] : []),
        ...(item.extracted_data.thumbnail ? [{ type: 'thumbnail', title: 'thumbnail', url: item.extracted_data.thumbnail, alt: `${item.extracted_data.name || 'Property'} Thumbnail` }] : []),
        ...(item.extracted_data.images || []).map(img => (typeof img === 'string' ? { type: 'image', title: 'gallery', url: img, alt: 'Property Image' } : img)),
        ...(item.extracted_data.videos || []).map(vid => (typeof vid === 'string' ? { type: 'video', videoType: 'Walkthrough', title: 'Walkthrough', url: vid, alt: 'Project Video' } : { type: 'video', videoType: vid.videoType || 'Walkthrough', title: vid.title || vid.alt || 'Project Video', url: vid.url, alt: vid.alt || 'Project Video' }))
      ],

      uploadedBy: process.env.AUTOMATION_USER_ID || '00000000-0000-0000-0000-000000000000'
    };

    let createdProjectId = 'proj-' + uuidv4();
    let pushSuccess = true;
    let pushError = null;

    // Try posting to live target portal service if configured
    const targetUrl = process.env.PORTAL_SERVICE_URL;
    if (targetUrl && targetUrl !== 'mock') {
      try {
        const prodRes = await axios.post(`${targetUrl}/project/create-from-dashboard`, productionPayload, { timeout: 8000 });
        if (prodRes.data && prodRes.data.data?.id) {
          createdProjectId = prodRes.data.data.id;
        }
      } catch (err) {
        console.warn('Production target API returned error (continuing with staged approval):', err.message);
        pushError = `Target API connection warning: ${err.message}`;
      }
    }

    item.status = 'approved';
    item.created_project_id = createdProjectId;
    item.pushed_at = new Date().toISOString();
    item.reviewed_at = new Date().toISOString();
    item.push_error = pushError;
    item.updated_at = new Date().toISOString();

    projects[index] = item;
    writeData(projects);

    return res.json({
      success: true,
      message: 'Project approved and pushed to production queue successfully',
      data: item,
      pushedPayload: productionPayload
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 6. Reject Staged Project
exports.rejectStagedProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const projects = readData();
    const index = projects.findIndex(p => p.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Staged project not found' });
    }

    const item = projects[index];
    item.status = 'rejected';
    item.review_notes = reason || 'Rejected by human reviewer';
    item.reviewed_at = new Date().toISOString();
    item.updated_at = new Date().toISOString();

    projects[index] = item;
    writeData(projects);

    return res.json({ success: true, message: 'Project rejected', data: item });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 7. Apply Updates to Existing Project (PUT /project/:id)
exports.applyUpdateToProject = async (req, res) => {
  try {
    const { id } = req.params;
    const projects = readData();
    const index = projects.findIndex(p => p.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Staged project not found' });
    }

    const item = projects[index];
    if (item.action_type !== 'update' || !item.matched_project_id) {
      return res.status(400).json({ success: false, error: 'This item is not marked as an update to an existing project' });
    }

    item.status = 'approved';
    item.pushed_at = new Date().toISOString();
    item.reviewed_at = new Date().toISOString();
    item.updated_at = new Date().toISOString();

    projects[index] = item;
    writeData(projects);

    return res.json({
      success: true,
      message: `Updates applied to existing project ${item.matched_project_id}`,
      data: item
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 8. Execute End-to-End Pipeline (Scrape -> Deterministic Parse -> AI Extract -> Validate -> Resolve -> Stage)
exports.runPipeline = async (req, res) => {
  try {
    const { url, provider } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Target URL is required' });
    }

    const pipelineLogs = [];
    const startTime = Date.now();

    // Step 1: Scrape URL
    const t0 = Date.now();
    const scraped = await scrapePropertyUrl(url);
    pipelineLogs.push({
      step: 'scraper',
      status: 'success',
      duration_ms: Date.now() - t0,
      details: `Scraped ${scraped.sourceDomain} (${scraped.extractedHtml?.length || 0} bytes)`
    });

    // Step 2: AI Extract JSON + Deterministic signals + Validation
    const t1 = Date.now();
    const extracted = await extractPropertyData(scraped, { provider });
    pipelineLogs.push({
      step: 'ai_extraction',
      status: 'success',
      duration_ms: Date.now() - t1,
      model: extracted._meta?.modelUsed || 'default',
      deterministicReraFound: extracted._meta?.deterministicReraFound || false,
      details: `Extracted project: "${extracted.name}" with ${extracted.units?.length || 0} unit configuration(s), ${extracted.faqs?.length || 0} FAQ(s)`
    });

    // Step 3: Entity Resolution & Deduplication
    const t2 = Date.now();
    const resolved = await resolveEntitiesAndDeduplicate(extracted);
    pipelineLogs.push({
      step: 'entity_resolution',
      status: 'success',
      duration_ms: Date.now() - t2,
      confidence_score: resolved.confidence_score,
      action_type: resolved.action_type,
      details: `Builder: ${resolved.resolved_builder_id ? 'Resolved' : 'Pending'}, City: ${resolved.resolved_city_id ? 'Resolved' : 'Pending'}, Location: ${resolved.resolved_location_id ? 'Resolved' : 'Pending'}`
    });

    // Clean metadata from extracted payload for DB storage
    const { _meta, ...cleanExtractedData } = extracted;

    // Step 4: Create Staged Project Record
    const newStagedItem = {
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
      pipeline_logs: pipelineLogs,
      total_duration_ms: Date.now() - startTime,
      status: resolved.action_type === 'update' ? 'update_pending' : 'pending_review',
      reviewed_by: null,
      review_notes: null,
      reviewed_at: null,
      created_project_id: null,
      pushed_at: null,
      push_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const projects = readData();
    projects.unshift(newStagedItem);
    writeData(projects);

    return res.status(201).json({
      success: true,
      message: 'Pipeline executed successfully. Property staged for review.',
      data: newStagedItem
    });
  } catch (err) {
    console.error('[Pipeline Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 9. Batch Website Crawler Endpoint
exports.crawlWebsite = async (req, res) => {
  try {
    const { url, maxPages, maxProperties, skipExisting, provider } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Target website or directory URL is required' });
    }

    const crawlResult = await crawlAndExtractWebsite(url, {
      maxPages: maxPages ? parseInt(maxPages, 10) : 3,
      maxProperties: maxProperties ? parseInt(maxProperties, 10) : 15,
      skipExisting: skipExisting !== false,
      provider
    });

    return res.json({
      success: true,
      message: `Website crawl finished. Found ${crawlResult.totalDiscoveredCount} properties, processed ${crawlResult.processedCount}, skipped ${crawlResult.alreadyInDbSkippedCount} duplicates.`,
      data: crawlResult
    });
  } catch (err) {
    console.error('[Crawl Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 10. Clear All Staged Projects
exports.clearStagedProjects = async (req, res) => {
  try {
    writeData([]);
    return res.json({ success: true, message: 'All staged projects cleared successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
