import React, { useState } from 'react';
import {
  X, Play, Globe, CheckCircle2, AlertCircle, Loader2, Layers, Filter, Sparkles, Compass
} from 'lucide-react';

export default function PipelineRunnerModal({ isOpen, onClose, onRunPipeline, onCrawlWebsite }) {
  const [mode, setMode] = useState('single'); // 'single' | 'crawl'
  const [provider, setProvider] = useState('auto'); // 'auto' | 'gemini' | 'local'
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState(3);
  const [maxProperties, setMaxProperties] = useState(15);
  const [skipExisting, setSkipExisting] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [crawlStats, setCrawlStats] = useState(null);

  if (!isOpen) return null;

  const singleSampleUrls = [
    { label: 'Godrej Ananda (Bengaluru North)', url: 'https://www.99acres.com/godrej-ananda-bagalur-bangalore-north-npxid-r389201' },
    { label: 'DLF One Midtown (Delhi Penthouse)', url: 'https://www.magicbricks.com/dlf-one-midtown-moti-nagar-delhi-pdpid-4d4231' },
    { label: 'Paradigm Antares (Mumbai Bandra)', url: 'https://houssed.com/mumbai/paradigm-antares-bandra-west' }
  ];

  const crawlerSampleUrls = [
    { label: 'Houssed - Mumbai City Projects', url: 'https://houssed.com/mumbai' },
    { label: '99acres - Bengaluru New Projects', url: 'https://www.99acres.com/property-in-bangalore-ffid' },
    { label: 'Houssed - Pune Projects', url: 'https://houssed.com/pune' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setCrawlStats(null);

    try {
      if (mode === 'single') {
        await onRunPipeline(url.trim(), provider);
        setSuccessMsg('Pipeline executed successfully! Property staged for review.');
        setTimeout(() => {
          setSuccessMsg(null);
          setUrl('');
          onClose();
        }, 1500);
      } else {
        const res = await onCrawlWebsite({
          url: url.trim(),
          maxPages: Number(maxPages),
          maxProperties: Number(maxProperties),
          skipExisting,
          provider
        });
        const stats = res.data || {};
        setCrawlStats(stats);
        setSuccessMsg(`Crawl complete! Discovered ${stats.totalDiscoveredCount || 0} projects, staged ${stats.processedCount || 0} new properties (${stats.alreadyInDbSkippedCount || 0} skipped).`);
      }
    } catch (err) {
      setError(err.message || 'Execution failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '580px', padding: '24px', position: 'relative', border: '1px solid rgba(255,255,255,0.12)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X style={{ width: 20, height: 20 }} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(139, 92, 246, 0.3))', color: '#93c5fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {mode === 'single' ? <Globe style={{ width: 22, height: 22 }} /> : <Compass style={{ width: 22, height: 22 }} />}
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>Scrape & Extraction Pipeline</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              {mode === 'single'
                ? 'Extract 1 specific property page into human review staging'
                : 'Crawl entire directory/website, discover all property URLs, & batch extract'}
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: 8, marginBottom: '18px', border: '1px solid var(--glass-border)' }}>
          <button
            type="button"
            onClick={() => { setMode('single'); setSuccessMsg(null); setError(null); }}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: 'none',
              background: mode === 'single' ? 'var(--primary-color)' : 'transparent',
              color: mode === 'single' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <Globe style={{ width: 15, height: 15 }} />
            Single Property URL
          </button>

          <button
            type="button"
            onClick={() => { setMode('crawl'); setSuccessMsg(null); setError(null); }}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: 'none',
              background: mode === 'crawl' ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'transparent',
              color: mode === 'crawl' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <Compass style={{ width: 15, height: 15 }} />
            Full Website Crawler
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* URL Input */}
          <div style={{ marginBottom: '14px' }}>
            <label className="form-label">
              {mode === 'single' ? 'Target Property Page URL' : 'Target Category or Root Directory URL'}
            </label>
            <input
              type="url"
              className="form-input"
              placeholder={mode === 'single' ? 'https://www.99acres.com/project-name-...' : 'https://houssed.com/mumbai or https://www.99acres.com/property-in-...'}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>

          {/* Crawler Options (Only in Crawl Mode) */}
          {mode === 'crawl' && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.725rem' }}>Max Pages to Follow</label>
                  <select className="form-select" value={maxPages} onChange={(e) => setMaxPages(e.target.value)}>
                    <option value={1}>1 Page (Current page only)</option>
                    <option value={2}>2 Pages</option>
                    <option value={3}>3 Pages (Recommended)</option>
                    <option value={5}>5 Pages</option>
                    <option value={10}>10 Pages (Deep Crawl)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.725rem' }}>Max Properties Limit</label>
                  <select className="form-select" value={maxProperties} onChange={(e) => setMaxProperties(e.target.value)}>
                    <option value={5}>5 Properties (Quick Test)</option>
                    <option value={15}>15 Properties</option>
                    <option value={25}>25 Properties</option>
                    <option value={50}>50 Properties</option>
                  </select>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.75rem', color: '#93c5fd' }}>
                <input
                  type="checkbox"
                  checked={skipExisting}
                  onChange={(e) => setSkipExisting(e.target.checked)}
                  style={{ accentColor: 'var(--primary-color)' }}
                />
                <span>Skip already scraped / existing URLs in DB (Smart Deduplication)</span>
              </label>
            </div>
          )}

          {/* AI Extraction Engine Selector */}
          <div style={{ marginBottom: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '10px 12px' }}>
            <span style={{ fontSize: '0.725rem', color: '#93c5fd', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              🧠 AI Extraction Engine
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setProvider('auto')}
                style={{
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--glass-border)',
                  background: provider === 'auto' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.03)',
                  borderColor: provider === 'auto' ? '#3b82f6' : 'var(--glass-border)',
                  color: provider === 'auto' ? '#93c5fd' : 'var(--text-muted)',
                  fontSize: '0.725rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ⚡ Auto (Cloud + Local)
              </button>

              <button
                type="button"
                onClick={() => setProvider('gemini')}
                style={{
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--glass-border)',
                  background: provider === 'gemini' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.03)',
                  borderColor: provider === 'gemini' ? '#10b981' : 'var(--glass-border)',
                  color: provider === 'gemini' ? '#6ee7b7' : 'var(--text-muted)',
                  fontSize: '0.725rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ✨ Gemini (Cloud)
              </button>

              <button
                type="button"
                onClick={() => setProvider('local')}
                style={{
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--glass-border)',
                  background: provider === 'local' ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255,255,255,0.03)',
                  borderColor: provider === 'local' ? '#8b5cf6' : 'var(--glass-border)',
                  color: provider === 'local' ? '#c4b5fd' : 'var(--text-muted)',
                  fontSize: '0.725rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                💻 Qwen Coder (Docker)
              </button>
            </div>
          </div>

          {/* Preset Sample URLs */}
          <div style={{ marginBottom: '18px' }}>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              {mode === 'single' ? 'Or pick a single property preset:' : 'Or pick a directory crawl preset:'}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {(mode === 'single' ? singleSampleUrls : crawlerSampleUrls).map((sample, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setUrl(sample.url)}
                  style={{ textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', padding: '6px 10px', borderRadius: 6, color: '#93c5fd', fontSize: '0.75rem', cursor: 'pointer', transition: 'background 0.2s' }}
                >
                  ⚡ {sample.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div style={{ padding: '10px', borderRadius: 6, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Success / Stats display */}
          {successMsg && (
            <div style={{ padding: '10px', borderRadius: 6, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{successMsg}</span>
              </div>
              {crawlStats && (
                <div style={{ fontSize: '0.725rem', color: '#a7f3d0', paddingLeft: '24px' }}>
                  Pages crawled: {crawlStats.pagesCrawledCount} | Discovered: {crawlStats.totalDiscoveredCount} | New Staged: {crawlStats.processedCount} | Skipped: {crawlStats.alreadyInDbSkippedCount}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Close
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                  {mode === 'single' ? 'Extracting Property...' : 'Crawling & Staging Website...'}
                </>
              ) : (
                <>
                  <Play style={{ width: 16, height: 16, fill: 'currentColor' }} />
                  {mode === 'single' ? 'Run Single Pipeline' : 'Start Full Website Crawl'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
