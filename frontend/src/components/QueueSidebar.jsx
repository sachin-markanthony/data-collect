import React, { useState } from 'react';
import { Search, Clock, RefreshCw, CheckCircle2, XCircle, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function QueueSidebar({
  items,
  selectedId,
  onSelectItem,
  activeTab,
  onTabChange,
  counts
}) {
  const [search, setSearch] = useState('');

  const filteredItems = items.filter(item => {
    // Filter by tab
    let matchesTab = true;
    if (activeTab === 'pending') matchesTab = item.status === 'pending_review';
    else if (activeTab === 'update') matchesTab = item.status === 'update_pending';
    else if (activeTab === 'approved') matchesTab = item.status === 'approved';
    else if (activeTab === 'rejected') matchesTab = item.status === 'rejected';

    // Filter by search
    const matchesSearch = !search ||
      (item.extracted_data.name && item.extracted_data.name.toLowerCase().includes(search.toLowerCase())) ||
      (item.source_domain && item.source_domain.toLowerCase().includes(search.toLowerCase()));

    return matchesTab && matchesSearch;
  });

  return (
    <div className="glass-panel" style={{ width: '310px', height: '100%', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
      {/* Queue Header & Tabs */}
      <div style={{ padding: '14px', borderBottom: '1px solid var(--glass-border)' }}>
        <h3 style={{ fontSize: '0.95rem', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Property Review Queue</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{filteredItems.length} items</span>
        </h3>

        {/* Tab Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '10px' }}>
          {[
            { id: 'pending', label: 'Pending', count: counts.pending },
            { id: 'update', label: 'Updates', count: counts.update },
            { id: 'approved', label: 'Approved', count: counts.approved },
            { id: 'rejected', label: 'Rejected', count: counts.rejected }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                padding: '5px 2px',
                borderRadius: 6,
                fontSize: '0.7rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                textAlign: 'center',
                background: activeTab === tab.id ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)',
                color: activeTab === tab.id ? '#ffffff' : 'var(--text-muted)',
                transition: 'all 0.2s'
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative' }}>
          <Search style={{ width: 14, height: 14, position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '30px', fontSize: '0.775rem' }}
            placeholder="Search property or domain..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Property Cards List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            No properties in this view
          </div>
        ) : (
          filteredItems.map(item => {
            const isSelected = item.id === selectedId;
            const scorePct = Math.round((item.confidence_score || 0.5) * 100);
            const warningCount = (item.validation_warnings || []).length;

            return (
              <div
                key={item.id}
                className={`queue-card ${isSelected ? 'active' : ''}`}
                onClick={() => onSelectItem(item.id)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0, color: isSelected ? '#93c5fd' : 'var(--text-main)', lineHeight: '1.2' }}>
                    {item.extracted_data.name || 'Unnamed Property'}
                  </h4>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: scorePct >= 85 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                    color: scorePct >= 85 ? '#34d399' : '#fbbf24',
                    flexShrink: 0
                  }}>
                    {scorePct}%
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                  <span style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 4, color: '#93c5fd' }}>
                    🌐 {item.source_domain}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {warningCount > 0 && (
                      <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '2px' }} title={`${warningCount} warning(s)`}>
                        <AlertTriangle style={{ width: 12, height: 12 }} /> {warningCount}
                      </span>
                    )}

                    <span className={`badge badge-${item.status === 'update_pending' ? 'update' : (item.status === 'pending_review' ? 'pending' : item.status)}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                      {item.status === 'pending_review' ? 'Pending' : (item.status === 'update_pending' ? 'Update' : item.status)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
