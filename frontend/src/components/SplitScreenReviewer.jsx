import React, { useState, useEffect } from 'react';
import {
  ExternalLink, CheckCircle2, AlertTriangle, XCircle, Save, Send, ShieldCheck,
  Building, MapPin, DollarSign, Image as ImageIcon, ChevronDown, ChevronUp,
  HelpCircle, Plus, Trash2, Search, Tag, Calendar, Compass, Layers, Check,
  ChevronLeft, ChevronRight, UploadCloud, Eye, FileText, Info, Video, Film, Play
} from 'lucide-react';
import { searchLocalities, searchCities, searchBuilders, searchAmenities } from '../config/api';

const STEPS = [
  { id: 1, label: 'Basic Details', icon: Building },
  { id: 2, label: 'Location', icon: MapPin },
  { id: 3, label: 'Property Info', icon: Layers },
  { id: 4, label: 'Pricing', icon: DollarSign },
  { id: 5, label: 'Amenities', icon: CheckCircle2 },
  { id: 6, label: 'Other Details', icon: HelpCircle },
  { id: 7, label: 'Upload Files', icon: UploadCloud }
];

const AMENITY_SYNONYMS = {
  'gym': 'Gym',
  'gymnasium': 'Gym',
  'fitness center': 'Gym',
  'fitness centre': 'Gym',
  'health club': 'Gym',
  'clubhouse': 'Club House',
  'club house': 'Club House',
  'swimming pool': 'Swimming Pool',
  'pool': 'Swimming Pool',
  'jogging track': 'Cycling & Jogging Track',
  'cycling track': 'Cycling & Jogging Track',
  'cycling & jogging track': 'Cycling & Jogging Track',
  'children\'s play area': 'Children\'s Play Area',
  'children play area': 'Children\'s Play Area',
  'kids play area': 'Children\'s Play Area',
  '24x7 security': '24x7 Security',
  '24/7 security': '24x7 Security',
  '24x7 water supply': '24x7 Water Supply',
  '24/7 water supply': '24x7 Water Supply',
  'power backup': 'Power Backup',
  '100% power backup': 'Power Backup',
  'cctv': 'CCTV',
  'senior citizen pavilion': 'Senior Citizen Pavilion',
  'senior citizens sitout': 'Senior Citizen Pavilion',
  'yoga / meditation area': 'Yoga / Meditation Area',
  'yoga deck': 'Yoga / Meditation Area',
  'spa, sauna, steam': 'Spa, Sauna, Steam',
  'flower garden': 'Flower Garden',
  'landscaped garden': 'Flower Garden',
  'fire fighting system': 'Fire Fighting System',
  'car parking': 'Car Parking',
  'gated community': 'Gated Community'
};

function cleanAmenityKey(str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveCanonicalAmenityName(rawName, masterList = []) {
  if (!rawName || typeof rawName !== 'string') return '';
  const trimmed = rawName.trim();
  const lower = trimmed.toLowerCase();
  const key = cleanAmenityKey(trimmed);

  if (AMENITY_SYNONYMS[lower]) return AMENITY_SYNONYMS[lower];

  for (const [synKey, canonical] of Object.entries(AMENITY_SYNONYMS)) {
    if (cleanAmenityKey(synKey) === key) return canonical;
  }

  for (const m of masterList) {
    const mName = m.name || m;
    if (mName.toLowerCase() === lower || cleanAmenityKey(mName) === key) {
      return mName;
    }
  }

  // Keyword fuzzy matches
  if (lower.includes('gym') || lower.includes('fitness')) return 'Gym';
  if (lower.includes('club') && (lower.includes('house') || lower.includes('home'))) return 'Club House';
  if (lower.includes('swimming') || (lower.includes('pool') && !lower.includes('table'))) return 'Swimming Pool';
  if (lower.includes('jogging') || (lower.includes('cycling') && lower.includes('track'))) return 'Cycling & Jogging Track';
  if (lower.includes('kids') && lower.includes('play')) return 'Children\'s Play Area';
  if (lower.includes('children') && lower.includes('play')) return 'Children\'s Play Area';
  if (lower.includes('security') && (lower.includes('24') || lower.includes('7'))) return '24x7 Security';
  if (lower.includes('water') && (lower.includes('24') || lower.includes('supply'))) return '24x7 Water Supply';
  if (lower.includes('power') && lower.includes('back')) return 'Power Backup';
  if (lower.includes('yoga') || lower.includes('meditation')) return 'Yoga / Meditation Area';

  return trimmed;
}

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
  'hyderabad': 'Hyderabad',
  'pune': 'Pune',
  'chennai': 'Chennai',
  'kolkata': 'Kolkata',
  'ahmedabad': 'Ahmedabad'
};

export default function SplitScreenReviewer({
  item,
  masters,
  onApprove,
  onReject,
  onSaveDraft,
  onApplyUpdate,
  onCreateMasterAmenity,
  onCreateMasterCity,
  onCreateMasterLocation,
  onCreateMasterBuilder
}) {
  const [formData, setFormData] = useState({});
  const [currentStep, setCurrentStep] = useState(1);
  const [resolvedBuilderId, setResolvedBuilderId] = useState('');
  const [resolvedCityId, setResolvedCityId] = useState('');
  const [resolvedZoneId, setResolvedZoneId] = useState('');
  const [resolvedLocationId, setResolvedLocationId] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [showRawJson, setShowRawJson] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [amenitySearch, setAmenitySearch] = useState('');
  const [customAmenityInput, setCustomAmenityInput] = useState('');
  const [addingAmenityName, setAddingAmenityName] = useState(null);
  const [liveAmenities, setLiveAmenities] = useState([]);
  const [loadingAmenities, setLoadingAmenities] = useState(false);

  // Step 7: Media Upload States
  const [videoType, setVideoType] = useState('Walkthrough');
  const [videoAlt, setVideoAlt] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [newImageUrlInput, setNewImageUrlInput] = useState('');
  const [newLogoUrlInput, setNewLogoUrlInput] = useState('');
  const [newThumbnailUrlInput, setNewThumbnailUrlInput] = useState('');

  // Dynamic Master Database Amenities Search & Fetch
  useEffect(() => {
    setLoadingAmenities(true);
    const timer = setTimeout(() => {
      searchAmenities(1, 150, amenitySearch)
        .then(data => {
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            setLiveAmenities(data.data);
          } else {
            const fallback = (masters.amenities || []).filter(a =>
              !amenitySearch || a.name.toLowerCase().includes(amenitySearch.toLowerCase())
            );
            setLiveAmenities(fallback);
          }
        })
        .catch(() => {
          const fallback = (masters.amenities || []).filter(a =>
            !amenitySearch || a.name.toLowerCase().includes(amenitySearch.toLowerCase())
          );
          setLiveAmenities(fallback);
        })
        .finally(() => setLoadingAmenities(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [amenitySearch, masters.amenities]);

  // Step 1: Searchable Master Builder
  const [builderSearch, setBuilderSearch] = useState('');
  const [liveBuilders, setLiveBuilders] = useState([]);
  const [loadingBuilders, setLoadingBuilders] = useState(false);
  const [addingBuilder, setAddingBuilder] = useState(false);

  useEffect(() => {
    setLoadingBuilders(true);
    const timer = setTimeout(() => {
      searchBuilders(builderSearch)
        .then(data => {
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            setLiveBuilders(data.data);
          } else {
            const fallback = (masters.builders || []).filter(b => !builderSearch || b.name.toLowerCase().includes(builderSearch.toLowerCase()));
            setLiveBuilders(fallback);
          }
        })
        .catch(() => {
          setLiveBuilders(masters.builders || []);
        })
        .finally(() => setLoadingBuilders(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [builderSearch, masters.builders]);

  // Step 2: Searchable City & City-Scoped Localities (Real API lookups only)
  const [citySearch, setCitySearch] = useState('');
  const [liveCities, setLiveCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [cityLocalities, setCityLocalities] = useState([]);
  const [loadingLocalities, setLoadingLocalities] = useState(false);
  const [addingCity, setAddingCity] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);

  useEffect(() => {
    setLoadingCities(true);
    const timer = setTimeout(() => {
      searchCities(citySearch)
        .then(data => {
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            setLiveCities(data.data);
          } else {
            const fallback = (masters.cities || []).filter(c => !citySearch || c.name.toLowerCase().includes(citySearch.toLowerCase()));
            setLiveCities(fallback);
          }
        })
        .catch(() => {
          setLiveCities(masters.cities || []);
        })
        .finally(() => setLoadingCities(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [citySearch, masters.cities]);

  useEffect(() => {
    if (!resolvedCityId) {
      setCityLocalities([]);
      return;
    }
    setLoadingLocalities(true);
    const timer = setTimeout(() => {
      searchLocalities(resolvedCityId, locationSearch)
        .then(data => {
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            setCityLocalities(data.data);
          } else {
            const fallback = (masters.locations || []).filter(l =>
              (!resolvedCityId || !l.cityId || l.cityId === resolvedCityId) &&
              (!locationSearch || l.name.toLowerCase().includes(locationSearch.toLowerCase()))
            );
            setCityLocalities(fallback);
          }
        })
        .catch(() => {
          const fallback = (masters.locations || []).filter(l => !resolvedCityId || !l.cityId || l.cityId === resolvedCityId);
          setCityLocalities(fallback);
        })
        .finally(() => setLoadingLocalities(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [resolvedCityId, locationSearch, masters.locations]);

  // Automatically match & select extracted city once liveCities are fetched
  useEffect(() => {
    if (!resolvedCityId && liveCities.length > 0) {
      const cityToMatch = formData.city || item?.extracted_data?.city;
      if (cityToMatch) {
        const cLower = cityToMatch.toLowerCase().trim();
        const aliasTarget = CITY_ALIASES[cLower] || cityToMatch.trim();
        const match = liveCities.find(c =>
          c.name.toLowerCase() === aliasTarget.toLowerCase() ||
          c.name.toLowerCase() === cLower
        );
        if (match) {
          setResolvedCityId(match.id);
          setFormData(prev => ({ ...prev, city: match.name }));
        }
      }
    }
  }, [liveCities, formData.city, item, resolvedCityId]);

  // Automatically match & select extracted builder once liveBuilders are fetched
  useEffect(() => {
    if (!resolvedBuilderId && liveBuilders.length > 0) {
      const bToMatch = formData.builder || item?.extracted_data?.builder || '';
      if (bToMatch) {
        const bLower = bToMatch.toLowerCase().trim();
        const match = liveBuilders.find(b =>
          b.name.toLowerCase() === bLower ||
          b.name.toLowerCase().includes(bLower) ||
          bLower.includes(b.name.toLowerCase())
        );
        if (match) {
          setResolvedBuilderId(match.id);
          setFormData(prev => ({ ...prev, builder: match.name }));
        }
      }
    }
  }, [liveBuilders, formData.builder, item, resolvedBuilderId]);

  // Automatically match & select extracted locality once cityLocalities are fetched
  useEffect(() => {
    if (!resolvedLocationId && cityLocalities.length > 0) {
      const locToMatch = formData.location || item?.extracted_data?.location;
      if (locToMatch) {
        const lLower = locToMatch.toLowerCase().trim();
        const match = cityLocalities.find(l =>
          l.name.toLowerCase() === lLower ||
          l.name.toLowerCase().includes(lLower) ||
          lLower.includes(l.name.toLowerCase())
        );
        if (match) {
          setResolvedLocationId(match.id);
          setFormData(prev => ({ ...prev, location: match.name }));
        }
      }
    }
  }, [cityLocalities, formData.location, item, resolvedLocationId]);

  const handleCityChange = (cityId) => {
    setResolvedCityId(cityId);
    setResolvedLocationId('');
    const foundCity = (liveCities || []).find(c => c.id === cityId) || (masters.cities || []).find(c => c.id === cityId);
    if (foundCity) {
      setFormData(prev => ({ ...prev, city: foundCity.name, location: '' }));
    } else {
      setFormData(prev => ({ ...prev, location: '' }));
    }
  };

  const handleLocationChange = (locationId) => {
    setResolvedLocationId(locationId);
    const foundLoc = (cityLocalities || []).find(l => l.id === locationId) || (masters.locations || []).find(l => l.id === locationId);
    if (foundLoc) {
      setFormData(prev => ({ ...prev, location: foundLoc.name }));
    }
  };

  const handleAddExtractedCity = async (cityName) => {
    const nameToAdd = cityName || extractedCityName;
    if (!nameToAdd || !onCreateMasterCity) return;
    setAddingCity(true);
    try {
      const created = await onCreateMasterCity(nameToAdd);
      if (created) {
        setResolvedCityId(created.id);
        setFormData(prev => ({ ...prev, city: created.name }));
        setLiveCities(prev => [...(prev || []).filter(c => c.id !== created.id), created]);
        return created;
      }
    } catch (err) {
      console.error('Failed to add city to master:', err);
    } finally {
      setAddingCity(false);
    }
    return null;
  };

  const handleAddExtractedLocation = async (locName, cityId, pincode) => {
    const nameToAdd = locName || extractedLocName;
    if (!nameToAdd || !onCreateMasterLocation) return;
    setAddingLocation(true);
    try {
      let targetCityId = cityId || resolvedCityId;
      
      // If city is not yet resolved, automatically add or resolve extracted city first
      if (!targetCityId && extractedCityName && onCreateMasterCity) {
        setAddingCity(true);
        const createdCity = await onCreateMasterCity(extractedCityName);
        if (createdCity) {
          targetCityId = createdCity.id;
          setResolvedCityId(createdCity.id);
          setFormData(prev => ({ ...prev, city: createdCity.name }));
          setLiveCities(prev => [...(prev || []).filter(c => c.id !== createdCity.id), createdCity]);
        }
        setAddingCity(false);
      }

      const created = await onCreateMasterLocation(nameToAdd, targetCityId, pincode || formData.pincode || '');
      if (created) {
        setResolvedLocationId(created.id);
        setFormData(prev => ({ ...prev, location: created.name }));
        setCityLocalities(prev => [...(prev || []).filter(l => l.id !== created.id), created]);
        return created;
      }
    } catch (err) {
      console.error('Failed to add location to master:', err);
    } finally {
      setAddingLocation(false);
      setAddingCity(false);
    }
    return null;
  };

  const handleAddExtractedBuilder = async (builderName) => {
    const nameToAdd = builderName || extractedBuilderName;
    if (!nameToAdd || !onCreateMasterBuilder) return;
    setAddingBuilder(true);
    try {
      const created = await onCreateMasterBuilder(nameToAdd);
      if (created) {
        setResolvedBuilderId(created.id);
        setFormData(prev => ({ ...prev, builder: created.name, builderName: created.name }));
        setLiveBuilders(prev => [...(prev || []).filter(b => b.id !== created.id), created]);
        return created;
      }
    } catch (err) {
      console.error('Failed to add builder to master:', err);
    } finally {
      setAddingBuilder(false);
    }
    return null;
  };

  useEffect(() => {
    if (item) {
      const extracted = item.extracted_data || {};
      const rawAmenities = extracted.amenities || [];
      const normalizedAmenities = Array.from(new Set(rawAmenities.map(a => resolveCanonicalAmenityName(a, masters.amenities || []))));

      const rawBuilderName = (extracted.builderName || extracted.builder || extracted.developer || '').trim();
      let initBuilderId = item.resolved_builder_id || '';
      if (!initBuilderId && rawBuilderName) {
        const bLower = rawBuilderName.toLowerCase();
        const allKnown = Array.from(new Map([...(liveBuilders || []), ...(masters.builders || [])].map(b => [b.id, b])).values());
        const match = allKnown.find(b =>
          b.name.toLowerCase() === bLower ||
          b.name.toLowerCase().includes(bLower) ||
          bLower.includes(b.name.toLowerCase())
        );
        if (match) initBuilderId = match.id;
      }

      let initCityId = item.resolved_city_id || '';
      if (!initCityId && extracted.city) {
        const cLower = extracted.city.toLowerCase().trim();
        const aliasTarget = CITY_ALIASES[cLower] || extracted.city.trim();
        const match = (masters.cities || []).find(c =>
          c.name.toLowerCase() === aliasTarget.toLowerCase() ||
          c.name.toLowerCase() === cLower
        );
        if (match) initCityId = match.id;
      }

      let initLocId = item.resolved_location_id || '';
      if (!initLocId && extracted.location && initCityId) {
        const lLower = extracted.location.toLowerCase().trim();
        const match = (masters.locations || []).find(l =>
          l.name.toLowerCase() === lLower && (!initCityId || l.cityId === initCityId)
        );
        if (match) initLocId = match.id;
      }

      setFormData({
        ...extracted,
        builderName: rawBuilderName,
        builder: rawBuilderName,
        amenities: normalizedAmenities
      });
      setResolvedBuilderId(initBuilderId);
      setResolvedCityId(initCityId);
      setResolvedZoneId(item.resolved_zone_id || '');
      setResolvedLocationId(initLocId);
      setReviewNotes(item.review_notes || '');
      setCurrentStep(1);
    }
  }, [item, masters]);

  if (!item) {
    return (
      <div className="glass-panel" style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '0.95rem' }}>Select a property from the queue sidebar to review</p>
      </div>
    );
  }

  const handleFieldChange = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }));
  };

  const handleUnitChange = (index, key, val) => {
    const updatedUnits = [...(formData.units || [])];
    updatedUnits[index] = { ...updatedUnits[index], [key]: val };
    setFormData(prev => ({ ...prev, units: updatedUnits }));
  };

  const handleAddUnit = () => {
    const newUnit = {
      type: '2BHK',
      areaStatus: 'Available',
      areaVisibility: 'Public',
      minArea: '',
      maxArea: '',
      priceStatus: 'Available',
      priceVisibility: 'Public',
      currency: 'INR',
      minPrice: '',
      maxPrice: '',
      floorPlanImage: null
    };
    setFormData(prev => ({ ...prev, units: [...(prev.units || []), newUnit] }));
  };

  const handleDeleteUnit = (index) => {
    const updatedUnits = (formData.units || []).filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, units: updatedUnits }));
  };

  const handleFaqChange = (index, key, val) => {
    const updatedFaqs = [...(formData.faqs || [])];
    updatedFaqs[index] = { ...updatedFaqs[index], [key]: val };
    setFormData(prev => ({ ...prev, faqs: updatedFaqs }));
  };

  const handleAddFaq = () => {
    const updatedFaqs = [...(formData.faqs || []), { question: '', answer: '' }];
    setFormData(prev => ({ ...prev, faqs: updatedFaqs }));
  };

  const handleDeleteFaq = (index) => {
    const updatedFaqs = (formData.faqs || []).filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, faqs: updatedFaqs }));
  };

  const handleAdvantageChange = (index, key, val) => {
    const updatedAdvantages = [...(formData.advantages || [])];
    updatedAdvantages[index] = { ...updatedAdvantages[index], [key]: val };
    setFormData(prev => ({ ...prev, advantages: updatedAdvantages }));
  };

  const handleAddAdvantage = () => {
    const updatedAdvantages = [...(formData.advantages || []), { title: '', description: '' }];
    setFormData(prev => ({ ...prev, advantages: updatedAdvantages }));
  };

  const handleDeleteAdvantage = (index) => {
    const updatedAdvantages = (formData.advantages || []).filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, advantages: updatedAdvantages }));
  };

  const toggleAmenity = (name) => {
    const canonical = resolveCanonicalAmenityName(name, masters.amenities || []);
    const current = formData.amenities || [];
    const exists = current.some(a => resolveCanonicalAmenityName(a, masters.amenities || []).toLowerCase() === canonical.toLowerCase());
    const updated = exists
      ? current.filter(a => resolveCanonicalAmenityName(a, masters.amenities || []).toLowerCase() !== canonical.toLowerCase())
      : [...current, canonical];
    setFormData(prev => ({ ...prev, amenities: Array.from(new Set(updated)) }));
  };

  const removeAmenityChip = (name) => {
    const canonical = resolveCanonicalAmenityName(name, masters.amenities || []);
    const current = formData.amenities || [];
    setFormData(prev => ({
      ...prev,
      amenities: current.filter(a => resolveCanonicalAmenityName(a, masters.amenities || []).toLowerCase() !== canonical.toLowerCase())
    }));
  };

  const handleAddDiscoveredAmenity = async (name) => {
    if (!name || !onCreateMasterAmenity) return;
    setAddingAmenityName(name);
    try {
      const created = await onCreateMasterAmenity(name);
      if (created) {
        setLiveAmenities(prev => [created, ...(prev || []).filter(a => a.id !== created.id)]);
        // Ensure it is kept selected in formData
        const current = formData.amenities || [];
        if (!current.some(a => a.toLowerCase() === name.toLowerCase())) {
          setFormData(prev => ({ ...prev, amenities: [...(prev.amenities || []), created.name] }));
        }
      }
    } catch (err) {
      console.error('Failed to add discovered amenity to master:', err);
    } finally {
      setAddingAmenityName(null);
    }
  };

  const handleAddCustomAmenity = async () => {
    if (!customAmenityInput.trim() || !onCreateMasterAmenity) return;
    const name = customAmenityInput.trim();
    setAddingAmenityName(name);
    try {
      const created = await onCreateMasterAmenity(name);
      if (created) {
        setLiveAmenities(prev => [created, ...(prev || []).filter(a => a.id !== created.id)]);
        setFormData(prev => ({
          ...prev,
          amenities: [...(prev.amenities || []).filter(a => a.toLowerCase() !== name.toLowerCase()), created.name]
        }));
        setCustomAmenityInput('');
      }
    } catch (err) {
      console.error('Failed to create custom master amenity:', err);
    } finally {
      setAddingAmenityName(null);
    }
  };

  // Media Handlers for Step 7: Upload Files
  const handleLogoUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData(prev => ({ ...prev, logo: e.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleThumbnailUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData(prev => ({ ...prev, thumbnail: e.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleOtherImagesUpload = (files) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({
          ...prev,
          images: [
            ...(prev.images || []),
            { type: 'image', title: file.name.replace(/\.[^/.]+$/, ''), url: e.target.result, alt: file.name }
          ]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddOtherImageUrl = () => {
    if (!newImageUrlInput.trim()) return;
    setFormData(prev => ({
      ...prev,
      images: [
        ...(prev.images || []),
        { type: 'image', title: 'Property Image', url: newImageUrlInput.trim(), alt: 'Property Image' }
      ]
    }));
    setNewImageUrlInput('');
  };

  const handleRemoveOtherImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: (prev.images || []).filter((_, idx) => idx !== index)
    }));
  };

  const handleAddVideo = (directUrl = null) => {
    const finalUrl = directUrl || videoUrlInput.trim();
    if (!finalUrl) return;
    setFormData(prev => ({
      ...prev,
      videos: [
        ...(prev.videos || []),
        {
          type: 'video',
          videoType: videoType || 'Walkthrough',
          url: finalUrl,
          title: videoAlt.trim() || `${videoType || 'Property'} Video`,
          alt: videoAlt.trim() || 'Property Video'
        }
      ]
    }));
    setVideoUrlInput('');
    setVideoAlt('');
  };

  const handleVideoFileUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      handleAddVideo(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveVideo = (index) => {
    setFormData(prev => ({
      ...prev,
      videos: (prev.videos || []).filter((_, idx) => idx !== index)
    }));
  };

  const handleSave = () => {
    onSaveDraft(item.id, {
      extracted_data: formData,
      resolved_builder_id: resolvedBuilderId || null,
      resolved_city_id: resolvedCityId || null,
      resolved_zone_id: resolvedZoneId || null,
      resolved_location_id: resolvedLocationId || null,
      review_notes: reviewNotes
    });
  };

  const scorePercentage = Math.round((item.confidence_score || 0.5) * 100);

  const allKnownAmenities = Array.from(
    new Map([...(liveAmenities || []), ...(masters.amenities || [])].map(a => [a.name.toLowerCase(), a])).values()
  );

  const filteredMasterAmenities = (liveAmenities && liveAmenities.length > 0)
    ? liveAmenities
    : (masters.amenities || []).filter(a =>
        !amenitySearch || a.name.toLowerCase().includes(amenitySearch.toLowerCase())
      );

  const extractedCityName = (formData.city || item?.extracted_data?.city || '').trim();
  const canonicalCityName = extractedCityName ? (CITY_ALIASES[extractedCityName.toLowerCase()] || extractedCityName) : '';
  const allKnownCities = Array.from(new Map([...(liveCities || []), ...(masters.cities || [])].map(c => [c.id, c])).values());
  const matchedMasterCity = allKnownCities.find(c =>
    (extractedCityName && c.name.toLowerCase() === extractedCityName.toLowerCase()) ||
    (canonicalCityName && c.name.toLowerCase() === canonicalCityName.toLowerCase())
  );
  const currentCityObj = allKnownCities.find(c => c.id === resolvedCityId);
  const isExtractedCityUnmapped = Boolean(
    extractedCityName &&
    !matchedMasterCity &&
    (!resolvedCityId || !allKnownCities.some(c => c.id === resolvedCityId))
  );

  const extractedLocName = (formData.location || item?.extracted_data?.location || '').trim();
  const allKnownLocs = Array.from(new Map([...(cityLocalities || []), ...(masters.locations || [])].map(l => [l.id, l])).values());
  const matchedMasterLoc = allKnownLocs.find(l =>
    extractedLocName &&
    l.name.toLowerCase() === extractedLocName.toLowerCase() &&
    (!resolvedCityId || !l.cityId || l.cityId === resolvedCityId)
  );
  const currentLocObj = allKnownLocs.find(l => l.id === resolvedLocationId);
  const isExtractedLocationUnmapped = Boolean(
    extractedLocName &&
    !matchedMasterLoc &&
    (!resolvedLocationId || !allKnownLocs.some(l => l.id === resolvedLocationId))
  );

  const extractedBuilderName = (
    formData.builderName ||
    formData.builder ||
    formData.developer ||
    item?.extracted_data?.builderName ||
    item?.extracted_data?.builder ||
    item?.extracted_data?.developer ||
    ''
  ).trim();
  const allKnownBuilders = Array.from(new Map([...(liveBuilders || []), ...(masters.builders || [])].map(b => [b.id, b])).values());
  const matchedMasterBuilder = allKnownBuilders.find(b =>
    extractedBuilderName && (
      b.name.toLowerCase() === extractedBuilderName.toLowerCase() ||
      b.name.toLowerCase().includes(extractedBuilderName.toLowerCase()) ||
      extractedBuilderName.toLowerCase().includes(b.name.toLowerCase())
    )
  );
  const currentBuilderObj = allKnownBuilders.find(b => b.id === resolvedBuilderId);
  const isExtractedBuilderUnmapped = Boolean(
    extractedBuilderName &&
    !matchedMasterBuilder &&
    (!resolvedBuilderId || !allKnownBuilders.some(b => b.id === resolvedBuilderId))
  );

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '38% 62%', gap: '12px', height: '100%', overflow: 'hidden' }}>
      {/* LEFT PANEL: PROOF & TELEMETRY */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck style={{ width: 16, height: 16, color: scorePercentage >= 80 ? '#34d399' : '#fbbf24' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Web Proof & Signals</span>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: scorePercentage >= 85 ? '#34d399' : '#fbbf24', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 12 }}>
            Score: {scorePercentage}%
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
          {/* Screenshot Preview */}
          <div style={{ marginBottom: '14px', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--glass-border)', position: 'relative' }}>
            <img
              src={item.screenshot_url || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'}
              alt="Source Proof"
              style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }}
            />
            <div style={{ position: 'absolute', bottom: 0, inset: 'auto 0 0 0', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.725rem', color: '#93c5fd', fontWeight: 600 }}>Domain: {item.source_domain}</span>
              <a href={formData.sourceLink || item.source_url} target="_blank" rel="noreferrer" style={{ color: '#fff', fontSize: '0.725rem', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                Open Web Page <ExternalLink style={{ width: 12, height: 12 }} />
              </a>
            </div>
          </div>

          {/* Validation Warnings */}
          {item.validation_warnings && item.validation_warnings.length > 0 && (
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24', fontSize: '0.775rem', fontWeight: 600, marginBottom: '4px' }}>
                <AlertTriangle style={{ width: 14, height: 14 }} />
                <span>Attention Warnings ({item.validation_warnings.length})</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {item.validation_warnings.map((warn, i) => (
                  <span key={i} style={{ fontSize: '0.675rem', background: 'rgba(245, 158, 11, 0.2)', color: '#fef08a', padding: '1px 6px', borderRadius: 4 }}>
                    ⚠️ {warn}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Scraped Master Entities Summary Card */}
          <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '10px 12px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#93c5fd' }}>Scraped Master Entities</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Status & Alignment</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* Scraped Builder Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.725rem', background: 'rgba(255,255,255,0.03)', padding: '5px 8px', borderRadius: 4 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Scraped Builder:</span>
                  <strong style={{ color: extractedBuilderName ? '#fff' : '#fca5a5' }}>
                    {extractedBuilderName || 'Not Detected'}
                  </strong>
                </div>
                {matchedMasterBuilder || currentBuilderObj ? (
                  <span style={{ fontSize: '0.65rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                    ✓ {currentBuilderObj?.name || matchedMasterBuilder?.name}
                  </span>
                ) : extractedBuilderName ? (
                  <button
                    type="button"
                    onClick={() => handleAddExtractedBuilder(extractedBuilderName)}
                    disabled={addingBuilder}
                    style={{ fontSize: '0.675rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}
                  >
                    <Plus style={{ width: 10, height: 10 }} />
                    {addingBuilder ? 'Adding...' : 'Add Builder'}
                  </button>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>N/A</span>
                )}
              </div>

              {/* Scraped City Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.725rem', background: 'rgba(255,255,255,0.03)', padding: '5px 8px', borderRadius: 4 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Scraped City:</span>
                  <strong style={{ color: '#fff' }}>{extractedCityName || 'None'}</strong>
                </div>
                {matchedMasterCity || currentCityObj ? (
                  <span style={{ fontSize: '0.65rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                    ✓ {currentCityObj?.name || matchedMasterCity?.name}
                  </span>
                ) : extractedCityName ? (
                  <button
                    type="button"
                    onClick={() => handleAddExtractedCity(extractedCityName)}
                    disabled={addingCity}
                    style={{ fontSize: '0.675rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}
                  >
                    <Plus style={{ width: 10, height: 10 }} />
                    {addingCity ? 'Adding...' : 'Add City'}
                  </button>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>N/A</span>
                )}
              </div>

              {/* Scraped Locality Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.725rem', background: 'rgba(255,255,255,0.03)', padding: '5px 8px', borderRadius: 4 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Scraped Locality:</span>
                  <strong style={{ color: '#fff' }}>{extractedLocName || 'None'}</strong>
                </div>
                {matchedMasterLoc || currentLocObj ? (
                  <span style={{ fontSize: '0.65rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                    ✓ {currentLocObj?.name || matchedMasterLoc?.name}
                  </span>
                ) : extractedLocName ? (
                  <button
                    type="button"
                    onClick={() => handleAddExtractedLocation(extractedLocName, resolvedCityId, formData.pincode)}
                    disabled={addingLocation}
                    style={{ fontSize: '0.675rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}
                  >
                    <Plus style={{ width: 10, height: 10 }} />
                    {addingLocation ? 'Adding...' : 'Add Locality'}
                  </button>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>N/A</span>
                )}
              </div>
            </div>
          </div>

          {/* Key Metrics Quick Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--glass-border)' }}>
              <span style={{ fontSize: '0.675rem', color: 'var(--text-muted)', display: 'block' }}>Extracted Units</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#93c5fd' }}>{(formData.units || []).length} Configurations</span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--glass-border)' }}>
              <span style={{ fontSize: '0.675rem', color: 'var(--text-muted)', display: 'block' }}>Extracted FAQs</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399' }}>{(formData.faqs || []).length} Q&As</span>
            </div>
          </div>

          {/* Media Thumbnails */}
          <div style={{ marginBottom: '14px' }}>
            <span className="form-label">Scraped Media & Floor Plans</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {(formData.images || []).slice(0, 3).map((img, i) => (
                <img key={i} src={img.url} alt={img.alt || 'Media'} style={{ width: '100%', height: '56px', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--glass-border)' }} />
              ))}
            </div>
          </div>

          {/* Pipeline Execution Telemetry */}
          {item.pipeline_logs && item.pipeline_logs.length > 0 && (
            <div style={{ marginBottom: '14px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.15)', padding: '8px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.725rem', color: '#93c5fd', fontWeight: 600 }}>Pipeline Telemetry</span>
                <span style={{ fontSize: '0.675rem', color: '#6ee7b7' }}>{item.total_duration_ms ? `${item.total_duration_ms}ms` : ''}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {item.pipeline_logs.map((log, idx) => (
                  <div key={idx} style={{ fontSize: '0.675rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>✓ {log.step}: {log.details || log.status}</span>
                    <span style={{ color: '#94a3b8' }}>{log.duration_ms ? `${log.duration_ms}ms` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Collapsible JSON payload */}
          <div style={{ borderRadius: 6, border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              style={{ width: '100%', padding: '6px 10px', background: 'rgba(0,0,0,0.2)', border: 'none', color: 'var(--text-muted)', fontSize: '0.725rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <span>View Raw JSON Output</span>
              {showRawJson ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />}
            </button>
            {showRawJson && (
              <pre style={{ padding: '10px', fontSize: '0.675rem', color: '#34d399', background: '#090d16', overflowX: 'auto', maxHeight: '180px', margin: 0 }}>
                {JSON.stringify(formData, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: 7-STEP ADMIN PANEL REVIEW FORM */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
        {/* STEPPER HEADER TABS */}
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--glass-border)',
          background: 'rgba(0,0,0,0.3)',
          display: 'flex',
          gap: '4px',
          overflowX: 'auto',
          alignItems: 'center'
        }}>
          {STEPS.map((step) => {
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStep(step.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  background: isActive
                    ? 'rgba(59, 130, 246, 0.25)'
                    : isCompleted
                      ? 'rgba(16, 185, 129, 0.12)'
                      : 'rgba(255, 255, 255, 0.04)',
                  borderColor: isActive
                    ? '#3b82f6'
                    : isCompleted
                      ? 'rgba(16, 185, 129, 0.3)'
                      : 'var(--glass-border)',
                  color: isActive
                    ? '#93c5fd'
                    : isCompleted
                      ? '#34d399'
                      : 'var(--text-muted)'
                }}
              >
                <span style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  background: isActive ? '#3b82f6' : isCompleted ? '#10b981' : 'rgba(255,255,255,0.1)',
                  color: '#fff'
                }}>
                  {isCompleted ? '✓' : step.id}
                </span>
                <span>{step.label}</span>
              </button>
            );
          })}
        </div>

        {/* STEP CONTENT BODY (Scrollable) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 85px 18px' }}>
          {/* Update Diff Viewer if update_pending */}
          {item.action_type === 'update' && item.price_change_diff && (
            <UpdateDiffViewer
              diffData={item.price_change_diff}
              matchedProjectId={item.matched_project_id}
              onApplyUpdate={() => onApplyUpdate(item.id)}
            />
          )}

          {/* STEP 1: BASIC INFORMATION */}
          {currentStep === 1 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                <Building style={{ width: 18, height: 18, color: '#93c5fd' }} />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Basic Information</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label className="form-label">Project Name <span style={{ color: '#f87171' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name || ''}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    placeholder="Enter project name..."
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>
                      Builder Name <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {(liveBuilders || []).length} master builders
                    </span>
                  </div>

                  <div style={{ marginBottom: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Scraped from website:</span>
                    {extractedBuilderName ? (
                      <strong style={{ color: '#93c5fd' }}>"{extractedBuilderName}"</strong>
                    ) : (
                      <strong style={{ color: '#fca5a5' }}>Not detected on page</strong>
                    )}
                  </div>

                  <div style={{ position: 'relative', marginBottom: '6px' }}>
                    <Search style={{ width: 13, height: 13, position: 'absolute', left: 8, top: 9, color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: '28px', fontSize: '0.75rem', height: '30px' }}
                      placeholder="Search builder (e.g. Sattva Group, Sobha)..."
                      value={builderSearch}
                      onChange={(e) => setBuilderSearch(e.target.value)}
                    />
                  </div>

                  <select
                    className="form-select"
                    value={resolvedBuilderId}
                    onChange={(e) => {
                      const bid = e.target.value;
                      setResolvedBuilderId(bid);
                      const found = allKnownBuilders.find(b => b.id === bid);
                      if (found) {
                        setFormData(prev => ({ ...prev, builder: found.name, builderName: found.name }));
                      } else {
                        setFormData(prev => ({ ...prev, builder: '', builderName: '' }));
                      }
                    }}
                    style={{ fontSize: '0.82rem', fontWeight: 600 }}
                  >
                    <option value="">-- Select Master Builder --</option>
                    {(liveBuilders || []).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>

                  {isExtractedBuilderUnmapped && (
                    <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>
                        ⚠️ Extracted builder <strong>"{extractedBuilderName}"</strong> not found in Master DB
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddExtractedBuilder(extractedBuilderName)}
                        disabled={addingBuilder}
                        style={{ fontSize: '0.72rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        <Plus style={{ width: 12, height: 12 }} />
                        {addingBuilder ? 'Adding...' : `Add "${extractedBuilderName}" to Master DB`}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="form-label">Project Description <span style={{ color: '#f87171' }}>*</span></label>
                <textarea
                  className="form-input"
                  rows={5}
                  style={{ minHeight: '110px', lineHeight: 1.5 }}
                  value={formData.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="Enter project overview description..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label className="form-label">Property Type <span style={{ color: '#f87171' }}>*</span></label>
                  <select
                    className="form-select"
                    value={formData.type || 'apartment'}
                    onChange={(e) => handleFieldChange('type', e.target.value)}
                  >
                    {(masters.propertyTypes && masters.propertyTypes.length > 0) ? (
                      masters.propertyTypes.map(pt => (
                        <option key={pt.id} value={pt.code || pt.name.toLowerCase()}>{pt.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="apartment">Apartment</option>
                        <option value="villa">Villa</option>
                        <option value="plot">Plot</option>
                        <option value="penthouse">Penthouse</option>
                        <option value="row house">Row House</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="form-label">Property Source Link <span style={{ color: '#f87171' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.sourceLink || item.source_url || ''}
                    onChange={(e) => handleFieldChange('sourceLink', e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="form-label">Tags</label>
                  <select
                    className="form-select"
                    value={formData.tags || 'Featured Properties'}
                    onChange={(e) => handleFieldChange('tags', e.target.value)}
                  >
                    {(masters.tags && masters.tags.length > 0) ? (
                      masters.tags.map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="Featured Properties">Featured Properties</option>
                        <option value="Hot Offer">Hot Offer</option>
                        <option value="New Launch">New Launch</option>
                        <option value="Under Construction">Under Construction</option>
                        <option value="Ready to Move">Ready to Move</option>
                        <option value="Trending">Trending</option>
                        <option value="Luxury Projects">Luxury Projects</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label className="form-label">Possession Status <span style={{ color: '#f87171' }}>*</span></label>
                  <select
                    className="form-select"
                    value={formData.possessionStatus || 'Under Construction'}
                    onChange={(e) => handleFieldChange('possessionStatus', e.target.value)}
                  >
                    {(masters.possessionStatuses && masters.possessionStatuses.length > 0) ? (
                      masters.possessionStatuses.map(ps => (
                        <option key={ps.id} value={ps.name}>{ps.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="Under Construction">Under Construction</option>
                        <option value="Ready to Move">Ready to Move</option>
                        <option value="New Launch">New Launch</option>
                        <option value="Delivered">Delivered</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="form-label">Possession Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.possessionDate || ''}
                    onChange={(e) => handleFieldChange('possessionDate', e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">RERA Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.rera || ''}
                    onChange={(e) => handleFieldChange('rera', e.target.value)}
                    placeholder="e.g. PRM/KA/RERA/1251/..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: LOCATION DETAILS */}
          {currentStep === 2 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin style={{ width: 18, height: 18, color: '#93c5fd' }} />
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Location Details</h3>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Map scraped address to official Master Database
                </span>
              </div>

              {/* SCRAPED LOCATION SIGNALS & MASTER ALIGNMENT BANNER */}
              {(extractedCityName || extractedLocName) && (
                <div style={{
                  background: (isExtractedCityUnmapped || isExtractedLocationUnmapped) ? 'rgba(234, 88, 12, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                  border: `1px solid ${(isExtractedCityUnmapped || isExtractedLocationUnmapped) ? 'rgba(249, 115, 22, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
                  borderRadius: '8px',
                  padding: '12px 14px',
                  marginBottom: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {(isExtractedCityUnmapped || isExtractedLocationUnmapped) ? (
                        <AlertTriangle style={{ width: 16, height: 16, color: '#fb923c' }} />
                      ) : (
                        <CheckCircle2 style={{ width: 16, height: 16, color: '#34d399' }} />
                      )}
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: (isExtractedCityUnmapped || isExtractedLocationUnmapped) ? '#fdba74' : '#6ee7b7' }}>
                        Scraped Location Signals From Web Page
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {(isExtractedCityUnmapped || isExtractedLocationUnmapped) ? 'Action Required: Add unmapped entities to Master DB' : 'All entities aligned with Master DB'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '4px' }}>
                    {/* Scraped City Card */}
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Scraped City</span>
                        {matchedMasterCity || currentCityObj ? (
                          <span style={{ fontSize: '0.675rem', background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            ✓ Master: {currentCityObj?.name || matchedMasterCity?.name}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.675rem', background: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            ⚠️ Unmapped in Master
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                          {extractedCityName || '<Not Detected>'}
                        </span>
                        {isExtractedCityUnmapped && extractedCityName && (
                          <button
                            type="button"
                            onClick={() => handleAddExtractedCity(extractedCityName)}
                            disabled={addingCity}
                            style={{
                              fontSize: '0.72rem',
                              background: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <Plus style={{ width: 12, height: 12 }} />
                            {addingCity ? 'Adding...' : `Add "${extractedCityName}"`}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Scraped Locality Card */}
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Scraped Locality</span>
                        {matchedMasterLoc || currentLocObj ? (
                          <span style={{ fontSize: '0.675rem', background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            ✓ Master: {currentLocObj?.name || matchedMasterLoc?.name}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.675rem', background: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            ⚠️ Unmapped in Master
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                          {extractedLocName || '<Not Detected>'}
                        </span>
                        {isExtractedLocationUnmapped && extractedLocName && (
                          <button
                            type="button"
                            onClick={() => handleAddExtractedLocation(extractedLocName, resolvedCityId, formData.pincode)}
                            disabled={addingLocation}
                            style={{
                              fontSize: '0.72rem',
                              background: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <Plus style={{ width: 12, height: 12 }} />
                            {addingLocation ? 'Adding...' : `Add "${extractedLocName}"`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 1: City & Location / Locality Form Selectors */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                {/* City Selector */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>
                      City <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {(liveCities || []).length} master cities
                    </span>
                  </div>

                  {extractedCityName && (
                    <div style={{ marginBottom: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>Scraped from website:</span>
                      <strong style={{ color: '#93c5fd' }}>"{extractedCityName}"</strong>
                    </div>
                  )}

                  <div style={{ position: 'relative', marginBottom: '6px' }}>
                    <Search style={{ width: 13, height: 13, position: 'absolute', left: 8, top: 9, color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: '28px', fontSize: '0.75rem', height: '30px' }}
                      placeholder="Search city (e.g. Bengaluru, Mumbai)..."
                      value={citySearch}
                      onChange={(e) => setCitySearch(e.target.value)}
                    />
                  </div>

                  <select
                    className="form-select"
                    value={resolvedCityId}
                    onChange={(e) => handleCityChange(e.target.value)}
                    style={{ fontSize: '0.82rem', fontWeight: 600 }}
                  >
                    <option value="">-- Select Master City --</option>
                    {(liveCities || [])
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                </div>

                {/* Location / Locality Selector */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>
                      Location / Locality <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <span style={{ fontSize: '0.7rem', color: resolvedCityId ? '#93c5fd' : 'var(--text-muted)' }}>
                      {resolvedCityId ? `${cityLocalities.length} localities in city` : 'Select city first'}
                    </span>
                  </div>

                  {extractedLocName && (
                    <div style={{ marginBottom: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>Scraped from website:</span>
                      <strong style={{ color: '#93c5fd' }}>"{extractedLocName}"</strong>
                    </div>
                  )}

                  <div style={{ position: 'relative', marginBottom: '6px' }}>
                    <Search style={{ width: 13, height: 13, position: 'absolute', left: 8, top: 9, color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: '28px', fontSize: '0.75rem', height: '30px' }}
                      placeholder={resolvedCityId ? "Search Location" : "Select a city first to search localities"}
                      value={locationSearch}
                      disabled={!resolvedCityId}
                      onChange={(e) => setLocationSearch(e.target.value)}
                    />
                  </div>

                  <select
                    className="form-select"
                    value={resolvedLocationId}
                    disabled={!resolvedCityId || loadingLocalities}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    style={{ fontSize: '0.82rem', fontWeight: 600 }}
                  >
                    {!resolvedCityId ? (
                      <option value="">-- Please Select or Add a City First --</option>
                    ) : loadingLocalities ? (
                      <option value="">Loading localities for this city...</option>
                    ) : (
                      <>
                        <option value="">Search Location</option>
                        {cityLocalities
                          .filter(l => !locationSearch || l.name.toLowerCase().includes(locationSearch.toLowerCase()))
                          .map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Row 2: Coordinate Input Method, Latitude, Longitude */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Coordinate Input Method</label>
                  <select
                    className="form-select"
                    value={formData.coordinateInputMethod || 'Manual Entry'}
                    onChange={(e) => handleFieldChange('coordinateInputMethod', e.target.value)}
                    style={{ fontSize: '0.82rem' }}
                  >
                    <option value="Manual Entry">Manual Entry</option>
                    <option value="Map Pinpoint">Map Pinpoint</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="form-input"
                    value={formData.latitude || ''}
                    onChange={(e) => handleFieldChange('latitude', e.target.value)}
                    placeholder="Latitude"
                    style={{ fontSize: '0.82rem' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="form-input"
                    value={formData.longitude || ''}
                    onChange={(e) => handleFieldChange('longitude', e.target.value)}
                    placeholder="Longitude"
                    style={{ fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              {/* Row 3: Pincode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    Pincode <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    className="form-input"
                    value={formData.pincode || ''}
                    onChange={(e) => handleFieldChange('pincode', e.target.value)}
                    placeholder="6-digit pincode"
                    style={{ fontSize: '0.82rem' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PROPERTY DETAILS */}
          {currentStep === 3 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                <Layers style={{ width: 18, height: 18, color: '#93c5fd' }} />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Property Details</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label className="form-label">Towers</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.towers || ''}
                    onChange={(e) => handleFieldChange('towers', e.target.value)}
                    placeholder="e.g. 8"
                  />
                </div>

                <div>
                  <label className="form-label">Floors</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.floors || ''}
                    onChange={(e) => handleFieldChange('floors', e.target.value)}
                    placeholder="e.g. B + G + 21 Floors"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label className="form-label">Total Units <span style={{ color: '#f87171' }}>*</span></label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.totalUnits || ''}
                    onChange={(e) => handleFieldChange('totalUnits', e.target.value)}
                    placeholder="e.g. 233"
                  />
                </div>

                <div>
                  <label className="form-label">Land Parcel <span style={{ color: '#f87171' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.landParcel || ''}
                    onChange={(e) => handleFieldChange('landParcel', e.target.value)}
                    placeholder="e.g. 5 Acres"
                  />
                </div>
              </div>

              <div style={{ maxWidth: '300px', marginBottom: '12px' }}>
                <label className="form-label">Transaction Tag <span style={{ color: '#f87171' }}>*</span></label>
                <select
                  className="form-select"
                  value={formData.transactionTag || 'Sale'}
                  onChange={(e) => handleFieldChange('transactionTag', e.target.value)}
                >
                  {(masters.transactionTags && masters.transactionTags.length > 0) ? (
                    masters.transactionTags.map(tt => (
                      <option key={tt.id} value={tt.name}>{tt.name}</option>
                    ))
                  ) : (
                    <>
                      <option value="Sale">Sale</option>
                      <option value="Resale">Resale</option>
                      <option value="Rent">Rent</option>
                      <option value="Lease">Lease</option>
                      <option value="Pre-Launch">Pre-Launch</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          )}

          {/* STEP 4: ADD UNIT CONFIGURATION & PRICING */}
          {currentStep === 4 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign style={{ width: 18, height: 18, color: '#93c5fd' }} />
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Add Unit Configuration</h3>
                </div>
                <button
                  type="button"
                  onClick={handleAddUnit}
                  className="btn btn-primary"
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  <Plus style={{ width: 14, height: 14 }} /> Add Unit
                </button>
              </div>

              {(formData.units || []).length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed var(--glass-border)', borderRadius: 8, color: 'var(--text-muted)' }}>
                  No unit configurations added yet. Click "+ Add Unit" above to add one.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {(formData.units || []).map((unit, i) => (
                    <div
                      key={i}
                      style={{
                        background: 'rgba(0,0,0,0.22)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 8,
                        padding: '14px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#93c5fd' }}>Unit Configuration #{i + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteUnit(i)}
                          style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px' }}
                        >
                          <Trash2 style={{ width: 14, height: 14 }} />
                        </button>
                      </div>

                      {/* Row 1: Unit Type, Area Status, Area Visibility, Min Area, Max Area */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label className="form-label">Unit Type <span style={{ color: '#f87171' }}>*</span></label>
                          <select
                            className="form-select"
                            value={unit.type || '2BHK'}
                            onChange={(e) => handleUnitChange(i, 'type', e.target.value)}
                          >
                            {(masters.unitTypes && masters.unitTypes.length > 0) ? (
                              masters.unitTypes.map(ut => (
                                <option key={ut.id} value={ut.code}>{ut.name}</option>
                              ))
                            ) : (
                              <>
                                <option value="1BHK">1 BHK</option>
                                <option value="2BHK">2 BHK</option>
                                <option value="3BHK">3 BHK</option>
                                <option value="4BHK">4 BHK</option>
                                <option value="5BHK">5 BHK</option>
                                <option value="Studio">Studio</option>
                                <option value="Penthouse">Penthouse</option>
                                <option value="Villa">Villa</option>
                                <option value="Plot">Plot</option>
                              </>
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="form-label">Area Status <span style={{ color: '#f87171' }}>*</span></label>
                          <select
                            className="form-select"
                            value={unit.areaStatus || 'Available'}
                            onChange={(e) => handleUnitChange(i, 'areaStatus', e.target.value)}
                          >
                            <option value="Available">Available</option>
                            <option value="Sold Out">Sold Out</option>
                          </select>
                        </div>

                        <div>
                          <label className="form-label">Area Visibility <span style={{ color: '#f87171' }}>*</span></label>
                          <select
                            className="form-select"
                            value={unit.areaVisibility || 'Public'}
                            onChange={(e) => handleUnitChange(i, 'areaVisibility', e.target.value)}
                          >
                            <option value="Public">Public</option>
                            <option value="Private">Private</option>
                          </select>
                        </div>

                        <div>
                          <label className="form-label">Min Area (sq.ft) <span style={{ color: '#f87171' }}>*</span></label>
                          <input
                            type="number"
                            className="form-input"
                            value={unit.minArea || unit.interiorArea || ''}
                            onChange={(e) => handleUnitChange(i, 'minArea', Number(e.target.value))}
                            placeholder="e.g. 800"
                          />
                        </div>

                        <div>
                          <label className="form-label">Max Area (sq.ft) <span style={{ color: '#f87171' }}>*</span></label>
                          <input
                            type="number"
                            className="form-input"
                            value={unit.maxArea || ''}
                            onChange={(e) => handleUnitChange(i, 'maxArea', Number(e.target.value))}
                            placeholder="e.g. 1200"
                          />
                        </div>
                      </div>

                      {/* Row 2: Price Status, Price Visibility, Currency, Min Price, Max Price */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                        <div>
                          <label className="form-label">Price Status <span style={{ color: '#f87171' }}>*</span></label>
                          <select
                            className="form-select"
                            value={unit.priceStatus || 'Available'}
                            onChange={(e) => handleUnitChange(i, 'priceStatus', e.target.value)}
                          >
                            <option value="Available">Available</option>
                            <option value="Price on Request">Price on Request</option>
                          </select>
                        </div>

                        <div>
                          <label className="form-label">Price Visibility <span style={{ color: '#f87171' }}>*</span></label>
                          <select
                            className="form-select"
                            value={unit.priceVisibility || 'Public'}
                            onChange={(e) => handleUnitChange(i, 'priceVisibility', e.target.value)}
                          >
                            <option value="Public">Public</option>
                            <option value="Private">Private</option>
                          </select>
                        </div>

                        <div>
                          <label className="form-label">Price Currency <span style={{ color: '#f87171' }}>*</span></label>
                          <select
                            className="form-select"
                            value={unit.currency || 'INR'}
                            onChange={(e) => handleUnitChange(i, 'currency', e.target.value)}
                          >
                            <option value="INR">INR (₹)</option>
                            <option value="USD">USD ($)</option>
                          </select>
                        </div>

                        <div>
                          <label className="form-label">Min. Price (₹) <span style={{ color: '#f87171' }}>*</span></label>
                          <input
                            type="number"
                            className="form-input"
                            value={unit.minPrice || ''}
                            onChange={(e) => handleUnitChange(i, 'minPrice', Number(e.target.value))}
                            placeholder="Min amount"
                          />
                        </div>

                        <div>
                          <label className="form-label">Max. Price (₹) <span style={{ color: '#f87171' }}>*</span></label>
                          <input
                            type="number"
                            className="form-input"
                            value={unit.maxPrice || ''}
                            onChange={(e) => handleUnitChange(i, 'maxPrice', Number(e.target.value))}
                            placeholder="Max amount"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 5: AMENITIES CHECKBOX GRID & SEARCH */}
          {currentStep === 5 && (() => {
            const masterAmenityNames = new Set(allKnownAmenities.map(a => a.name.toLowerCase()));
            const masterAmenityKeys = new Set(allKnownAmenities.map(a => cleanAmenityKey(a.name)));

            const unmappedAmenities = (formData.amenities || [])
              .map(name => resolveCanonicalAmenityName(name, allKnownAmenities))
              .filter(name => typeof name === 'string' && !masterAmenityNames.has(name.toLowerCase()) && !masterAmenityKeys.has(cleanAmenityKey(name)));

            return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 style={{ width: 18, height: 18, color: '#93c5fd' }} />
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Amenities Master Selection</h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '0.725rem',
                      fontWeight: 600,
                      color: '#60a5fa',
                      background: 'rgba(37, 99, 235, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.35)',
                      borderRadius: 12,
                      padding: '2px 8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }}></span>
                      Dynamic Master DB ({allKnownAmenities.length} amenities)
                    </span>
                    {loadingAmenities && (
                      <span style={{ fontSize: '0.7rem', color: '#fbbf24', fontStyle: 'italic' }}>
                        Fetching...
                      </span>
                    )}
                  </div>
                </div>

                {/* Unmapped Discovered Amenities Banner */}
                {unmappedAmenities.length > 0 && (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.45)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    marginBottom: '14px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <AlertTriangle style={{ width: 16, height: 16, color: '#fbbf24' }} />
                      <strong style={{ fontSize: '0.8rem', color: '#fbbf24' }}>
                        {unmappedAmenities.length} Discovered Amenit{unmappedAmenities.length > 1 ? 'ies' : 'y'} Not in Master Database
                      </strong>
                    </div>
                    <p style={{ margin: '0 0 10px 0', fontSize: '0.725rem', color: '#fef3c7', lineHeight: 1.4 }}>
                      The scraper found new amenities on this property page. Click below to register them directly into your official Master DB:
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {unmappedAmenities.map((name, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(0,0,0,0.35)',
                            border: '1px solid rgba(245, 158, 11, 0.5)',
                            borderRadius: 6,
                            padding: '4px 10px'
                          }}
                        >
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fef08a' }}>{name}</span>
                          <button
                            type="button"
                            onClick={() => handleAddDiscoveredAmenity(name)}
                            disabled={addingAmenityName === name}
                            className="btn btn-primary"
                            style={{
                              padding: '2px 8px',
                              fontSize: '0.7rem',
                              background: '#d97706',
                              borderColor: '#b45309',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Plus style={{ width: 11, height: 11 }} />
                            {addingAmenityName === name ? 'Adding...' : 'Add to Master DB'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Amenities Chips */}
                <div style={{ minHeight: '44px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '8px 12px', marginBottom: '14px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                  {(formData.amenities || []).length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No amenities selected yet. Check items below.</span>
                  ) : (
                    (formData.amenities || []).map((am, i) => {
                      const isInMaster = masterAmenityNames.has(typeof am === 'string' ? am.toLowerCase() : '');
                      return (
                        <span
                          key={i}
                          style={{
                            fontSize: '0.725rem',
                            fontWeight: 600,
                            background: isInMaster ? 'rgba(59, 130, 246, 0.25)' : 'rgba(245, 158, 11, 0.25)',
                            color: isInMaster ? '#93c5fd' : '#fde047',
                            border: `1px solid ${isInMaster ? '#3b82f6' : '#eab308'}`,
                            padding: '2px 8px',
                            borderRadius: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {am} {!isInMaster && <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>(New)</span>}
                          <button
                            type="button"
                            onClick={() => removeAmenityChip(am)}
                            style={{ background: 'none', border: 'none', color: isInMaster ? '#93c5fd' : '#fde047', cursor: 'pointer', padding: 0, display: 'flex' }}
                          >
                            <XCircle style={{ width: 12, height: 12 }} />
                          </button>
                        </span>
                      );
                    })
                  )}
                </div>

                {/* Search & Custom Amenity Creator */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search style={{ width: 14, height: 14, position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: '32px', fontSize: '0.775rem' }}
                      placeholder="Search master amenities from database (e.g. Swimming Pool, Gym)..."
                      value={amenitySearch}
                      onChange={(e) => setAmenitySearch(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.775rem' }}
                      placeholder="Add new custom amenity to Master DB..."
                      value={customAmenityInput}
                      onChange={(e) => setCustomAmenityInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomAmenity(); } }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomAmenity}
                      disabled={!customAmenityInput.trim() || addingAmenityName === customAmenityInput.trim()}
                      className="btn btn-primary"
                      style={{ fontSize: '0.725rem', whiteSpace: 'nowrap', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus style={{ width: 13, height: 13 }} /> Add
                    </button>
                  </div>
                </div>

                {/* Amenities Multi-Column Checkbox Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', maxHeight: '380px', overflowY: 'auto' }}>
                  {filteredMasterAmenities.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.775rem', border: '1px dashed var(--glass-border)', borderRadius: 6 }}>
                      {loadingAmenities ? 'Loading amenities from Master Database...' : 'No matching master amenities found. Type above to add a new amenity to Master DB.'}
                    </div>
                  ) : (
                    filteredMasterAmenities.map((am) => {
                      const isChecked = (formData.amenities || []).some(a => a.toLowerCase() === am.name.toLowerCase());
                      return (
                        <div
                          key={am.id || am.name}
                          onClick={() => toggleAmenity(am.name)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 6,
                            border: '1px solid',
                            background: isChecked ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                            borderColor: isChecked ? '#3b82f6' : 'var(--glass-border)',
                            color: isChecked ? '#ffffff' : 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.75rem',
                            fontWeight: isChecked ? 600 : 400,
                            transition: 'all 0.15s'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Handled by div onClick
                            style={{ cursor: 'pointer', accentColor: '#3b82f6' }}
                          />
                          <span>{am.name}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}

          {/* STEP 6: OTHER DETAILS (Advantages / Key Features & FAQs) */}
          {currentStep === 6 && (
            <div>
              {/* SECTION 1: ADVANTAGES / KEY FEATURES */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>Advantages / Key Features</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Highlight at least 5 unique selling points of this property
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAdvantage}
                    className="btn btn-primary"
                    style={{ padding: '6px 14px', fontSize: '0.775rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, borderRadius: 6 }}
                  >
                    <Plus style={{ width: 15, height: 15 }} /> Add Advantage
                  </button>
                </div>

                {(!formData.advantages || formData.advantages.length === 0) ? (
                  <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed var(--glass-border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No advantages added yet. Click <strong>"+ Add Advantage"</strong> to highlight unique selling points (e.g., proximity to metro, luxury clubhouse, high rental yield).
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {formData.advantages.map((adv, i) => (
                      <div
                        key={i}
                        style={{
                          background: 'rgba(0,0,0,0.22)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: 8,
                          padding: '14px',
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteAdvantage(i)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.08)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              color: '#ef4444',
                              borderRadius: 6,
                              padding: '3px 10px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <Trash2 style={{ width: 12, height: 12 }} /> Remove
                          </button>
                        </div>

                        <div style={{ marginBottom: '10px' }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                            Title {i + 1}
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            style={{ fontSize: '0.8rem', fontWeight: 500 }}
                            placeholder="e.g. Prime Location & Connectivity"
                            value={adv.title || ''}
                            onChange={(e) => handleAdvantageChange(i, 'title', e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                            Description
                          </label>
                          <textarea
                            className="form-input"
                            rows={2}
                            style={{ fontSize: '0.775rem', resize: 'vertical' }}
                            placeholder="Detailed advantage description..."
                            value={adv.description || ''}
                            onChange={(e) => handleAdvantageChange(i, 'description', e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION 2: FREQUENTLY ASKED QUESTIONS (FAQs) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HelpCircle style={{ width: 18, height: 18, color: '#93c5fd' }} />
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Frequently Asked Questions (FAQs)</h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddFaq}
                    className="btn btn-primary"
                    style={{ padding: '5px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus style={{ width: 14, height: 14 }} /> Add FAQ
                  </button>
                </div>

                {(!formData.faqs || formData.faqs.length === 0) ? (
                  <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed var(--glass-border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No FAQs added for this property. Click "+ Add FAQ" above to add custom questions & answers.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {formData.faqs.map((faq, i) => (
                      <div
                        key={i}
                        style={{
                          background: 'rgba(0,0,0,0.22)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: 8,
                          padding: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#93c5fd' }}>FAQ #{i + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteFaq(i)}
                            style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px' }}
                          >
                            <Trash2 style={{ width: 13, height: 13 }} />
                          </button>
                        </div>
                        <div style={{ marginBottom: '6px' }}>
                          <input
                            type="text"
                            className="form-input"
                            style={{ fontSize: '0.775rem', fontWeight: 600 }}
                            placeholder="Question..."
                            value={faq.question || ''}
                            onChange={(e) => handleFaqChange(i, 'question', e.target.value)}
                          />
                        </div>
                        <div>
                          <textarea
                            className="form-input"
                            rows={2}
                            style={{ fontSize: '0.75rem', resize: 'vertical' }}
                            placeholder="Answer..."
                            value={faq.answer || ''}
                            onChange={(e) => handleFaqChange(i, 'answer', e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 7: UPLOAD FILES & ORGANIZED MEDIA SECTION */}
          {currentStep === 7 && (
            <div>
              {/* TOP INFO BANNER */}
              <div style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.28)',
                borderRadius: 8,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
                color: '#7dd3fc',
                fontSize: '0.8rem',
                lineHeight: 1.4
              }}>
                <Info style={{ width: 18, height: 18, color: '#38bdf8', flexShrink: 0 }} />
                <span>
                  Media uploads are held against your account and attach to the property when you save this form. Unsaved uploads are discarded after 24 hours.
                </span>
              </div>

              {/* 2x2 ORGANIZED MEDIA GRID */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                {/* 1. LOGO */}
                <div style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 10,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 2px 0', color: '#f8fafc' }}>
                    Logo
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                    300×300 px — Max 1 image
                  </p>

                  {formData.logo ? (
                    <div style={{ position: 'relative', width: 'fit-content', marginBottom: '10px' }}>
                      <img
                        src={formData.logo}
                        alt="Project Logo"
                        style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.4)', padding: '4px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, logo: null }))}
                        style={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          background: '#ef4444',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0
                        }}
                        title="Remove Logo"
                      >
                        <Trash2 style={{ width: 11, height: 11 }} />
                      </button>
                    </div>
                  ) : null}

                  <div style={{
                    border: '1px solid var(--glass-border)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    background: 'rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '8px'
                  }}>
                    <label style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      color: '#f8fafc',
                      whiteSpace: 'nowrap'
                    }}>
                      Choose File
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleLogoUpload(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {formData.logo ? 'Logo selected' : 'No file chosen'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.725rem', padding: '4px 8px' }}
                      placeholder="Or paste Logo Image URL..."
                      value={newLogoUrlInput}
                      onChange={(e) => setNewLogoUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newLogoUrlInput.trim()) {
                          e.preventDefault();
                          setFormData(prev => ({ ...prev, logo: newLogoUrlInput.trim() }));
                          setNewLogoUrlInput('');
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newLogoUrlInput.trim()) {
                          setFormData(prev => ({ ...prev, logo: newLogoUrlInput.trim() }));
                          setNewLogoUrlInput('');
                        }
                      }}
                      disabled={!newLogoUrlInput.trim()}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.725rem', padding: '4px 8px', whiteSpace: 'nowrap' }}
                    >
                      Set URL
                    </button>
                  </div>
                </div>

                {/* 2. THUMBNAIL IMAGE */}
                <div style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 10,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 2px 0', color: '#f8fafc' }}>
                    Thumbnail Image
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                    1014×760 px — Max 1 image
                  </p>

                  {formData.thumbnail ? (
                    <div style={{ position: 'relative', width: 'fit-content', marginBottom: '10px' }}>
                      <img
                        src={formData.thumbnail}
                        alt="Project Thumbnail"
                        style={{ width: '140px', height: '80px', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.4)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, thumbnail: null }))}
                        style={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          background: '#ef4444',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0
                        }}
                        title="Remove Thumbnail"
                      >
                        <Trash2 style={{ width: 11, height: 11 }} />
                      </button>
                    </div>
                  ) : null}

                  <div style={{
                    border: '1px solid var(--glass-border)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    background: 'rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '8px'
                  }}>
                    <label style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      color: '#f8fafc',
                      whiteSpace: 'nowrap'
                    }}>
                      Choose File
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleThumbnailUpload(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {formData.thumbnail ? 'Thumbnail image selected' : 'No file chosen'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.725rem', padding: '4px 8px' }}
                      placeholder="Or paste Thumbnail Image URL..."
                      value={newThumbnailUrlInput}
                      onChange={(e) => setNewThumbnailUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newThumbnailUrlInput.trim()) {
                          e.preventDefault();
                          setFormData(prev => ({ ...prev, thumbnail: newThumbnailUrlInput.trim() }));
                          setNewThumbnailUrlInput('');
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newThumbnailUrlInput.trim()) {
                          setFormData(prev => ({ ...prev, thumbnail: newThumbnailUrlInput.trim() }));
                          setNewThumbnailUrlInput('');
                        }
                      }}
                      disabled={!newThumbnailUrlInput.trim()}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.725rem', padding: '4px 8px', whiteSpace: 'nowrap' }}
                    >
                      Set URL
                    </button>
                  </div>
                </div>

                {/* 3. OTHER IMAGES */}
                <div style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 10,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                      Other Images
                    </h4>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontWeight: 600,
                      background: (formData.images || []).length >= 5 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: (formData.images || []).length >= 5 ? '#86efac' : '#fde047',
                      border: `1px solid ${(formData.images || []).length >= 5 ? '#22c55e' : '#eab308'}`
                    }}>
                      {(formData.images || []).length} images {(formData.images || []).length >= 5 ? '✓' : '(Min 5)'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                    1014×760 px — Min 5 images
                  </p>

                  <div style={{
                    border: '1px solid var(--glass-border)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    background: 'rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '8px'
                  }}>
                    <label style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      color: '#f8fafc',
                      whiteSpace: 'nowrap'
                    }}>
                      Choose Files
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleOtherImagesUpload(e.target.files);
                          }
                        }}
                      />
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {(formData.images || []).length > 0 ? `${(formData.images || []).length} files attached` : 'No file chosen'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.725rem', padding: '4px 8px' }}
                      placeholder="Add Image URL to gallery..."
                      value={newImageUrlInput}
                      onChange={(e) => setNewImageUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddOtherImageUrl();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddOtherImageUrl}
                      disabled={!newImageUrlInput.trim()}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.725rem', padding: '4px 8px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus style={{ width: 12, height: 12 }} /> Add
                    </button>
                  </div>

                  {/* Other Images Mini Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    padding: '4px',
                    background: 'rgba(0,0,0,0.15)',
                    borderRadius: 6,
                    border: '1px solid var(--glass-border)'
                  }}>
                    {(!formData.images || formData.images.length === 0) ? (
                      <div style={{ gridColumn: '1 / -1', padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.725rem' }}>
                        No gallery images attached yet. Scraped images will appear here, or you can choose files above.
                      </div>
                    ) : (
                      formData.images.map((img, i) => (
                        <div
                          key={i}
                          style={{
                            position: 'relative',
                            borderRadius: 6,
                            overflow: 'hidden',
                            border: '1px solid var(--glass-border)',
                            background: '#000000',
                            height: '75px'
                          }}
                        >
                          <img
                            src={typeof img === 'string' ? img : img.url}
                            alt={img.alt || `Image ${i + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveOtherImage(i)}
                            style={{
                              position: 'absolute',
                              top: 3,
                              right: 3,
                              background: 'rgba(239, 68, 68, 0.85)',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '50%',
                              width: '18px',
                              height: '18px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              padding: 0
                            }}
                            title="Remove image"
                          >
                            <Trash2 style={{ width: 10, height: 10 }} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 4. VIDEOS */}
                <div style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 10,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 10px 0', color: '#f8fafc' }}>
                    Videos
                  </h4>

                  {/* Video Type & Alt Text Input Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ position: 'relative' }}>
                      <label style={{
                        position: 'absolute',
                        top: -7,
                        left: 8,
                        background: '#131a2a',
                        padding: '0 4px',
                        fontSize: '0.65rem',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        zIndex: 2
                      }}>
                        Video type
                      </label>
                      <select
                        className="form-select"
                        style={{ fontSize: '0.775rem', height: '34px', paddingTop: '2px' }}
                        value={videoType}
                        onChange={(e) => setVideoType(e.target.value)}
                      >
                        <option value="Walkthrough">Walkthrough</option>
                        <option value="Drone Shot">Drone Shot</option>
                        <option value="Promotional">Promotional</option>
                        <option value="360 Virtual Tour">360 Virtual Tour</option>
                        <option value="Site Progress">Site Progress</option>
                      </select>
                    </div>

                    <div>
                      <input
                        type="text"
                        className="form-input"
                        style={{ fontSize: '0.775rem', height: '34px' }}
                        placeholder="Alt text (optional)"
                        value={videoAlt}
                        onChange={(e) => setVideoAlt(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Dropzone Container */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleVideoFileUpload(e.dataTransfer.files[0]);
                      }
                    }}
                    style={{
                      border: '1px dashed rgba(255,255,255,0.22)',
                      borderRadius: 8,
                      padding: '16px 12px',
                      textAlign: 'center',
                      background: 'rgba(0,0,0,0.18)',
                      marginBottom: '10px',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s'
                    }}
                    onClick={() => {
                      const fileInput = document.getElementById('video-file-upload-input');
                      if (fileInput) fileInput.click();
                    }}
                  >
                    <input
                      id="video-file-upload-input"
                      type="file"
                      accept="video/mp4,video/webm,video/ogg,video/quicktime"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleVideoFileUpload(e.target.files[0]);
                        }
                      }}
                    />
                    <UploadCloud style={{ width: 28, height: 28, color: 'var(--text-muted)', margin: '0 auto 6px auto', display: 'block' }} />
                    <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc' }}>
                      Drop a video here or click to browse
                    </p>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      MP4, WebM or MOV · up to 200 MB
                    </span>
                  </div>

                  {/* Or Video URL & Action Button */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.725rem', padding: '4px 8px' }}
                      placeholder="Or paste video link (YouTube, Vimeo, MP4)..."
                      value={videoUrlInput}
                      onChange={(e) => setVideoUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddVideo();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddVideo()}
                      disabled={!videoUrlInput.trim()}
                      className="btn btn-secondary"
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '4px 12px',
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase'
                      }}
                    >
                      Upload Video
                    </button>
                  </div>

                  {/* Uploaded Videos List */}
                  {(formData.videos || []).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                      {formData.videos.map((vid, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 6,
                            padding: '6px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.725rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <Film style={{ width: 14, height: 14, color: '#60a5fa', flexShrink: 0 }} />
                            <span style={{
                              background: 'rgba(59, 130, 246, 0.2)',
                              color: '#93c5fd',
                              border: '1px solid rgba(59, 130, 246, 0.4)',
                              borderRadius: 4,
                              padding: '1px 5px',
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              flexShrink: 0
                            }}>
                              {vid.videoType || 'Walkthrough'}
                            </span>
                            <span style={{ color: '#f8fafc', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {vid.title || vid.alt || 'Video'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveVideo(idx)}
                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px', display: 'flex' }}
                            title="Remove Video"
                          >
                            <Trash2 style={{ width: 12, height: 12 }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>

        {/* STICKY BOTTOM ACTION FOOTER BAR */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '10px 16px',
          background: 'rgba(11, 15, 25, 0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid var(--glass-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 20
        }}>
          {/* Step Back / Next */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={currentStep === 1}
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
              style={{ fontSize: '0.75rem', padding: '6px 12px' }}
            >
              <ChevronLeft style={{ width: 14, height: 14 }} /> Previous
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={currentStep === STEPS.length}
              onClick={() => setCurrentStep(prev => Math.min(STEPS.length, prev + 1))}
              style={{ fontSize: '0.75rem', padding: '6px 12px' }}
            >
              Next <ChevronRight style={{ width: 14, height: 14 }} />
            </button>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={handleSave} style={{ fontSize: '0.775rem', padding: '6px 12px' }}>
              <Save style={{ width: 14, height: 14 }} /> Save Draft
            </button>

            <button className="btn btn-danger" onClick={() => setShowRejectModal(true)} style={{ fontSize: '0.775rem', padding: '6px 12px' }}>
              <XCircle style={{ width: 14, height: 14 }} /> Reject
            </button>

            <button className="btn btn-success" onClick={() => onApprove(item.id)} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              <Send style={{ width: 15, height: 15 }} /> Approve & Push to DB
            </button>
          </div>
        </div>
      </div>

      {/* Reject Reason Modal */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#f87171' }}>Reject Staged Property</h3>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Enter rejection reason..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{ marginBottom: '14px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { onReject(item.id, rejectReason); setShowRejectModal(false); }}>
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
