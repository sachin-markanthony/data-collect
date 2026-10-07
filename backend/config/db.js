const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_FILE = path.join(__dirname, '..', 'data', 'staged_projects.json');

// Ensure data directory exists
function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = getSeedData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

function readData() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading database file:', err);
    return [];
  }
}

function writeData(data) {
  ensureDataDir();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing database file:', err);
  }
}

// Master Data Lookup for Entity Resolver Mocking
const MASTER_BUILDERS = [];

const MASTER_CITIES = [];
const MASTER_ZONES = [];
const MASTER_LOCATIONS = [];

const MASTER_AMENITIES = [
  { id: 1, name: '24x7 Security' },
  { id: 2, name: '24x7 Water Supply' },
  { id: 3, name: 'Aerobics Room' },
  { id: 4, name: 'Amphitheater' },
  { id: 5, name: 'ATM' },
  { id: 6, name: 'Automated Car Wash' },
  { id: 7, name: 'Badminton Court' },
  { id: 8, name: 'Banquet Hall' },
  { id: 9, name: 'Barbecue Area' },
  { id: 10, name: 'Basketball Court' },
  { id: 11, name: 'Beach Volley Ball' },
  { id: 12, name: 'Business Center' },
  { id: 13, name: 'Business Suites' },
  { id: 14, name: 'Bus Shelter' },
  { id: 15, name: 'Cafeteria' },
  { id: 16, name: 'Card Room' },
  { id: 17, name: 'Car Parking' },
  { id: 18, name: 'Carrom' },
  { id: 19, name: 'Car Wash Area' },
  { id: 20, name: 'CCTV' },
  { id: 21, name: "Children's Play Area" },
  { id: 22, name: 'Club House' },
  { id: 23, name: 'Community Hall' },
  { id: 24, name: 'Conference Room' },
  { id: 25, name: 'Cricket Pitch' },
  { id: 26, name: 'Cycling & Jogging Track' },
  { id: 27, name: 'Energy management' },
  { id: 28, name: 'Entrance' },
  { id: 29, name: 'Fire Fighting System' },
  { id: 30, name: 'Flower Garden' },
  { id: 31, name: 'Food Court' },
  { id: 32, name: 'Football' },
  { id: 33, name: 'Football Field' },
  { id: 34, name: 'Footpaths Pedestrian' },
  { id: 35, name: 'Gated Community' },
  { id: 36, name: 'Gym' },
  { id: 37, name: 'Salon' },
  { id: 38, name: 'Spa, Sauna, Steam' },
  { id: 39, name: 'Swimming Pool' },
  { id: 40, name: 'Tennis Court' },
  { id: 41, name: 'Power Backup' },
  { id: 42, name: 'Table Tennis' },
  { id: 43, name: 'Yoga / Meditation Area' },
  { id: 44, name: 'Senior Citizen Pavilion' }
];

// 2. Master Property Types Lookup
const MASTER_PROPERTY_TYPES = [
  { id: 'pt-1', name: 'Apartment', code: 'apartment' },
  { id: 'pt-2', name: 'Villa', code: 'villa' },
  { id: 'pt-3', name: 'Plot', code: 'plot' },
  { id: 'pt-4', name: 'Penthouse', code: 'penthouse' },
  { id: 'pt-5', name: 'Row House', code: 'row_house' },
  { id: 'pt-6', name: 'Duplex', code: 'duplex' },
  { id: 'pt-7', name: 'Studio', code: 'studio' },
  { id: 'pt-8', name: 'Commercial', code: 'commercial' },
  { id: 'pt-9', name: 'Builder Floor', code: 'builder_floor' }
];

// 3. Master Tags Lookup
const MASTER_TAGS = [
  { id: 'tag-1', name: 'Featured Properties', slug: 'featured-properties' },
  { id: 'tag-2', name: 'Hot Offer', slug: 'hot-offer' },
  { id: 'tag-3', name: 'New Launch', slug: 'new-launch' },
  { id: 'tag-4', name: 'Under Construction', slug: 'under-construction' },
  { id: 'tag-5', name: 'Ready to Move', slug: 'ready-to-move' },
  { id: 'tag-6', name: 'Trending', slug: 'trending' },
  { id: 'tag-7', name: 'Luxury Projects', slug: 'luxury-projects' },
  { id: 'tag-8', name: 'Affordable Homes', slug: 'affordable-homes' },
  { id: 'tag-9', name: 'Fast Selling', slug: 'fast-selling' }
];

// 4. Master Possession Statuses Lookup
const MASTER_POSSESSION_STATUSES = [
  { id: 'ps-1', name: 'Under Construction', code: 'under_construction' },
  { id: 'ps-2', name: 'Ready to Move', code: 'ready_to_move' },
  { id: 'ps-3', name: 'New Launch', code: 'new_launch' },
  { id: 'ps-4', name: 'Delivered', code: 'delivered' },
  { id: 'ps-5', name: 'Occupancy Certificate Received', code: 'oc_received' }
];

// 7. Master Transaction Tags Lookup
const MASTER_TRANSACTION_TAGS = [
  { id: 'tt-1', name: 'Sale', code: 'sale' },
  { id: 'tt-2', name: 'Resale', code: 'resale' },
  { id: 'tt-3', name: 'Rent', code: 'rent' },
  { id: 'tt-4', name: 'Lease', code: 'lease' },
  { id: 'tt-5', name: 'Pre-Launch', code: 'pre_launch' }
];

// 8. Master Unit Types Lookup
const MASTER_UNIT_TYPES = [
  { id: 'ut-1', name: '1 RK', code: '1RK' },
  { id: 'ut-2', name: '1 BHK', code: '1BHK' },
  { id: 'ut-3', name: '1.5 BHK', code: '1.5BHK' },
  { id: 'ut-4', name: '2 BHK', code: '2BHK' },
  { id: 'ut-5', name: '2.5 BHK', code: '2.5BHK' },
  { id: 'ut-6', name: '3 BHK', code: '3BHK' },
  { id: 'ut-7', name: '3.5 BHK', code: '3.5BHK' },
  { id: 'ut-8', name: '4 BHK', code: '4BHK' },
  { id: 'ut-9', name: '5 BHK', code: '5BHK' },
  { id: 'ut-10', name: 'Studio', code: 'Studio' },
  { id: 'ut-11', name: 'Duplex', code: 'Duplex' },
  { id: 'ut-12', name: 'Penthouse', code: 'Penthouse' },
  { id: 'ut-13', name: 'Villa', code: 'Villa' },
  { id: 'ut-14', name: 'Plot', code: 'Plot' },
  { id: 'ut-15', name: 'Commercial', code: 'Commercial' }
];

// Existing Production Database Projects (for Duplicate & Update Diff Testing)
const EXISTING_PRODUCTION_PROJECTS = [
  {
    id: 'p9999999-9999-9999-9999-999999999999',
    name: 'Brigade Horizon',
    builderId: 'b1111111-1111-1111-1111-111111111111',
    cityId: 'c1111111-1111-1111-1111-111111111111',
    locationId: 'l1111111-1111-1111-1111-111111111111',
    rera: 'PRM/KA/RERA/1251/308/PR/220211/004698',
    possessionStatus: 'Under Construction',
    possessionDate: '2028-06-30',
    units: [
      { type: '2BHK', currency: 'INR', minPrice: 8500000, maxPrice: 9200000, interiorArea: 1050 },
      { type: '3BHK', currency: 'INR', minPrice: 11200000, maxPrice: 12500000, interiorArea: 1450 }
    ],
    medias: [
      { type: 'image', title: 'banner', url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80', alt: 'Brigade Horizon Banner' }
    ]
  }
];

function getSeedData() {
  return [];
}

module.exports = {
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
  MASTER_AMENITIES,
  EXISTING_PRODUCTION_PROJECTS
};
