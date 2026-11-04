import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import EvaluationResult from './pages/EvaluationResult';
import { getEntities } from './services/api';
import './App.css';

function Dashboard() {
  const [entities, setEntities] = useState([]);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadEntities();
  }, []);

  const loadEntities = async () => {
    try {
      const data = await getEntities();
      setEntities(data);
    } catch (err) {
      console.error('Failed to load entities:', err);
    }
  };

  const filtered = entities.filter(
    (e) =>
      e.entity_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.entity_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="dashboard-container">
      <div className="header-row">
        <div className="title-section">
          <span className="eyebrow">PORTFOLIO OVERVIEW</span>
          <h1>Borrowers</h1>
          <p className="subtext">Review your portfolio and run a credit risk assessment.</p>
        </div>
        <label className="search-wrap"><span aria-hidden="true">⌕</span><input
          type="search"
          className="search-input"
          aria-label="Search borrowers"
          placeholder="Search borrowers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        /></label>
      </div>

      <div className="portfolio-summary">
        <div className="summary-icon">↗</div>
        <div><span className="summary-label">TOTAL BORROWERS</span><strong>{entities.length}</strong></div>
        <span className="summary-divider" />
        <div className="summary-note"><span className="summary-dot" /> Portfolio is ready for review</div>
      </div>

      <div className="table-container">
        <div className="table-heading"><div><h2>Entity directory</h2><p>{filtered.length} of {entities.length} borrowers</p></div><span className="table-count">{String(filtered.length).padStart(2, '0')} RECORDS</span></div>
        <table className="entity-table">
          <thead>
            <tr>
              <th>BORROWER</th><th>ENTITY ID</th><th>SECTOR</th><th>COUNTRY</th><th>RISK STATUS</th><th className="action-head">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entity) => (
              <tr key={entity.entity_id}>
                <td className="borrower-cell"><span className="entity-avatar">{entity.entity_name?.slice(0, 1)?.toUpperCase() || '—'}</span><span>{entity.entity_name}</span></td>
                <td className="id-cell">{entity.entity_id}</td>
                <td className="sector-cell">{entity.sector}</td>
                <td className="country-cell">{entity.country}</td>
                <td className="risk-cell">
                  <span className="not-evaluated"><i /> Not evaluated</span>
                </td>
                <td className="action-cell" style={{ textAlign: 'right' }}>
                  <button
                    className="orange-btn"
                    onClick={() => navigate(`/evaluation/${entity.entity_id}`)}
                  >
                    Assess <span aria-hidden="true">→</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state"><span>⌕</span><strong>No borrowers found</strong><p>Try another name or entity ID.</p></div>}
      </div>
      <footer className="page-footer"><span>Credence Risk Intelligence</span><span>Private portfolio · Secure workspace</span></footer>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/evaluation/:id" element={<EvaluationResult />} />
      </Routes>
    </Router>
  );
}
