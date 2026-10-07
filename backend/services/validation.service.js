/**
 * Post-Extraction Validation Service
 * Inspects parsed and AI-extracted property payloads for correctness,
 * anomalies, unrealistic price values, and geographic consistency.
 */

// City to known areas / locations mapping for consistency checks
const CITY_LOCATION_MAP = {
  'Bengaluru': ['Whitefield', 'Sarjapur Road', 'Hebbal', 'Electronic City', 'Indiranagar', 'Koramangala', 'HSR Layout', 'Yelahanka', 'Bagalur', 'Thanisandra', 'Bellandur', 'Marathahalli', 'Bannerghatta', 'Devanahalli'],
  'Mumbai': ['Bandra', 'Andheri', 'Juhu', 'Worli', 'Powai', 'Goregaon', 'Kandivali', 'Borivali', 'Thane', 'Navi Mumbai', 'Lower Parel', 'Malad', 'Dadar', 'Kurla', 'Chembur', 'Ghatkopar', 'Mulund'],
  'Delhi NCR': ['Gurgaon', 'Gurugram', 'Noida', 'Greater Noida', 'Faridabad', 'Ghaziabad', 'Moti Nagar', 'Dwarka', 'South Delhi', 'Vasant Kunj', 'Rohini', 'Saket'],
  'Hyderabad': ['Gachibowli', 'Hitec City', 'Madhapur', 'Kondapur', 'Banjara Hills', 'Jubilee Hills', 'Kukatpally', 'Tellapur', 'Kokapet', 'Manikonda']
};

/**
 * Validate and normalize unit types (e.g., "2 bhk apartment" -> "2BHK")
 */
function normalizeUnitType(rawType) {
  if (!rawType || typeof rawType !== 'string') return '2BHK';
  const clean = rawType.toUpperCase().replace(/\s+/g, '');

  if (clean.includes('1BHK') || clean.includes('1-BHK') || clean.includes('1BED')) return '1BHK';
  if (clean.includes('2BHK') || clean.includes('2-BHK') || clean.includes('2BED')) return '2BHK';
  if (clean.includes('3BHK') || clean.includes('3-BHK') || clean.includes('3BED')) return '3BHK';
  if (clean.includes('4BHK') || clean.includes('4-BHK') || clean.includes('4BED')) return '4BHK';
  if (clean.includes('5BHK') || clean.includes('5-BHK') || clean.includes('5BED')) return '5BHK';
  if (clean.includes('STUDIO') || clean.includes('1RK')) return 'Studio';
  if (clean.includes('PENTHOUSE')) return 'Penthouse';
  if (clean.includes('VILLA') || clean.includes('ROW')) return 'Villa';
  if (clean.includes('PLOT') || clean.includes('LAND')) return 'Plot';

  return rawType.trim();
}

/**
 * Validate and clean property data
 */
function validateAndCleanExtractedData(data) {
  const warnings = [];
  const flags = {
    reraValid: false,
    priceRangeReasonable: true,
    geoConsistent: true,
    hasUnits: false,
    hasImages: false
  };

  const cleaned = { ...data };

  // 0. Rental Property Check (Only Developer Primary Sale Allowed)
  const isRentalExplicit = cleaned.isRental === true || data.isRental === true;
  const descLower = (cleaned.description || '').toLowerCase();
  const nameLower = (cleaned.name || '').toLowerCase();
  const isRentalKeyword =
    descLower.includes('/month') ||
    descLower.includes('per month') ||
    descLower.includes('rent/month') ||
    descLower.includes('monthly rent') ||
    nameLower.includes('for rent') ||
    nameLower.includes('on rent');

  if (isRentalExplicit || isRentalKeyword) {
    warnings.push('rental_property_excluded');
    flags.isRental = true;
  }

  // 1. Project Name Sanity Check
  if (!cleaned.name || cleaned.name.trim().length < 2) {
    warnings.push('missing_or_invalid_project_name');
  } else {
    cleaned.name = cleaned.name.trim();
  }

  // 2. RERA Number Format & Presence Validation
  if (cleaned.rera && typeof cleaned.rera === 'string' && cleaned.rera.trim().length >= 6) {
    cleaned.rera = cleaned.rera.trim();
    // Check known state patterns
    const isPrm = /PRM\/[A-Z]{2}\/RERA/i.test(cleaned.rera);
    const isMaha = /^P\d{11}$/i.test(cleaned.rera);
    const isDl = /^DLRERA/i.test(cleaned.rera);
    const isHr = /^HRERA/i.test(cleaned.rera);
    const isGeneric = /[A-Z0-9\/\-]{7,35}/.test(cleaned.rera);

    if (isPrm || isMaha || isDl || isHr || isGeneric) {
      flags.reraValid = true;
    } else {
      warnings.push('unrecognized_rera_format');
    }
  } else {
    cleaned.rera = null;
    warnings.push('missing_rera_number');
  }

  // 3. Units & Price Range Validation
  if (Array.isArray(cleaned.units) && cleaned.units.length > 0) {
    flags.hasUnits = true;
    cleaned.units = cleaned.units.map(unit => {
      const normalizedType = normalizeUnitType(unit.type);
      let min = unit.minPrice ? parseInt(unit.minPrice, 10) : null;
      let max = unit.maxPrice ? parseInt(unit.maxPrice, 10) : null;
      let minArea = unit.minArea ? parseInt(unit.minArea, 10) : (unit.interiorArea ? parseInt(unit.interiorArea, 10) : null);
      let maxArea = unit.maxArea ? parseInt(unit.maxArea, 10) : (minArea || null);

      // Swap if min > max
      if (min && max && min > max) {
        const temp = min;
        min = max;
        max = temp;
      }
      if (minArea && maxArea && minArea > maxArea) {
        const tempArea = minArea;
        minArea = maxArea;
        maxArea = tempArea;
      }

      // Check for price outliers (e.g. < 5 Lakhs or > 500 Crores)
      if (min && (min < 500000 || min > 5000000000)) {
        warnings.push(`suspicious_price_outlier_${normalizedType}_${min}`);
        flags.priceRangeReasonable = false;
      }

      // Check for area sanity (e.g. < 200 sqft or > 15000 sqft)
      if (minArea && (minArea < 200 || minArea > 20000)) {
        warnings.push(`suspicious_area_value_${normalizedType}_${minArea}`);
      }

      return {
        type: normalizedType,
        areaStatus: unit.areaStatus || 'Available',
        areaVisibility: unit.areaVisibility || 'Public',
        minArea: minArea,
        maxArea: maxArea || minArea,
        interiorArea: minArea,
        priceStatus: unit.priceStatus || 'Available',
        priceVisibility: unit.priceVisibility || 'Public',
        currency: unit.currency || 'INR',
        minPrice: min,
        maxPrice: max || min,
        floorPlanImage: unit.floorPlanImage || null
      };
    });
  } else {
    cleaned.units = [];
    warnings.push('missing_unit_configurations');
  }

  // 3b. Pincode Validation
  if (cleaned.pincode) {
    const pinStr = String(cleaned.pincode).trim().replace(/[^\d]/g, '');
    if (/^[1-9][0-9]{5}$/.test(pinStr)) {
      cleaned.pincode = pinStr;
    } else {
      warnings.push('invalid_pincode_format');
    }
  }

  // 3c. Transaction Tag & Defaults
  if (!cleaned.transactionTag) {
    cleaned.transactionTag = 'Sale';
  }
  if (!cleaned.tags) {
    cleaned.tags = 'Featured Properties';
  }
  if (!cleaned.coordinateInputMethod) {
    cleaned.coordinateInputMethod = 'Manual Entry';
  }

  // 4. Geographic Consistency
  if (cleaned.city && cleaned.location) {
    const knownLocations = CITY_LOCATION_MAP[cleaned.city];
    if (knownLocations) {
      const locationMatch = knownLocations.some(l =>
        l.toLowerCase().includes(cleaned.location.toLowerCase()) ||
        cleaned.location.toLowerCase().includes(l.toLowerCase())
      );
      if (!locationMatch) {
        // Check if this location belongs to another city
        for (const [otherCity, otherLocs] of Object.entries(CITY_LOCATION_MAP)) {
          if (otherCity !== cleaned.city) {
            const crossMatch = otherLocs.some(l =>
              l.toLowerCase() === cleaned.location.toLowerCase()
            );
            if (crossMatch) {
              warnings.push(`geo_mismatch_location_${cleaned.location}_belongs_to_${otherCity}`);
              flags.geoConsistent = false;
              break;
            }
          }
        }
      }
    }
  }

  // 5. Possession Date format
  if (cleaned.possessionDate) {
    const d = new Date(cleaned.possessionDate);
    if (isNaN(d.getTime())) {
      warnings.push('invalid_possession_date_format');
      cleaned.possessionDate = null;
    } else {
      cleaned.possessionDate = d.toISOString().split('T')[0];
    }
  }

  // 6. Image gallery check
  if (Array.isArray(cleaned.images) && cleaned.images.length > 0) {
    flags.hasImages = true;
    cleaned.images = cleaned.images.filter(img => img && img.url && typeof img.url === 'string');
  }

  // 7. FAQ Validation and Sanitization
  if (Array.isArray(cleaned.faqs) && cleaned.faqs.length > 0) {
    cleaned.faqs = cleaned.faqs
      .filter(f => f && typeof f === 'object')
      .map(f => {
        const q = (f.question || '').replace(/<[^>]+>/g, ' ').replace(/\s\s+/g, ' ').trim();
        const a = (f.answer || '').replace(/<[^>]+>/g, ' ').replace(/\s\s+/g, ' ').trim();
        return { question: q, answer: a };
      })
      .filter(f => f.question.length >= 3 && f.answer.length >= 3);

    flags.hasFaqs = cleaned.faqs.length > 0;
  } else {
    cleaned.faqs = [];
    flags.hasFaqs = false;
  }

  // 8. Advantages / Key Features Validation and Sanitization
  if (Array.isArray(cleaned.advantages) && cleaned.advantages.length > 0) {
    cleaned.advantages = cleaned.advantages
      .filter(a => a && typeof a === 'object')
      .map(a => {
        const title = (a.title || '').replace(/<[^>]+>/g, ' ').replace(/\s\s+/g, ' ').trim();
        const description = (a.description || a.desc || '').replace(/<[^>]+>/g, ' ').replace(/\s\s+/g, ' ').trim();
        return { title, description };
      })
      .filter(a => a.title.length > 0 || a.description.length > 0);

    flags.hasAdvantages = cleaned.advantages.length > 0;
  } else {
    cleaned.advantages = [];
    flags.hasAdvantages = false;
  }

  // 9. Amenities Canonical Normalization & Deduplication
  if (Array.isArray(cleaned.amenities) && cleaned.amenities.length > 0) {
    cleaned.amenities = normalizeAmenitiesList(cleaned.amenities);
  } else {
    cleaned.amenities = [];
  }

  return {
    cleanedData: cleaned,
    warnings,
    flags
  };
}

/**
 * Amenity Canonical Synonym Dictionary
 * Maps common real estate website variations to official Master DB names
 */
const AMENITY_SYNONYMS = {
  // Gym & Fitness
  'gym': 'Gym',
  'gymnasium': 'Gym',
  'fitness center': 'Gym',
  'fitness centre': 'Gym',
  'health club': 'Gym',
  'work out area': 'Gym',
  'workout zone': 'Gym',
  'indoor gym': 'Gym',
  'outdoor gym': 'Gym',
  'open gym': 'Gym',
  'crossfit': 'Gym',

  // Club House
  'clubhouse': 'Club House',
  'club house': 'Club House',
  'the club': 'Club House',
  'community club': 'Club House',
  'club facilities': 'Club House',
  'grand clubhouse': 'Club House',

  // Swimming Pool
  'swimming pool': 'Swimming Pool',
  'pool': 'Swimming Pool',
  'swimming pool with kids pool': 'Swimming Pool',
  'lap pool': 'Swimming Pool',
  'infinity pool': 'Swimming Pool',
  'indoor pool': 'Swimming Pool',
  'toddlers pool': 'Swimming Pool',

  // Cycling & Jogging Track
  'cycling & jogging track': 'Cycling & Jogging Track',
  'jogging track': 'Cycling & Jogging Track',
  'jogging & strolling track': 'Cycling & Jogging Track',
  'cycling track': 'Cycling & Jogging Track',
  'walking track': 'Cycling & Jogging Track',
  'running track': 'Cycling & Jogging Track',
  'jogging / cycling track': 'Cycling & Jogging Track',

  // Children's Play Area
  'children\'s play area': 'Children\'s Play Area',
  'children play area': 'Children\'s Play Area',
  'kids play area': 'Children\'s Play Area',
  'kids play zone': 'Children\'s Play Area',
  'children play zone': 'Children\'s Play Area',
  'toddler play area': 'Children\'s Play Area',
  'childrens park': 'Children\'s Play Area',

  // 24x7 Security
  '24x7 security': '24x7 Security',
  '24/7 security': '24x7 Security',
  '24 hour security': '24x7 Security',
  'round the clock security': '24x7 Security',
  'manned security': '24x7 Security',
  'security personnel': '24x7 Security',
  'security': '24x7 Security',

  // 24x7 Water Supply
  '24x7 water supply': '24x7 Water Supply',
  '24/7 water supply': '24x7 Water Supply',
  '24 hours water supply': '24x7 Water Supply',
  'continuous water supply': '24x7 Water Supply',
  'water supply': '24x7 Water Supply',

  // Power Backup
  'power backup': 'Power Backup',
  'power back up': 'Power Backup',
  '100% power backup': 'Power Backup',
  'dg power backup': 'Power Backup',
  'full power backup': 'Power Backup',
  'generator backup': 'Power Backup',
  'power backup 24x7': 'Power Backup',

  // CCTV
  'cctv': 'CCTV',
  'cctv surveillance': 'CCTV',
  'cctv cameras': 'CCTV',
  'video surveillance': 'CCTV',
  '24x7 cctv': 'CCTV',

  // Senior Citizen Pavilion
  'senior citizen pavilion': 'Senior Citizen Pavilion',
  'senior citizens sitout': 'Senior Citizen Pavilion',
  'senior citizen area': 'Senior Citizen Pavilion',
  'senior citizen park': 'Senior Citizen Pavilion',
  'senior citizen sit out': 'Senior Citizen Pavilion',
  'elders park': 'Senior Citizen Pavilion',

  // Yoga / Meditation Area
  'yoga / meditation area': 'Yoga / Meditation Area',
  'yoga & meditation area': 'Yoga / Meditation Area',
  'yoga deck': 'Yoga / Meditation Area',
  'meditation area': 'Yoga / Meditation Area',
  'yoga and meditation': 'Yoga / Meditation Area',
  'yoga room': 'Yoga / Meditation Area',
  'meditation hall': 'Yoga / Meditation Area',
  'yoga center': 'Yoga / Meditation Area',

  // Spa, Sauna, Steam
  'spa, sauna, steam': 'Spa, Sauna, Steam',
  'spa': 'Spa, Sauna, Steam',
  'sauna': 'Spa, Sauna, Steam',
  'steam room': 'Spa, Sauna, Steam',
  'steam & sauna': 'Spa, Sauna, Steam',
  'jacuzzi': 'Spa, Sauna, Steam',

  // Flower Garden
  'flower garden': 'Flower Garden',
  'landscaped garden': 'Flower Garden',
  'garden': 'Flower Garden',
  'landscape garden': 'Flower Garden',
  'botanical garden': 'Flower Garden',
  'central park': 'Flower Garden',

  // Fire Fighting System
  'fire fighting system': 'Fire Fighting System',
  'fire fighting': 'Fire Fighting System',
  'fire fighting equipment': 'Fire Fighting System',
  'fire safety': 'Fire Fighting System',
  'fire safety system': 'Fire Fighting System',

  // Car Parking
  'car parking': 'Car Parking',
  'covered car parking': 'Car Parking',
  'reserved parking': 'Car Parking',
  'basement parking': 'Car Parking',
  'car park': 'Car Parking',
  'parking space': 'Car Parking',

  // Community / Banquet Hall
  'banquet hall': 'Banquet Hall',
  'party hall': 'Banquet Hall',
  'community hall': 'Community Hall',
  'multipurpose hall': 'Community Hall',

  // Sports
  'cricket pitch': 'Cricket Pitch',
  'cricket net': 'Cricket Pitch',
  'cricket practice pitch': 'Cricket Pitch',
  'box cricket': 'Cricket Pitch',
  'badminton court': 'Badminton Court',
  'indoor badminton court': 'Badminton Court',
  'basketball court': 'Basketball Court',
  'half basketball court': 'Basketball Court',
  'tennis court': 'Tennis Court',
  'table tennis': 'Table Tennis',
  'tt room': 'Table Tennis',
  'gated community': 'Gated Community'
};

/**
 * Strips special characters and spaces for aggressive normalized comparison
 */
function cleanAmenityKey(str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Normalizes an individual amenity name against Master DB canonical names and synonym dictionary
 */
function normalizeAmenityName(rawName, masterList = null) {
  if (!rawName || typeof rawName !== 'string') return '';
  const trimmed = rawName.trim();
  const lower = trimmed.toLowerCase();
  const key = cleanAmenityKey(trimmed);

  // 1. Check Synonym / Alias Dictionary direct match
  if (AMENITY_SYNONYMS[lower]) {
    return AMENITY_SYNONYMS[lower];
  }

  // 2. Check Synonym Dictionary by cleaned key (e.g. "clubhouse" -> "clubhouse" -> "Club House")
  for (const [synKey, canonical] of Object.entries(AMENITY_SYNONYMS)) {
    if (cleanAmenityKey(synKey) === key) {
      return canonical;
    }
  }

  // 3. Check against provided or default Master DB amenities list
  let activeMasterList = masterList;
  if (!activeMasterList) {
    try {
      const { getActiveAmenitiesList } = require('./master_api.service');
      activeMasterList = getActiveAmenitiesList();
    } catch {
      activeMasterList = require('../config/db').MASTER_AMENITIES;
    }
  }
  const masters = activeMasterList || require('../config/db').MASTER_AMENITIES || [];
  for (const m of masters) {
    const mName = m.name || m;
    // Exact case-insensitive match
    if (mName.toLowerCase() === lower) {
      return mName;
    }
    // Cleaned key match (e.g. "Club House" key "clubhouse" matches raw "Clubhouse" key "clubhouse")
    if (cleanAmenityKey(mName) === key) {
      return mName;
    }
  }

  // 4. Substring & Keyword Matches
  if (lower.includes('gym') || lower.includes('fitness') || lower.includes('workout')) return 'Gym';
  if (lower.includes('club') && (lower.includes('house') || lower.includes('home') || lower.includes('community'))) return 'Club House';
  if (lower.includes('swimming') || (lower.includes('pool') && !lower.includes('table'))) return 'Swimming Pool';
  if (lower.includes('jogging') || (lower.includes('cycling') && lower.includes('track'))) return 'Cycling & Jogging Track';
  if (lower.includes('kids') && lower.includes('play')) return 'Children\'s Play Area';
  if (lower.includes('children') && lower.includes('play')) return 'Children\'s Play Area';
  if (lower.includes('security') && (lower.includes('24') || lower.includes('7') || lower.includes('guard'))) return '24x7 Security';
  if (lower.includes('water') && (lower.includes('24') || lower.includes('supply'))) return '24x7 Water Supply';
  if (lower.includes('power') && lower.includes('back')) return 'Power Backup';
  if (lower.includes('cctv') || lower.includes('surveillance')) return 'CCTV';
  if (lower.includes('yoga') || lower.includes('meditation')) return 'Yoga / Meditation Area';
  if (lower.includes('sauna') || lower.includes('steam') || lower.includes('spa')) return 'Spa, Sauna, Steam';
  if (lower.includes('senior') && (lower.includes('citizen') || lower.includes('sitout'))) return 'Senior Citizen Pavilion';
  if (lower.includes('badminton')) return 'Badminton Court';
  if (lower.includes('basketball')) return 'Basketball Court';
  if (lower.includes('cricket')) return 'Cricket Pitch';
  if (lower.includes('tennis') && !lower.includes('table')) return 'Tennis Court';
  if (lower.includes('table tennis') || lower.includes('ping pong')) return 'Table Tennis';
  if (lower.includes('fire') && lower.includes('fight')) return 'Fire Fighting System';
  if (lower.includes('gated')) return 'Gated Community';
  if (lower.includes('parking')) return 'Car Parking';

  return trimmed;
}

/**
 * Normalizes an array of amenities and removes duplicates
 */
function normalizeAmenitiesList(rawList, masterList = null) {
  if (!Array.isArray(rawList)) return [];
  const normalized = [];
  const seenKeys = new Set();

  rawList.forEach(item => {
    const rawStr = typeof item === 'string' ? item : (item?.name || '');
    if (rawStr) {
      const canonical = normalizeAmenityName(rawStr, masterList);
      const key = cleanAmenityKey(canonical);
      if (canonical && !seenKeys.has(key)) {
        seenKeys.add(key);
        normalized.push(canonical);
      }
    }
  });

  return normalized;
}

module.exports = {
  validateAndCleanExtractedData,
  normalizeUnitType,
  normalizeAmenityName,
  normalizeAmenitiesList,
  cleanAmenityKey
};
