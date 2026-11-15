import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter as Router, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import EvaluationResult from './pages/EvaluationResult';
import AuthPage from './pages/AuthPage';
import { clearSearchHistory, getCurrentUser, getEntities, getSearchHistory, logoutUser, saveSearchHistory } from './services/api';
import './App.css';

const MAX_SEARCH_HISTORY = 10;
const LEGACY_SEARCH_HISTORY_KEY = 'credence.borrowerSearchHistory';

function SearchSidebar({ history, historyLoading, historyError, currentUser, onSelectSearch, onClear, onOpenSettings, onLogout, open, onClose }) {
  const location = useLocation();

  return (
    <>
      {open && <button className="sidebar-backdrop" aria-label="Close sidebar" onClick={onClose} />}
      <aside className={`search-sidebar${open ? ' is-open' : ''}`} aria-label="Search history sidebar">
        <Link to="/" className="sidebar-brand" onClick={onClose}>
          <span className="sidebar-brand-mark">C</span>
          <span><strong>Credence</strong><small>RISK INTELLIGENCE</small></span>
        </Link>

        <div className="sidebar-section-label">WORKSPACE</div>
        <Link to="/borrowers" className={`sidebar-nav-link${location.pathname === '/borrowers' ? ' active' : ''}`} onClick={onClose}>
          <span className="sidebar-nav-icon" aria-hidden="true">▦</span> Borrowers
        </Link>

        <div className="sidebar-history-heading">
          <span className="sidebar-section-label">RECENT SEARCHES</span>
          {history.length > 0 && <button className="history-clear" type="button" onClick={onClear}>Clear</button>}
        </div>
        {history.length ? (
          <div className="sidebar-history-list">
            {history.map((item) => (
              <button
                className="history-item"
                key={item.search_id}
                type="button"
                title={`Search for ${item.query}`}
                onClick={() => onSelectSearch(item.query)}
              >
                <span className="history-search-icon" aria-hidden="true">⌕</span>
                <span className="history-query">{item.query}</span>
              </button>
            ))}
          </div>
        ) : historyLoading ? (
          <p className="history-empty">Loading saved searches…</p>
        ) : historyError ? (
          <p className="history-empty history-error">{historyError}</p>
        ) : (
          <p className="history-empty">Your borrower searches will appear here.</p>
        )}

        <div className="sidebar-utility-actions">
          <button className="sidebar-utility-button" type="button" onClick={onOpenSettings}>
            <span aria-hidden="true">⚙</span> Settings
          </button>
          <button className="sidebar-utility-button sidebar-logout-button" type="button" onClick={onLogout}>
            <span aria-hidden="true">↪</span> Sign out
          </button>
        </div>

        <div className="sidebar-footer">
          <span className="sidebar-status-dot" /> {currentUser.full_name || currentUser.email}
        </div>
      </aside>
    </>
  );
}

function SettingsDialog({ historyCount, userEmail, theme, onThemeChange, onClose, onClearHistory }) {
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="settings-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="settings-dialog-header">
          <div><span className="eyebrow">WORKSPACE</span><h2 id="settings-title">Settings</h2></div>
          <button className="settings-close" type="button" aria-label="Close settings" onClick={onClose}>×</button>
        </div>

        <div className="settings-section">
          <span className="settings-section-label">APPEARANCE</span>
          <label className="theme-toggle-row">
            <span><strong>Light mode</strong><small>Switch between dark and light appearance</small></span>
            <input
              type="checkbox"
              role="switch"
              aria-label="Light mode"
              checked={theme === 'light'}
              onChange={(event) => onThemeChange(event.target.checked ? 'light' : 'dark')}
            />
            <span className="theme-switch-track" aria-hidden="true"><i /></span>
          </label>
        </div>

        <div className="settings-section">
          <span className="settings-section-label">SEARCH HISTORY</span>
          <p>Searches are saved to your account and shown in the sidebar.</p>
          <div className="settings-history-summary">
            <span>Saved searches</span><strong>{historyCount}</strong>
          </div>
          {!confirmClear ? (
            <button className="settings-danger-button" type="button" disabled={historyCount === 0} onClick={() => setConfirmClear(true)}>
              Clear search history
            </button>
          ) : (
            <div className="settings-confirm-row">
              <span>Clear all saved searches?</span>
              <button type="button" onClick={() => setConfirmClear(false)}>Cancel</button>
              <button className="settings-confirm-clear" type="button" onClick={onClearHistory}>Clear</button>
            </div>
          )}
        </div>

        <div className="settings-section settings-account-note">
          <span className="settings-section-label">ACCOUNT</span>
          <p>Signed in as <strong>{userEmail}</strong></p>
        </div>
      </section>
    </div>
  );
}

function LandingPage() {
  const [borrowerCount, setBorrowerCount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getEntities()
      .then((entities) => {
        if (!cancelled) setBorrowerCount(entities.length);
      })
      .catch((error) => console.error('Failed to load portfolio count:', error));
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div className="landing-copy motion-rise">
          <span className="landing-eyebrow"><i /> CREDIT RISK INTELLIGENCE</span>
          <h1>See the signals.<br /><span>Move with confidence.</span></h1>
          <p>Bring borrower data, risk rules, and machine learning together in one clear view of your portfolio.</p>
          <div className="landing-actions">
            <Link className="landing-primary-button" to="/borrowers">Open borrower workspace <span aria-hidden="true">→</span></Link>
            <a className="landing-secondary-link" href="#capabilities">Explore the platform <span aria-hidden="true">↓</span></a>
          </div>
          <div className="landing-proof"><span className="landing-proof-mark">✓</span> Rule-based review and ML scoring in one workflow</div>
        </div>

        <div className="landing-visual motion-float" aria-label="Animated portfolio risk visualization">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="orbit-core"><span>CR</span><i /></div>
          <div className="signal-card signal-card-top"><span className="signal-card-label">PORTFOLIO SIGNAL</span><strong>Risk in focus</strong><span className="signal-status"><i /> Live assessment</span></div>
          <div className="signal-card signal-card-bottom"><span className="signal-card-label">BORROWERS</span><strong>{borrowerCount ?? '—'}</strong><span className="signal-card-caption">in your workspace</span></div>
          <span className="visual-node node-one" /><span className="visual-node node-two" /><span className="visual-node node-three" />
        </div>
      </section>

      <section className="landing-capabilities" id="capabilities">
        <div className="capabilities-heading">
          <span className="eyebrow">ONE CONNECTED WORKFLOW</span>
          <h2>From borrower data to a clearer decision.</h2>
        </div>
        <div className="capability-grid">
          <article className="capability-card motion-rise motion-delay-one"><span className="capability-icon">⌕</span><h3>Portfolio view</h3><p>Find borrowers quickly and keep recent searches close at hand.</p></article>
          <article className="capability-card motion-rise motion-delay-two"><span className="capability-icon">⌁</span><h3>Rule assessment</h3><p>Review factor-level signals against your configured thresholds.</p></article>
          <article className="capability-card motion-rise motion-delay-three"><span className="capability-icon">◈</span><h3>ML prediction</h3><p>See the model prediction alongside the rule-based assessment.</p></article>
        </div>
        <div className="landing-bottom-cta"><span>Ready to review the portfolio?</span><Link to="/borrowers">Go to borrowers <span aria-hidden="true">→</span></Link></div>
      </section>
      <footer className="landing-footer"><span>Credence Risk Intelligence</span><span>Portfolio workspace</span></footer>
    </div>
  );
}

function Dashboard({ onSaveSearch, selectedSearch }) {
  const [entities, setEntities] = useState([]);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    getEntities()
      .then((data) => {
        if (!cancelled) setEntities(data);
      })
      .catch((err) => console.error('Failed to load entities:', err));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (selectedSearch !== null) setSearch(selectedSearch);
  }, [selectedSearch]);

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = entities.filter((entity) =>
    entity.entity_name?.toLowerCase().includes(normalizedSearch)
    || entity.entity_id?.toLowerCase().includes(normalizedSearch)
  );

  useEffect(() => {
    const query = search.trim();
    if (!query) return undefined;
    const timer = window.setTimeout(() => onSaveSearch(query), 650);
    return () => window.clearTimeout(timer);
  }, [search, onSaveSearch]);

  function submitSearch(event) {
    event.preventDefault();
    onSaveSearch(search);
  }

  return (
    <div className="dashboard-container">
      <div className="header-row">
        <div className="title-section">
          <span className="eyebrow">PORTFOLIO OVERVIEW</span>
          <h1>Borrowers</h1>
          <p className="subtext">Review your portfolio and run a credit risk assessment.</p>
        </div>
        <form className="search-wrap" role="search" onSubmit={submitSearch}>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            className="search-input"
            aria-label="Search borrowers"
            placeholder="Search borrowers"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onBlur={(event) => onSaveSearch(event.target.value)}
          />
          <button className="search-save-button" type="submit" aria-label="Save this search">Enter</button>
        </form>
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
            <tr><th>BORROWER</th><th>ENTITY ID</th><th>SECTOR</th><th>COUNTRY</th><th>RISK STATUS</th><th className="action-head">ACTION</th></tr>
          </thead>
          <tbody>
            {filtered.map((entity) => (
              <tr key={entity.entity_id}>
                <td className="borrower-cell"><span className="entity-avatar">{entity.entity_name?.slice(0, 1)?.toUpperCase() || '—'}</span><span>{entity.entity_name}</span></td>
                <td className="id-cell">{entity.entity_id}</td>
                <td className="sector-cell">{entity.sector}</td>
                <td className="country-cell">{entity.country}</td>
                <td className="risk-cell"><span className="not-evaluated"><i /> Not evaluated</span></td>
                <td className="action-cell" style={{ textAlign: 'right' }}>
                  <button className="orange-btn" onClick={() => {
                    onSaveSearch(entity.entity_name || entity.entity_id);
                    navigate(`/evaluation/${entity.entity_id}`);
                  }}>Assess <span aria-hidden="true">→</span></button>
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

function AppLayout() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('credence.theme') === 'light' ? 'light' : 'dark');
  const [selectedSearch, setSelectedSearch] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => { if (!cancelled) setCurrentUser(user); })
      .catch(() => { if (!cancelled) setCurrentUser(null); })
      .finally(() => { if (!cancelled) setAuthLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setHistory([]);
      setHistoryLoading(false);
      return undefined;
    }
    let cancelled = false;
    async function loadHistory() {
      const saved = await getSearchHistory();
      // Migrate browser-only history from the previous version into MySQL once.
      let legacy = [];
      try {
        const parsed = JSON.parse(localStorage.getItem(LEGACY_SEARCH_HISTORY_KEY) || '[]');
        if (Array.isArray(parsed)) legacy = parsed.filter((item) => typeof item?.query === 'string').slice(0, MAX_SEARCH_HISTORY);
      } catch {
        legacy = [];
      }
      for (const item of legacy.reverse()) await saveSearchHistory(item.query);
      if (legacy.length) localStorage.removeItem(LEGACY_SEARCH_HISTORY_KEY);
      return legacy.length ? getSearchHistory() : saved;
    }

    loadHistory()
      .then((saved) => {
        if (!cancelled) {
          setHistory(saved);
          setHistoryError('');
        }
      })
      .catch((error) => {
        console.error('Failed to load database search history:', error);
        if (!cancelled) setHistoryError('Could not load searches from database.');
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => { cancelled = true; };
  }, [currentUser?.user_id]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('credence.theme', theme);
  }, [theme]);

  useEffect(() => setSidebarOpen(false), [location.pathname]);

  const saveSearch = useCallback(async (value) => {
    const query = value.trim();
    if (!query) return;
    try {
      const saved = await saveSearchHistory(query);
      setHistory((previous) => [saved, ...previous.filter((entry) => entry.query.toLowerCase() !== query.toLowerCase())]
        .sort((left, right) => new Date(right.searched_at) - new Date(left.searched_at))
        .slice(0, MAX_SEARCH_HISTORY));
      setHistoryError('');
    } catch (error) {
      console.error('Failed to save search history to database:', error);
      setHistoryError('Could not save searches to database.');
    }
  }, []);

  async function clearHistory() {
    try {
      await clearSearchHistory();
      setHistory([]);
      setHistoryError('');
      setSettingsOpen(false);
    } catch (error) {
      console.error('Failed to clear database search history:', error);
      setHistoryError('Could not clear searches from database.');
    }
  }

  function finishAuthentication(user) {
    setCurrentUser(user);
    setHistoryLoading(true);
    navigate('/');
  }

  async function signOut() {
    try {
      await logoutUser();
      setCurrentUser(null);
      setHistory([]);
      setSettingsOpen(false);
      navigate('/login');
    } catch (error) {
      console.error('Unable to sign out:', error);
    }
  }

  function selectSearch(query) {
    setSelectedSearch(query);
    if (location.pathname !== '/borrowers') navigate('/borrowers');
    setSidebarOpen(false);
  }

  if (authLoading) return <main className="auth-loading">Checking your sign-in…</main>;

  if (!currentUser) {
    return (
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" onSuccess={finishAuthentication} />} />
        <Route path="/register" element={<AuthPage mode="register" onSuccess={finishAuthentication} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (location.pathname === '/login' || location.pathname === '/register') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app-shell">
      <SearchSidebar
        history={history}
        historyLoading={historyLoading}
        historyError={historyError}
        currentUser={currentUser}
        onSelectSearch={selectSearch}
        onClear={clearHistory}
        onOpenSettings={() => setSettingsOpen(true)}
        onLogout={signOut}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {settingsOpen && <SettingsDialog historyCount={history.length} userEmail={currentUser.email} theme={theme} onThemeChange={setTheme} onClose={() => setSettingsOpen(false)} onClearHistory={clearHistory} />}
      <main className="app-main">
        <button className="sidebar-toggle" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open search history">☰ <span>Search history</span></button>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/borrowers" element={<Dashboard onSaveSearch={saveSearch} selectedSearch={selectedSearch} />} />
          <Route path="/evaluation/:id" element={<EvaluationResult onSaveSearch={saveSearch} />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return <Router><AppLayout /></Router>;
}
