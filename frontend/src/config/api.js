// Central API & Hosted Gateway Configuration
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export const GATEWAY_BASE = import.meta.env.VITE_GATEWAY_URL || 'https://gateway.homebble.in/api/dashboard';

/**
 * Searches localities for a given city
 * Hits backend proxy (/api/masters/locations) which communicates directly with
 * https://gateway.homebble.in/api/dashboard/location/search?search=${search}&cityId=${cityId}
 * and attaches necessary authorization headers.
 */
export async function searchLocalities(cityId, search = '') {
  if (!cityId) return { success: true, data: [] };
  const url = `${API_BASE}/masters/locations?cityId=${encodeURIComponent(cityId)}&search=${encodeURIComponent(search || '')}`;
  const res = await fetch(url);
  return res.json();
}

/**
 * Searches cities from official Homebble Gateway:
 * https://gateway.homebble.in/api/dashboard/city/list?search=${search}&approval=approved
 */
export async function searchCities(search = '') {
  const url = `${API_BASE}/masters/cities?search=${encodeURIComponent(search || '')}&approval=approved`;
  const res = await fetch(url);
  return res.json();
}

/**
 * Fetches master amenities from official Homebble Gateway:
 * https://gateway.homebble.in/api/dashboard/amenity
 */
export async function searchAmenities(page = 1, limit = 50, search = '') {
  const url = `${API_BASE}/masters/amenities?page=${page}&limit=${limit}&search=${encodeURIComponent(search || '')}`;
  const res = await fetch(url);
  return res.json();
}

/**
 * Creates a new amenity in the Master DB and synchronizes with Homebble Gateway
 */
export async function createMasterAmenity(name) {
  const res = await fetch(`${API_BASE}/masters/amenity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  return res.json();
}

/**
 * Creates a new city in the Master DB and synchronizes with Homebble Gateway
 */
export async function createMasterCity(name, state = '') {
  const res = await fetch(`${API_BASE}/masters/city`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, state })
  });
  return res.json();
}

/**
 * Creates a new location/locality in the Master DB and synchronizes with Homebble Gateway
 */
export async function createMasterLocation(name, cityId = null, pincode = '') {
  const res = await fetch(`${API_BASE}/masters/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, cityId, pincode })
  });
  return res.json();
}

/**
 * Searches builders from official Homebble Gateway:
 * https://gateway.homebble.in/api/dashboard/builder/search?search=${search}
 */
export async function searchBuilders(search = '') {
  const url = `${API_BASE}/masters/builders?search=${encodeURIComponent(search || '')}`;
  const res = await fetch(url);
  return res.json();
}

/**
 * Creates a new builder in the Master DB and synchronizes with Homebble Gateway
 */
export async function createMasterBuilder(name, description = '') {
  const res = await fetch(`${API_BASE}/masters/builder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description })
  });
  return res.json();
}
