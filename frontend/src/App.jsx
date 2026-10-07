import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import QueueSidebar from './components/QueueSidebar';
import SplitScreenReviewer from './components/SplitScreenReviewer';
import PipelineRunnerModal from './components/PipelineRunnerModal';
import {
  API_BASE,
  createMasterAmenity as createMasterAmenityApi,
  createMasterCity as createMasterCityApi,
  createMasterLocation as createMasterLocationApi,
  createMasterBuilder as createMasterBuilderApi
} from './config/api';

export default function App() {
  const [items, setItems] = useState([]);
  const [masters, setMasters] = useState({ builders: [], cities: [], zones: [], locations: [], amenities: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState('pending'); // pending | update | approved | rejected
  const [backendStatus, setBackendStatus] = useState('connecting');
  const [isPipelineOpen, setIsPipelineOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/staging`);
      const data = await res.json();
      if (data.success) {
        setItems(data.data || []);
        setBackendStatus('connected');
        if (!selectedId && data.data.length > 0) {
          setSelectedId(data.data[0].id);
        }
      }

      const mRes = await fetch(`${API_BASE}/masters`);
      const mData = await mRes.json();
      if (mData.success) {
        setMasters(mData.data);
      }
    } catch (err) {
      console.error('Failed to connect to backend:', err);
      setBackendStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunPipeline = async (url, provider = 'auto') => {
    const res = await fetch(`${API_BASE}/pipeline/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, provider })
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to run pipeline');
    }
    await fetchData();
    setSelectedId(data.data.id);
    return data;
  };

  const handleCrawlWebsite = async (crawlOptions) => {
    const res = await fetch(`${API_BASE}/pipeline/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(crawlOptions)
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to crawl website');
    }
    await fetchData();
    if (data.data?.results?.[0]?.id) {
      setSelectedId(data.data.results[0].id);
    }
    return data;
  };

  const handleApprove = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/staging/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('✅ Project approved and pushed to production queue!');
        await fetchData();
      } else {
        alert(`❌ Push failed: ${data.error}`);
      }
    } catch (err) {
      alert(`Error approving item: ${err.message}`);
    }
  };

  const handleReject = async (id, reason) => {
    try {
      const res = await fetch(`${API_BASE}/staging/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      }
    } catch (err) {
      alert(`Error rejecting item: ${err.message}`);
    }
  };

  const handleApplyUpdate = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/staging/${id}/apply-update`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('🔄 Updates applied to production project!');
        await fetchData();
      }
    } catch (err) {
      alert(`Error applying updates: ${err.message}`);
    }
  };

  const handleSaveDraft = async (id, payload) => {
    try {
      const res = await fetch(`${API_BASE}/staging/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert('💾 Draft saved successfully!');
        await fetchData();
      }
    } catch (err) {
      alert(`Error saving draft: ${err.message}`);
    }
  };

  const selectedItem = items.find(i => i.id === selectedId) || null;

  const counts = {
    pending: items.filter(i => i.status === 'pending_review').length,
    update: items.filter(i => i.status === 'update_pending').length,
    approved: items.filter(i => i.status === 'approved').length,
    rejected: items.filter(i => i.status === 'rejected').length
  };

  const handleClearQueue = async () => {
    if (!confirm('Are you sure you want to clear all items in the staging queue?')) return;
    try {
      const res = await fetch(`${API_BASE}/staging/clear`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSelectedId(null);
        await fetchData();
      }
    } catch (err) {
      alert(`Error clearing queue: ${err.message}`);
    }
  };

  const handleCreateMasterAmenity = async (name) => {
    try {
      const data = await createMasterAmenityApi(name);
      if (data.success && data.amenity) {
        setMasters(prev => ({
          ...prev,
          amenities: [...(prev.amenities || []).filter(a => a.id !== data.amenity.id), data.amenity]
        }));
        return data.amenity;
      } else {
        throw new Error(data.error || 'Failed to add amenity to Master DB');
      }
    } catch (err) {
      alert(`Error adding amenity to Master DB: ${err.message}`);
      throw err;
    }
  };

  const handleCreateMasterCity = async (name, state = '') => {
    try {
      const data = await createMasterCityApi(name, state);
      if (data.success && data.city) {
        setMasters(prev => ({
          ...prev,
          cities: [...(prev.cities || []).filter(c => c.id !== data.city.id), data.city]
        }));
        return data.city;
      } else {
        throw new Error(data.error || 'Failed to add city to Master DB');
      }
    } catch (err) {
      alert(`Error adding city to Master DB: ${err.message}`);
      throw err;
    }
  };

  const handleCreateMasterLocation = async (name, cityId = null, pincode = '') => {
    try {
      const data = await createMasterLocationApi(name, cityId, pincode);
      if (data.success && data.location) {
        setMasters(prev => ({
          ...prev,
          locations: [...(prev.locations || []).filter(l => l.id !== data.location.id), data.location]
        }));
        return data.location;
      } else {
        throw new Error(data.error || 'Failed to add location to Master DB');
      }
    } catch (err) {
      alert(`Error adding location to Master DB: ${err.message}`);
      throw err;
    }
  };

  const handleCreateMasterBuilder = async (name, description = '') => {
    try {
      const data = await createMasterBuilderApi(name, description);
      if (data.success && data.builder) {
        setMasters(prev => ({
          ...prev,
          builders: [...(prev.builders || []).filter(b => b.id !== data.builder.id), data.builder]
        }));
        return data.builder;
      } else {
        throw new Error(data.error || 'Failed to add builder to Master DB');
      }
    } catch (err) {
      alert(`Error adding builder to Master DB: ${err.message}`);
      throw err;
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', color: 'var(--text-main)', overflow: 'hidden' }}>
      {/* Top Navbar */}
      <Navbar
        onOpenPipeline={() => setIsPipelineOpen(true)}
        onRefresh={fetchData}
        onClearQueue={handleClearQueue}
        backendStatus={backendStatus}
        totalItems={items.length}
      />

      {/* Main Review Workspace with Left Sidebar & Split Reviewer */}
      <main style={{ flex: 1, display: 'flex', gap: '12px', padding: '12px', overflow: 'hidden' }}>
        <QueueSidebar
          items={items}
          selectedId={selectedId}
          onSelectItem={setSelectedId}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          counts={counts}
        />

        <SplitScreenReviewer
          item={selectedItem}
          masters={masters}
          onApprove={handleApprove}
          onReject={handleReject}
          onSaveDraft={handleSaveDraft}
          onApplyUpdate={handleApplyUpdate}
          onCreateMasterAmenity={handleCreateMasterAmenity}
          onCreateMasterCity={handleCreateMasterCity}
          onCreateMasterLocation={handleCreateMasterLocation}
          onCreateMasterBuilder={handleCreateMasterBuilder}
        />
      </main>

      {/* Pipeline Trigger Modal with Single & Full Website Crawler Modes */}
      <PipelineRunnerModal
        isOpen={isPipelineOpen}
        onClose={() => setIsPipelineOpen(false)}
        onRunPipeline={handleRunPipeline}
        onCrawlWebsite={handleCrawlWebsite}
      />
    </div>
  );
}
