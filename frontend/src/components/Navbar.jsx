import React from 'react';
import { Layers, Play, Server, RefreshCw, CheckCircle2, Trash2 } from 'lucide-react';

export default function Navbar({ onOpenPipeline, onRefresh, onClearQueue, backendStatus, totalItems }) {
  return (
    <header className="glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)' }}>
          <Layers style={{ color: '#fff', width: 22, height: 22 }} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, background: 'linear-gradient(90deg, #ffffff, #93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
            JustFlip Data Review Hub
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
            Automated Extraction & Human Quality Gatekeeper
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Service Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', padding: '6px 12px', borderRadius: 20, border: '1px solid var(--glass-border)', fontSize: '0.75rem' }}>
          <Server style={{ width: 14, height: 14, color: backendStatus === 'connected' ? '#10b981' : '#ef4444' }} />
          <span style={{ color: 'var(--text-muted)' }}>Backend Port 4000:</span>
          <span style={{ fontWeight: 600, color: backendStatus === 'connected' ? '#34d399' : '#f87171' }}>
            {backendStatus === 'connected' ? 'Active & Live' : 'Disconnected'}
          </span>
        </div>

        {/* Refresh button */}
        <button className="btn btn-secondary" onClick={onRefresh} title="Refresh Staging Queue">
          <RefreshCw style={{ width: 16, height: 16 }} />
        </button>

        {/* Clear Queue button */}
        {onClearQueue && (
          <button className="btn btn-secondary" onClick={onClearQueue} title="Clear All Queue Items" style={{ color: '#f87171' }}>
            <Trash2 style={{ width: 16, height: 16 }} />
          </button>
        )}

        {/* Run Automation Pipeline Trigger */}
        <button className="btn btn-primary" onClick={onOpenPipeline}>
          <Play style={{ width: 16, height: 16, fill: 'currentColor' }} />
          Run Scrape Pipeline
        </button>
      </div>
    </header>
  );
}
