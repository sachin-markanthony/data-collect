const Fuse = require('fuse.js');
const {
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
} = require('../config/db');
const { computePriceAndUnitDiff } = require('./diff_engine.service');
const { resolveMasterCity, resolveMasterLocation, resolveMasterBuilder, getActiveAmenitiesList } = require('./master_api.service');

// Aliases mapping for common city name variations
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
  'pune': 'Pune'
};

// Builder name suffix cleaner
function cleanBuilderName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .replace(/\b(pvt|private|ltd|limited|llp|group|realty|properties|developers|constructions|infra|holdings|spaces|estates|homes)\b/gi, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fuzzy entity resolver using Fuse.js
 */
function fuzzyMatch(list, keys, query, threshold = 0.4) {
  if (!query || !list || list.length === 0) return null;

  const fuse = new Fuse(list, {
    keys,
    threshold,
    includeScore: true,
    ignoreLocation: true
  });

  const results = fuse.search(query);
  if (results && results.length > 0) {
    return {
      match: results[0].item,
      score: results[0].score,
      candidates: results.slice(0, 3).map(r => ({ item: r.item, score: r.score }))
    };
  }
  return null;
}

/**
 * Entity Resolution & Deduplication Engine (Resolves all 9 master lookup entities)
 */
async function resolveEntitiesAndDeduplicate(extractedData) {
  const warnings = [...(extractedData._meta?.validationWarnings || [])];
  const candidatesMap = {};

  // 1. Resolve Builder dynamically from Master Database API
  let resolvedBuilderId = null;
  let builderMatchScore = 0;

  if (extractedData.builderName || extractedData.builder) {
    const rawBuilder = (extractedData.builderName || extractedData.builder).trim();
    const cleanedBuilder = cleanBuilderName(rawBuilder);

    try {
      const apiBuilder = await resolveMasterBuilder(cleanedBuilder || rawBuilder);
      if (apiBuilder) {
        resolvedBuilderId = apiBuilder.id;
        builderMatchScore = 1.0;
        extractedData.builderName = apiBuilder.name;
        extractedData.builder = apiBuilder.name;
      }
    } catch (err) {
      console.warn('[Entity Resolver] Master API builder lookup notice:', err.message);
    }

    if (!resolvedBuilderId) {
      const directMatch = (MASTER_BUILDERS || []).find(b =>
        b.name.toLowerCase() === rawBuilder.toLowerCase() ||
        cleanBuilderName(b.name).toLowerCase() === cleanedBuilder.toLowerCase()
      );

      if (directMatch) {
        resolvedBuilderId = directMatch.id;
        builderMatchScore = 1.0;
      } else {
        const fuzzyRes = fuzzyMatch(MASTER_BUILDERS || [], ['name'], cleanedBuilder, 0.45);
        if (fuzzyRes) {
          resolvedBuilderId = fuzzyRes.match.id;
          builderMatchScore = 1.0 - fuzzyRes.score;
          candidatesMap.builder = fuzzyRes.candidates;
        } else {
          warnings.push('builder_not_found_in_master_db');
        }
      }
    }
  } else {
    warnings.push('missing_builder_name');
  }

  // 2. Resolve Property Type (Field 2: Property Type)
  let resolvedPropertyTypeId = null;
  if (extractedData.type) {
    const matchedPT = MASTER_PROPERTY_TYPES.find(pt =>
      pt.name.toLowerCase() === extractedData.type.toLowerCase() ||
      pt.code.toLowerCase() === extractedData.type.toLowerCase()
    );
    if (matchedPT) {
      resolvedPropertyTypeId = matchedPT.id;
    }
  }

  // 3. Resolve Tags (Field 3: Tags)
  let resolvedTagId = null;
  if (extractedData.tags) {
    const matchedTag = MASTER_TAGS.find(t =>
      t.name.toLowerCase() === extractedData.tags.toLowerCase() ||
      t.slug.toLowerCase() === extractedData.tags.toLowerCase()
    );
    if (matchedTag) {
      resolvedTagId = matchedTag.id;
    }
  }

  // 4. Resolve Possession Status (Field 4: Possession Status)
  let resolvedPossessionStatusId = null;
  if (extractedData.possessionStatus) {
    const matchedPS = MASTER_POSSESSION_STATUSES.find(ps =>
      ps.name.toLowerCase() === extractedData.possessionStatus.toLowerCase() ||
      ps.code.toLowerCase() === extractedData.possessionStatus.toLowerCase()
    );
    if (matchedPS) {
      resolvedPossessionStatusId = matchedPS.id;
    }
  }

  // 5. Resolve City dynamically from Master Database API
  let resolvedCityId = null;
  let cityMatchScore = 0;

  if (extractedData.city) {
    const rawCity = extractedData.city.toLowerCase().trim();
    const mappedCityName = CITY_ALIASES[rawCity] || extractedData.city;

    try {
      const apiCity = await resolveMasterCity(mappedCityName);
      if (apiCity) {
        resolvedCityId = apiCity.id;
        cityMatchScore = 1.0;
      }
    } catch (err) {
      console.warn('[Entity Resolver] Master API city lookup notice:', err.message);
    }

    if (!resolvedCityId) {
      const matchedCity = MASTER_CITIES.find(c =>
        c.name.toLowerCase() === mappedCityName.toLowerCase() ||
        c.name.toLowerCase() === rawCity
      );

      if (matchedCity) {
        resolvedCityId = matchedCity.id;
        cityMatchScore = 1.0;
      } else {
        const fuzzyCity = fuzzyMatch(MASTER_CITIES, ['name'], mappedCityName, 0.4);
        if (fuzzyCity) {
          resolvedCityId = fuzzyCity.match.id;
          cityMatchScore = 1.0 - fuzzyCity.score;
        } else {
          warnings.push('city_not_found_in_master_db');
        }
      }
    }
  } else {
    warnings.push('missing_city');
  }

  // Resolve Zone (Child of City)
  let resolvedZoneId = null;
  if (extractedData.zone) {
    const matchedZone = MASTER_ZONES.find(z =>
      z.name.toLowerCase() === extractedData.zone.toLowerCase() &&
      (!resolvedCityId || z.cityId === resolvedCityId)
    );
    if (matchedZone) {
      resolvedZoneId = matchedZone.id;
    }
  }

  // 6. Resolve Locality / Location dynamically from Master Database API
  let resolvedLocationId = null;
  let locationMatchScore = 0;

  if (extractedData.location) {
    const rawLocation = extractedData.location;

    try {
      const apiLoc = await resolveMasterLocation(rawLocation, resolvedCityId);
      if (apiLoc) {
        resolvedLocationId = apiLoc.id;
        locationMatchScore = 1.0;
      }
    } catch (err) {
      console.warn('[Entity Resolver] Master API location lookup notice:', err.message);
    }

    if (!resolvedLocationId) {
      const directLoc = MASTER_LOCATIONS.find(l =>
        l.name.toLowerCase() === rawLocation.toLowerCase()
      );

      if (directLoc) {
        resolvedLocationId = directLoc.id;
        locationMatchScore = 1.0;
      } else {
        const fuzzyLoc = fuzzyMatch(MASTER_LOCATIONS, ['name'], rawLocation, 0.45);
        if (fuzzyLoc) {
          resolvedLocationId = fuzzyLoc.match.id;
          locationMatchScore = 1.0 - fuzzyLoc.score;
          candidatesMap.location = fuzzyLoc.candidates;
        } else {
          warnings.push('location_not_found_in_master_db');
        }
      }
    }
  }

  // 7. Resolve Transaction Tag (Field 7: Transaction Tag)
  let resolvedTransactionTagId = null;
  if (extractedData.transactionTag) {
    const matchedTT = MASTER_TRANSACTION_TAGS.find(tt =>
      tt.name.toLowerCase() === extractedData.transactionTag.toLowerCase() ||
      tt.code.toLowerCase() === extractedData.transactionTag.toLowerCase()
    );
    if (matchedTT) {
      resolvedTransactionTagId = matchedTT.id;
    }
  }

  // 8. Resolve Unit Types (Field 8: Unit Type)
  if (Array.isArray(extractedData.units)) {
    extractedData.units.forEach(u => {
      if (u.type) {
        const matchedUT = MASTER_UNIT_TYPES.find(ut =>
          ut.name.toLowerCase() === u.type.toLowerCase() ||
          ut.code.toLowerCase() === u.type.toLowerCase()
        );
        if (matchedUT) {
          u.resolvedUnitTypeId = matchedUT.id;
          u.type = matchedUT.code; // Standardize type
        }
      }
    });
  }

  // 9. Resolve Amenities IDs (Field 9: Amenities)
  const masterAmenitiesList = getActiveAmenitiesList() || [];
  const resolvedAmenityIds = (extractedData.amenities || []).map(name => {
    const found = masterAmenitiesList.find(a =>
      a.name.toLowerCase() === (typeof name === 'string' ? name.toLowerCase() : '')
    );
    return found ? found.id : null;
  }).filter(Boolean);

  // Calculate Weighted Confidence Score
  let score = 0.30; // Base baseline

  // Positive signals
  if (extractedData.rera) score += 0.20;
  if (resolvedBuilderId) score += 0.15;
  if (resolvedCityId && resolvedLocationId) score += 0.15;
  else if (resolvedCityId) score += 0.08;

  if (extractedData.units && extractedData.units.length > 0) score += 0.15;
  if (extractedData.images && extractedData.images.length > 0) score += 0.05;
  if (extractedData.faqs && extractedData.faqs.length > 0) score += 0.05;
  if (extractedData.advantages && extractedData.advantages.length > 0) score += 0.05;
  if (extractedData._meta?.modelUsed && extractedData._meta.modelUsed.startsWith('gemini')) score += 0.05;

  // Penalties
  if (!extractedData.rera) score -= 0.10;
  if (!resolvedBuilderId) score -= 0.05;
  if (warnings.some(w => w.includes('suspicious_price') || w.includes('geo_mismatch'))) {
    score -= 0.15;
  }

  // Bound score between 0.15 and 0.98
  score = Math.min(0.98, Math.max(0.15, Math.round(score * 100) / 100));

  // Deduplication & Existing Project Match Check
  let matchedProjectId = null;
  let isDuplicate = false;
  let actionType = 'create';
  let priceChangeDiff = null;

  const existingProject = EXISTING_PRODUCTION_PROJECTS.find(p => {
    const reraMatch = extractedData.rera && p.rera && p.rera.toLowerCase().trim() === extractedData.rera.toLowerCase().trim();
    const nameMatch = extractedData.name && p.name && p.name.toLowerCase().trim() === extractedData.name.toLowerCase().trim();
    return reraMatch || nameMatch;
  });

  if (existingProject) {
    matchedProjectId = existingProject.id;
    warnings.push('existing_project_matched');

    const diff = computePriceAndUnitDiff(existingProject, extractedData);
    if (diff) {
      actionType = 'update';
      priceChangeDiff = diff;
      isDuplicate = false;
    } else {
      isDuplicate = true;
      actionType = 'skip';
    }
  }

  return {
    resolved_builder_id: resolvedBuilderId,
    resolved_property_type_id: resolvedPropertyTypeId,
    resolved_tag_id: resolvedTagId,
    resolved_possession_status_id: resolvedPossessionStatusId,
    resolved_city_id: resolvedCityId,
    resolved_zone_id: resolvedZoneId,
    resolved_location_id: resolvedLocationId,
    resolved_transaction_tag_id: resolvedTransactionTagId,
    resolved_amenity_ids: resolvedAmenityIds,
    confidence_score: score,
    validation_warnings: Array.from(new Set(warnings)),
    matched_project_id: matchedProjectId,
    is_duplicate: isDuplicate,
    action_type: actionType,
    price_change_diff: priceChangeDiff,
    candidates: candidatesMap
  };
}

module.exports = {
  resolveEntitiesAndDeduplicate,
  cleanBuilderName,
  fuzzyMatch
};
