const axios = require('axios');
const { MASTER_AMENITIES, MASTER_CITIES } = require('../config/db');

const GATEWAY_URL = process.env.GATEWAY_URL || 'https://gateway.homebble.in';
let cachedAmenities = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

/**
 * Fetches the master amenities list from official Homebble Gateway API:
 * GET https://gateway.homebble.in/api/dashboard/amenity?page=1&limit=100&search=&sort=name_asc
 */
async function fetchRemoteAmenities(authToken = null, options = {}) {
  const token = authToken || process.env.GATEWAY_AUTH_TOKEN;
  const page = options.page || 1;
  const limit = options.limit || 100;
  const search = options.search || '';
  const sort = options.sort || 'name_asc';

  const url = `${GATEWAY_URL}/api/dashboard/amenity?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}`;

  const headers = {};
  if (token) {
    headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  try {
    const response = await axios.get(url, { headers, timeout: 8000 });
    if (response.data) {
      const rawList = response.data.amenities || response.data.data || (Array.isArray(response.data) ? response.data : []);
      
      const normalized = rawList.map((item, idx) => ({
        id: item.id || item._id || (idx + 1),
        name: item.name || item.title || item.label,
        icon: item.icon || item.imageUrl || null,
        description: item.description || '',
        category: item.category || 'General'
      })).filter(a => a.name);

      if (normalized.length > 0 && !search && page === 1) {
        cachedAmenities = normalized;
        lastFetchTime = Date.now();
      }

      return {
        success: true,
        source: 'gateway_api',
        data: normalized,
        total: response.data.total || normalized.length
      };
    }
  } catch (err) {
    console.warn(`[Master API] Homebble Gateway amenities fetch notice (${err.response?.status || err.message}). Using local master lookup.`);
  }

  // Fallback to local master amenities if offline or token missing
  return {
    success: true,
    source: 'local_master_cache',
    data: cachedAmenities || MASTER_AMENITIES,
    total: (cachedAmenities || MASTER_AMENITIES).length
  };
}

/**
 * Synchronously/Cached returns the current best list of master amenities
 */
function getActiveAmenitiesList() {
  if (cachedAmenities && (Date.now() - lastFetchTime < CACHE_TTL_MS)) {
    return cachedAmenities;
  }
  return MASTER_AMENITIES;
}

/**
 * Adds a new amenity to the master database and optionally synchronizes with Homebble Gateway
 */
async function addMasterAmenity(name, details = {}, authToken = null) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Amenity name is required');
  }

  const cleanName = name.trim();
  const currentList = getActiveAmenitiesList();
  
  // Check if it already exists
  const existing = currentList.find(a => a.name.toLowerCase() === cleanName.toLowerCase());
  if (existing) {
    return {
      success: true,
      isExisting: true,
      amenity: existing,
      message: `Amenity "${cleanName}" already exists in Master DB`
    };
  }

  let newId = details.id || (MASTER_AMENITIES.length > 0 ? Math.max(...MASTER_AMENITIES.map(a => typeof a.id === 'number' ? a.id : 0), 0) + 1 : 1);
  const newAmenity = {
    id: newId,
    name: cleanName,
    icon: details.icon || null,
    description: details.description || '',
    category: details.category || 'General'
  };

  // Try pushing to live Homebble Gateway API if auth token is provided
  const token = authToken || process.env.GATEWAY_AUTH_TOKEN;
  let remoteSuccess = false;

  if (token) {
    try {
      const headers = {
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`
      };
      const response = await axios.post(`${GATEWAY_URL}/api/dashboard/amenity`, {
        name: cleanName,
        category: newAmenity.category,
        description: newAmenity.description
      }, { headers, timeout: 8000 });

      if (response.data && response.data.data) {
        newAmenity.id = response.data.data.id || response.data.data._id || newId;
        remoteSuccess = true;
      }
    } catch (err) {
      console.warn(`[Master API] Homebble Gateway add amenity notice: ${err.message}. Saved to local master DB.`);
    }
  }

  // Add to local master array & active cache
  MASTER_AMENITIES.push(newAmenity);
  if (cachedAmenities && Array.isArray(cachedAmenities)) {
    cachedAmenities.push(newAmenity);
  }

  return {
    success: true,
    isExisting: false,
    remoteSync: remoteSuccess,
    amenity: newAmenity,
    message: `Amenity "${cleanName}" successfully added to Master DB`
  };
}

let cachedCities = null;
let lastCitiesFetchTime = 0;

// City Aliases mapping for common Indian city name variations
const CITY_ALIASES = {
  'bangalore': 'Bengaluru',
  'bengaluru': 'Bengaluru',
  'bombay': 'Mumbai',
  'mumbai': 'Mumbai',
  'delhi': 'Delhi NCR',
  'delhi ncr': 'Delhi NCR',
  'ncr': 'Delhi NCR',
  'gurgaon': 'Delhi NCR',
  'gurugram': 'Delhi NCR',
  'noida': 'Delhi NCR',
  'greater noida': 'Delhi NCR',
  'ghaziabad': 'Delhi NCR',
  'hyderabad': 'Hyderabad',
  'secunderabad': 'Hyderabad',
  'cyberabad': 'Hyderabad',
  'pune': 'Pune',
  'chennai': 'Chennai',
  'madras': 'Chennai',
  'kolkata': 'Kolkata',
  'calcutta': 'Kolkata',
  'ahmedabad': 'Ahmedabad'
};

/**
 * Fetches the master cities list from official Homebble Gateway API:
 * GET https://gateway.homebble.in/api/dashboard/city/list?search=${search}&approval=approved
 */
async function fetchRemoteCities(search = '', authToken = null, approval = 'approved') {
  const token = authToken || process.env.GATEWAY_AUTH_TOKEN;
  const url = `${GATEWAY_URL}/api/dashboard/city/list?search=${encodeURIComponent(search || '')}&approval=${approval}`;

  const headers = {};
  if (token) {
    headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  try {
    const response = await axios.get(url, { headers, timeout: 8000 });
    if (response.data) {
      const rawList = response.data.cities || response.data.data || (Array.isArray(response.data) ? response.data : []);

      const normalized = rawList.map(item => ({
        id: item.id || item._id,
        name: item.name || item.cityName || item.title,
        state: item.state || item.stateName || null,
        approval: item.approval || 'approved'
      })).filter(c => c.name);

      if (normalized.length > 0 && !search) {
        cachedCities = normalized;
        lastCitiesFetchTime = Date.now();
      }

      return {
        success: true,
        source: 'gateway_api',
        data: normalized,
        total: response.data.total || normalized.length
      };
    }
  } catch (err) {
    console.warn(`[Master API] Homebble Gateway city search notice (${err.response?.status || err.message}). Using local master lookup.`);
  }

  // Fallback to local master cities
  const searchLower = (search || '').toLowerCase().trim();
  const mappedQuery = CITY_ALIASES[searchLower] || searchLower;

  const filtered = MASTER_CITIES.filter(c =>
    !searchLower ||
    c.name.toLowerCase().includes(searchLower) ||
    c.name.toLowerCase().includes(mappedQuery)
  );

  return {
    success: true,
    source: 'local_master_cache',
    data: filtered,
    total: filtered.length
  };
}

/**
 * Resolves a city name (handling aliases) against Homebble Master City Database
 */
async function resolveMasterCity(rawCity, authToken = null) {
  if (!rawCity || typeof rawCity !== 'string') return null;
  const clean = rawCity.toLowerCase().trim();
  const canonicalName = CITY_ALIASES[clean] || rawCity.trim();

  const searchRes = await fetchRemoteCities(canonicalName, authToken);
  if (searchRes && searchRes.data && searchRes.data.length > 0) {
    const directMatch = searchRes.data.find(c =>
      c.name.toLowerCase() === canonicalName.toLowerCase() ||
      c.name.toLowerCase() === clean
    );
    if (directMatch) return directMatch;
    return searchRes.data[0];
  }

  return null;
}

/**
 * Synchronously/Cached returns the current best list of master cities
 */
function getActiveCitiesList() {
  if (cachedCities && (Date.now() - lastCitiesFetchTime < CACHE_TTL_MS)) {
    return cachedCities;
  }
  return MASTER_CITIES;
}

/**
 * Fetches the master locations (localities) from official Homebble Gateway API:
 * GET https://gateway.homebble.in/api/dashboard/location/search?search=${search}&cityId=${cityId}
 */
async function fetchRemoteLocations(search = '', cityId = null, authToken = null) {
  const token = authToken || process.env.GATEWAY_AUTH_TOKEN;
  let url = `${GATEWAY_URL}/api/dashboard/location/search?search=${encodeURIComponent(search || '')}`;
  if (cityId) {
    url += `&cityId=${encodeURIComponent(cityId)}`;
  }

  const headers = {};
  if (token) {
    headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  try {
    const response = await axios.get(url, { headers, timeout: 8000 });
    if (response.data) {
      const rawList = response.data.locations || response.data.data || (Array.isArray(response.data) ? response.data : []);

      const normalized = rawList.map(item => ({
        id: item.id || item._id,
        name: item.name || item.locationName || item.title,
        cityId: item.cityId || cityId || null,
        zoneId: item.zoneId || null,
        pincode: item.pincode || null
      })).filter(l => l.name);

      return {
        success: true,
        source: 'gateway_api',
        data: normalized,
        total: response.data.total || normalized.length
      };
    }
  } catch (err) {
    console.warn(`[Master API] Homebble Gateway location search notice (${err.response?.status || err.message}). Using local master lookup.`);
  }

  // Fallback to in-memory master locations (newly added in session)
  const { MASTER_LOCATIONS } = require('../config/db');
  const searchLower = (search || '').toLowerCase().trim();

  let filtered = MASTER_LOCATIONS || [];
  if (cityId) {
    filtered = filtered.filter(l => !l.cityId || l.cityId === cityId);
  }

  if (searchLower) {
    filtered = filtered.filter(l => l.name.toLowerCase().includes(searchLower));
  }

  return {
    success: true,
    source: 'local_master_cache',
    data: filtered,
    total: filtered.length
  };
}

/**
 * Resolves a locality name for a given city against Homebble Master Location Database
 */
async function resolveMasterLocation(rawLocation, cityId = null, authToken = null) {
  if (!rawLocation || typeof rawLocation !== 'string') return null;
  const clean = rawLocation.trim();

  const searchRes = await fetchRemoteLocations(clean, cityId, authToken);
  if (searchRes && searchRes.data && searchRes.data.length > 0) {
    const directMatch = searchRes.data.find(l =>
      l.name.toLowerCase() === clean.toLowerCase()
    );
    if (directMatch) return directMatch;
    return searchRes.data[0];
  }

  return null;
}

/**
 * Adds a new city to the master database and optionally synchronizes with Homebble Gateway
 */
async function addMasterCity(name, state = '', authToken = null) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('City name is required');
  }

  const cleanName = name.trim();
  const currentList = getActiveCitiesList();

  const existing = currentList.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
  if (existing) {
    return {
      success: true,
      isExisting: true,
      city: existing,
      message: `City "${cleanName}" already exists in Master DB`
    };
  }

  const { v4: uuidv4 } = require('uuid');
  const newCity = {
    id: 'c' + uuidv4().slice(1),
    name: cleanName,
    state: state || 'Karnataka',
    approval: 'approved'
  };

  const token = authToken || process.env.GATEWAY_AUTH_TOKEN;
  let remoteSuccess = false;

  if (token) {
    try {
      const headers = {
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`
      };
      const response = await axios.post(`${GATEWAY_URL}/api/dashboard/city`, {
        name: cleanName,
        state: newCity.state
      }, { headers, timeout: 8000 });

      if (response.data && response.data.data) {
        newCity.id = response.data.data.id || response.data.data._id || newCity.id;
        remoteSuccess = true;
      }
    } catch (err) {
      console.warn(`[Master API] Homebble Gateway add city notice: ${err.message}. Saved to local master DB.`);
    }
  }

  MASTER_CITIES.push(newCity);
  if (cachedCities && Array.isArray(cachedCities)) {
    cachedCities.push(newCity);
  }

  return {
    success: true,
    isExisting: false,
    remoteSync: remoteSuccess,
    city: newCity,
    message: `City "${cleanName}" successfully added to Master DB`
  };
}

/**
 * Adds a new location/locality for a city to the master database
 */
async function addMasterLocation(name, cityId = null, pincode = '', authToken = null) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Location/Locality name is required');
  }

  const cleanName = name.trim();
  const { MASTER_LOCATIONS, MASTER_ZONES } = require('../config/db');

  const existing = MASTER_LOCATIONS.find(l =>
    l.name.toLowerCase() === cleanName.toLowerCase() &&
    (!cityId || l.cityId === cityId)
  );

  if (existing) {
    return {
      success: true,
      isExisting: true,
      location: existing,
      message: `Location "${cleanName}" already exists in Master DB`
    };
  }

  const { v4: uuidv4 } = require('uuid');
  let zoneId = null;
  if (cityId) {
    const cityZone = (MASTER_ZONES || []).find(z => z.cityId === cityId);
    if (cityZone) zoneId = cityZone.id;
  }

  const newLocation = {
    id: 'l' + uuidv4().slice(1),
    name: cleanName,
    cityId: cityId || null,
    zoneId: zoneId || 'z1111111-1111-1111-1111-111111111111',
    pincode: pincode || null
  };

  const token = authToken || process.env.GATEWAY_AUTH_TOKEN;
  let remoteSuccess = false;

  if (token) {
    try {
      const headers = {
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`
      };
      const response = await axios.post(`${GATEWAY_URL}/api/dashboard/location`, {
        name: cleanName,
        cityId: cityId,
        pincode: pincode
      }, { headers, timeout: 8000 });

      if (response.data && response.data.data) {
        newLocation.id = response.data.data.id || response.data.data._id || newLocation.id;
        remoteSuccess = true;
      }
    } catch (err) {
      console.warn(`[Master API] Homebble Gateway add location notice: ${err.message}. Saved to local master DB.`);
    }
  }

  MASTER_LOCATIONS.push(newLocation);

  return {
    success: true,
    isExisting: false,
    remoteSync: remoteSuccess,
    location: newLocation,
    message: `Location "${cleanName}" successfully added to Master DB`
  };
}

/**
 * Fetches the master builders from official Homebble Gateway API:
 * GET https://gateway.homebble.in/api/dashboard/builder/search?search=${search}
 */
let cachedBuilders = null;
let lastBuildersFetchTime = 0;

async function fetchRemoteBuilders(search = '', authToken = null) {
  const token = authToken || process.env.GATEWAY_AUTH_TOKEN;
  const url = `${GATEWAY_URL}/api/dashboard/builder/search?search=${encodeURIComponent(search || '')}`;

  const headers = {};
  if (token) {
    headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  try {
    const response = await axios.get(url, { headers, timeout: 8000 });
    if (response.data) {
      const rawList = response.data.builders || response.data.data || (Array.isArray(response.data) ? response.data : []);

      const normalized = rawList.map(item => ({
        id: item.id || item._id,
        name: item.name || item.builderName || item.title,
        logo: item.logo || item.imageUrl || null,
        description: item.description || ''
      })).filter(b => b.name);

      if (normalized.length > 0 && !search) {
        cachedBuilders = normalized;
        lastBuildersFetchTime = Date.now();
      }

      return {
        success: true,
        source: 'gateway_api',
        data: normalized,
        total: response.data.total || normalized.length
      };
    }
  } catch (err) {
    console.warn(`[Master API] Homebble Gateway builder search notice (${err.response?.status || err.message}). Using local master lookup.`);
  }

  const { MASTER_BUILDERS } = require('../config/db');
  const searchLower = (search || '').toLowerCase().trim();

  const filtered = (MASTER_BUILDERS || []).filter(b =>
    !searchLower ||
    b.name.toLowerCase().includes(searchLower)
  );

  return {
    success: true,
    source: 'local_master_cache',
    data: filtered,
    total: filtered.length
  };
}

/**
 * Resolves a builder name against Homebble Master Builder Database
 */
async function resolveMasterBuilder(rawBuilder, authToken = null) {
  if (!rawBuilder || typeof rawBuilder !== 'string') return null;
  const clean = rawBuilder.trim();

  const searchRes = await fetchRemoteBuilders(clean, authToken);
  if (searchRes && searchRes.data && searchRes.data.length > 0) {
    const directMatch = searchRes.data.find(b =>
      b.name.toLowerCase() === clean.toLowerCase() ||
      b.name.toLowerCase().includes(clean.toLowerCase()) ||
      clean.toLowerCase().includes(b.name.toLowerCase())
    );
    if (directMatch) return directMatch;
    return searchRes.data[0];
  }

  return null;
}

/**
 * Returns active cached or master builder list
 */
function getActiveBuildersList() {
  if (cachedBuilders && (Date.now() - lastBuildersFetchTime < CACHE_TTL_MS)) {
    return cachedBuilders;
  }
  const { MASTER_BUILDERS } = require('../config/db');
  return MASTER_BUILDERS || [];
}

/**
 * Adds a new builder to the master database and synchronizes with Homebble Gateway
 */
async function addMasterBuilder(name, details = {}, authToken = null) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Builder name is required');
  }

  const cleanName = name.trim();
  const { MASTER_BUILDERS } = require('../config/db');

  const existing = (MASTER_BUILDERS || []).find(b => b.name.toLowerCase() === cleanName.toLowerCase());
  if (existing) {
    return {
      success: true,
      isExisting: true,
      builder: existing,
      message: `Builder "${cleanName}" already exists in Master DB`
    };
  }

  const { v4: uuidv4 } = require('uuid');
  const newBuilder = {
    id: 'b' + uuidv4().slice(1),
    name: cleanName,
    description: details.description || '',
    logo: details.logo || null
  };

  const token = authToken || process.env.GATEWAY_AUTH_TOKEN;
  let remoteSuccess = false;

  if (token) {
    try {
      const headers = {
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`
      };
      const response = await axios.post(`${GATEWAY_URL}/api/dashboard/builder`, {
        name: cleanName,
        description: newBuilder.description
      }, { headers, timeout: 8000 });

      if (response.data && response.data.data) {
        newBuilder.id = response.data.data.id || response.data.data._id || newBuilder.id;
        remoteSuccess = true;
      }
    } catch (err) {
      console.warn(`[Master API] Homebble Gateway add builder notice: ${err.message}. Saved to local master DB.`);
    }
  }

  MASTER_BUILDERS.push(newBuilder);
  if (cachedBuilders && Array.isArray(cachedBuilders)) {
    cachedBuilders.push(newBuilder);
  }

  return {
    success: true,
    isExisting: false,
    remoteSync: remoteSuccess,
    builder: newBuilder,
    message: `Builder "${cleanName}" successfully added to Master DB`
  };
}

module.exports = {
  fetchRemoteAmenities,
  getActiveAmenitiesList,
  addMasterAmenity,
  fetchRemoteCities,
  resolveMasterCity,
  getActiveCitiesList,
  addMasterCity,
  fetchRemoteLocations,
  resolveMasterLocation,
  addMasterLocation,
  fetchRemoteBuilders,
  resolveMasterBuilder,
  getActiveBuildersList,
  addMasterBuilder,
  CITY_ALIASES,
  GATEWAY_URL
};
