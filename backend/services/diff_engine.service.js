/**
 * Compares an existing production project with newly extracted data
 * Returns structured diff details for reviewer approval UI
 */
function computePriceAndUnitDiff(existingProject, extractedData) {
  const changes = [];
  const updatedFields = [];
  const unchangedFields = [];

  // Check top-level scalar fields
  const checkableFields = [
    { key: 'possessionStatus', label: 'Possession Status' },
    { key: 'possessionDate', label: 'Possession Date' },
    { key: 'towers', label: 'Towers' },
    { key: 'floors', label: 'Floors' }
  ];

  checkableFields.forEach(({ key, label }) => {
    if (extractedData[key] && extractedData[key] !== existingProject[key]) {
      changes.push({
        field: key,
        label,
        old: existingProject[key] || 'Not specified',
        new: extractedData[key],
        change: 'VALUE CHANGED'
      });
      updatedFields.push(key);
    } else {
      unchangedFields.push(key);
    }
  });

  // Compare Units
  const existingUnits = existingProject.units || [];
  const extractedUnits = extractedData.units || [];

  extractedUnits.forEach((newUnit, index) => {
    const matchedExistingUnit = existingUnits.find(u => u.type === newUnit.type);

    if (!matchedExistingUnit) {
      changes.push({
        field: `units[${index}]`,
        unit_type: newUnit.type,
        old: null,
        new: newUnit,
        change: 'NEW UNIT'
      });
      if (!updatedFields.includes('units')) updatedFields.push('units');
    } else {
      // Check minPrice diff
      if (newUnit.minPrice && newUnit.minPrice !== matchedExistingUnit.minPrice) {
        const diffPercent = Math.round(((newUnit.minPrice - matchedExistingUnit.minPrice) / matchedExistingUnit.minPrice) * 100);
        const sign = diffPercent >= 0 ? '+' : '';
        changes.push({
          field: `units[${index}].minPrice`,
          unit_type: newUnit.type,
          old: matchedExistingUnit.minPrice,
          new: newUnit.minPrice,
          change: `${sign}${diffPercent}%`
        });
        if (!updatedFields.includes('units')) updatedFields.push('units');
      }
      // Check maxPrice diff
      if (newUnit.maxPrice && newUnit.maxPrice !== matchedExistingUnit.maxPrice) {
        const diffPercent = Math.round(((newUnit.maxPrice - matchedExistingUnit.maxPrice) / matchedExistingUnit.maxPrice) * 100);
        const sign = diffPercent >= 0 ? '+' : '';
        changes.push({
          field: `units[${index}].maxPrice`,
          unit_type: newUnit.type,
          old: matchedExistingUnit.maxPrice,
          new: newUnit.maxPrice,
          change: `${sign}${diffPercent}%`
        });
        if (!updatedFields.includes('units')) updatedFields.push('units');
      }
    }
  });

  if (changes.length === 0) {
    return null;
  }

  const priceChangesCount = changes.filter(c => c.unit_type && c.change !== 'NEW UNIT').length;
  const newUnitsCount = changes.filter(c => c.change === 'NEW UNIT').length;

  let summaryParts = [];
  if (priceChangesCount > 0) summaryParts.push(`${priceChangesCount} unit price update(s)`);
  if (newUnitsCount > 0) summaryParts.push(`${newUnitsCount} new unit(s) added`);
  if (updatedFields.includes('possessionStatus')) summaryParts.push('possession status update');

  return {
    summary: summaryParts.join(', ') || 'Project data updates detected',
    changes,
    unchanged_fields: Array.from(new Set(unchangedFields)),
    updated_fields: Array.from(new Set(updatedFields))
  };
}

module.exports = { computePriceAndUnitDiff };
