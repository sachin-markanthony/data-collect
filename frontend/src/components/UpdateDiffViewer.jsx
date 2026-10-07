import React from 'react';
import { RefreshCw, ArrowRight, Check, Zap, AlertTriangle } from 'lucide-react';

export default function UpdateDiffViewer({ diffData, matchedProjectId, onApplyUpdate }) {
  if (!diffData) return null;

  return (
    <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: 10, padding: '16px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw style={{ width: 18, height: 18, color: '#c084fc' }} />
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#e9d5ff' }}>
            Existing Project Matched — Auto-Detected Price & Unit Diff
          </h4>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#c084fc', background: 'rgba(139, 92, 246, 0.2)', padding: '2px 8px', borderRadius: 4 }}>
          Target ID: {matchedProjectId ? matchedProjectId.substring(0, 13) + '...' : 'Production Project'}
        </span>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
        {diffData.summary}
      </p>

      {/* Changes Table */}
      <div style={{ overflowX: 'auto', marginBottom: '14px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '6px 8px' }}>Field / Unit</th>
              <th style={{ padding: '6px 8px' }}>Existing Value (Old)</th>
              <th style={{ padding: '6px 8px' }}></th>
              <th style={{ padding: '6px 8px' }}>Scraped Value (New)</th>
              <th style={{ padding: '6px 8px' }}>Change</th>
            </tr>
          </thead>
          <tbody>
            {(diffData.changes || []).map((change, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '8px', fontWeight: 600, color: '#f3e8ff' }}>
                  {change.unit_type ? `${change.unit_type} (${change.field})` : change.label || change.field}
                </td>
                <td style={{ padding: '8px', color: '#f87171' }}>
                  {typeof change.old === 'number' ? `₹${(change.old / 100000).toFixed(2)} Lakhs` : (change.old || 'None')}
                </td>
                <td style={{ padding: '8px', textAlign: 'center' }}>
                  <ArrowRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
                </td>
                <td style={{ padding: '8px', color: '#34d399', fontWeight: 600 }}>
                  {typeof change.new === 'number'
                    ? `₹${(change.new / 100000).toFixed(2)} Lakhs`
                    : (typeof change.new === 'object' ? JSON.stringify(change.new) : change.new)}
                </td>
                <td style={{ padding: '8px' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontWeight: 700,
                    background: change.change.includes('+') ? 'rgba(16,185,129,0.2)' : 'rgba(139,92,246,0.2)',
                    color: change.change.includes('+') ? '#34d399' : '#c084fc'
                  }}>
                    {change.change}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
        <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }} onClick={onApplyUpdate}>
          <Zap style={{ width: 16, height: 16 }} />
          Apply Selected Updates to Production
        </button>
      </div>
    </div>
  );
}
