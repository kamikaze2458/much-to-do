import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API = process.env.REACT_APP_API_URL || '';

function Navbar({ dark, token, onLogout, onSignIn }) {
  return (
    <nav className={`navbar ${dark ? 'dark' : 'light'}`}>
      <div className="navbar-inner">
        <div className="nav-logo">✦ Much To Do</div>
        <div className="nav-links">
          <span className="nav-link">Features</span>
          <span className="nav-link">About</span>
          <span className="nav-link">Contact</span>
          {token
            ? <button className="nav-cta" onClick={onLogout}>Sign Out</button>
            : <button className="nav-cta" onClick={onSignIn}>Get Started</button>
          }
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">✦ Much To Do</div>
          <p className="footer-desc">A beautifully simple task manager built to help you stay organized, focused, and productive every day.</p>
          <p className="footer-author">Created with ♥ by <strong>Aleruchi Kingsley Omodu</strong></p>
        </div>
        <div className="footer-col">
          <h4>Product</h4>
          <ul>
            <li><span>Features</span></li>
            <li><span>How it works</span></li>
            <li><span>Roadmap</span></li>
            <li><span>Changelog</span></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Developer</h4>
          <ul>
            <li><a href="https://github.com/kamikaze2458" target="_blank" rel="noreferrer">GitHub</a></li>
            <li><span>AltSchool Africa</span></li>
            <li><span>ALT/SOE/025/4241</span></li>
            <li><span>DevOps Track</span></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Stack</h4>
          <ul>
            <li><span>React · Go</span></li>
            <li><span>AWS · Terraform</span></li>
            <li><span>Docker · ECR</span></li>
            <li><span>MongoDB Atlas</span></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span className="footer-copy">© 2025 Aleruchi Kingsley Omodu. All rights reserved.</span>
        <div className="footer-badges">
          <span className="footer-badge">AltSchool Africa</span>
          <span className="footer-badge">DevOps · Month 3</span>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const [authTab, setAuthTab] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [todos, setTodos] = useState([]);
  const [removingIds, setRemovingIds] = useState(new Set());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchTodos = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/tasks`, { headers: { Authorization: `Bearer ${token}` } });
      setTodos(Array.isArray(data) ? data : data.tasks || []);
      setError(null);
    } catch { setError('Could not load tasks.'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { if (token) fetchTodos(); }, [token, fetchTodos]);

  const login = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API}/auth/login`, { username, password });
      const t = data.token || data.access_token || '';
      localStorage.setItem('token', t);
      setToken(t);
      setError(null);
    } catch { setError('Login failed. Check your credentials.'); }
  };

  const register = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/auth/register`, { username, password, firstName, lastName });
      setError(null); setAuthTab('login'); setFirstName(''); setLastName('');
      alert('Registered! Please sign in.');
    } catch (err) { setError(err.response?.data?.error || 'Registration failed.'); }
  };

  const logout = () => { localStorage.removeItem('token'); setToken(''); setTodos([]); };

  const addTodo = async (e) => {
    e.preventDefault();
    const title = input.trim();
    if (!title) return;
    try {
      const { data } = await axios.post(`${API}/tasks`, { title }, { headers: authHeaders });
      setTodos(prev => [data, ...prev]);
      setInput('');
    } catch { setError('Failed to add task.'); }
  };

  const deleteTodo = async (id) => {
    setRemovingIds(prev => new Set([...prev, id]));
    setTimeout(async () => {
      try {
        await axios.delete(`${API}/tasks/${id}`, { headers: authHeaders });
        setTodos(prev => prev.filter(t => (t.id || t._id) !== id));
      } catch { setError('Failed to delete.'); }
      setRemovingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }, 250);
  };

  const toggleTodo = async (todo) => {
    const id = todo.id || todo._id;
    try {
      const { data } = await axios.put(`${API}/tasks/${id}`, { title: todo.title, completed: !todo.completed }, { headers: authHeaders });
      setTodos(prev => prev.map(t => (t.id || t._id) === id ? data : t));
    } catch { setError('Failed to update.'); }
  };

  const total = todos.length;
  const done = todos.filter(t => t.completed).length;
  const pending = total - done;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  const filtered = todos.filter(t => filter === 'all' ? true : filter === 'active' ? !t.completed : t.completed);

  // Get time-based greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (!token) {
    return (
      <>
        <Navbar dark={false} token={null} onSignIn={() => setAuthTab('login')} />
        <div className="app-auth">
          <div className="auth-page-content">
            <div className="auth-wrapper">
              <div className="auth-hero">
                <div className="auth-hero-badge">✦ Task Management Reimagined</div>
                <h1>Get things<br /><span>done.</span></h1>
                <p>A beautifully simple way to organize your day, track your progress, and accomplish more — without the clutter.</p>
                <div className="auth-features">
                  <div className="auth-feature"><div className="auth-feature-icon purple">⚡</div><span>Instant task creation — just type and hit enter</span></div>
                  <div className="auth-feature"><div className="auth-feature-icon pink">✓</div><span>Track progress with active and done filters</span></div>
                  <div className="auth-feature"><div className="auth-feature-icon teal">🔒</div><span>Your tasks are private and securely stored</span></div>
                </div>
                <div className="auth-quote">
                  <p>"The secret of getting ahead is getting started."</p>
                  <span>— Mark Twain</span>
                </div>
              </div>
              <div className="auth-card">
                <div className="auth-logo">✦ Much To Do</div>
                <p className="auth-subtitle">Your tasks, beautifully organized.</p>
                {error && <div className="error-banner">{error}<button onClick={() => setError(null)}>×</button></div>}
                <div className="auth-tabs">
                  <button className={`auth-tab ${authTab === 'login' ? 'active' : ''}`} onClick={() => { setAuthTab('login'); setError(null); }}>Sign In</button>
                  <button className={`auth-tab ${authTab === 'register' ? 'active' : ''}`} onClick={() => { setAuthTab('register'); setError(null); }}>Register</button>
                </div>
                {authTab === 'login' ? (
                  <form onSubmit={login}>
                    <div className="field"><label>Username</label><input value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" required /></div>
                    <div className="field"><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required /></div>
                    <button type="submit" className="btn-primary">Sign In →</button>
                  </form>
                ) : (
                  <form onSubmit={register}>
                    <div style={{display:'flex',gap:10}}>
                      <div className="field" style={{flex:1}}><label>First Name</label><input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First" required /></div>
                      <div className="field" style={{flex:1}}><label>Last Name</label><input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last" required /></div>
                    </div>
                    <div className="field"><label>Username</label><input value={username} onChange={e => setUsername(e.target.value)} placeholder="Choose a username" required /></div>
                    <div className="field"><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a password" required /></div>
                    <button type="submit" className="btn-primary">Create Account →</button>
                  </form>
                )}
              </div>
            </div>
          </div>
          <Footer />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar dark={true} token={token} onLogout={logout} />
      <div className="app-tasks">
        <div className="tasks-content">
          {/* Welcome banner */}
          <div className="welcome-banner">
            <div className="welcome-text">
              <h2>{greeting} 👋</h2>
              <p>{pending === 0 ? "All done! You're on top of everything." : `You have ${pending} task${pending !== 1 ? 's' : ''} remaining today.`}</p>
            </div>
            <div className="welcome-stats">
              <div className="wstat"><div className="wstat-num p">{pending}</div><div className="wstat-label">Active</div></div>
              <div className="wstat"><div className="wstat-num d">{done}</div><div className="wstat-label">Done</div></div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="progress-wrap">
            <div className="progress-label">
              <span>Progress</span>
              <span>{progress}% complete</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{width: `${progress}%`}} />
            </div>
          </div>

          {error && <div className="error-banner" style={{width:'100%',maxWidth:640,marginBottom:16}}>{error}<button onClick={() => setError(null)}>×</button></div>}

          <form className="add-form" onSubmit={addTodo}>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="What needs to be done?" />
            <button type="submit" className="btn-add">+ Add Task</button>
          </form>

          <div className="filters">
            {['all','active','done'].map(f => (
              <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? `All (${total})` : f === 'active' ? `Active (${pending})` : `Done (${done})`}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="loading">{[1,2,3].map(i => <div key={i} className="skeleton" style={{animationDelay:`${i*0.1}s`}} />)}</div>
          ) : (
            <ul className="todo-list">
              {filtered.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">{filter === 'done' ? '🎯' : '✦'}</span>
                  <p>{filter === 'done' ? 'No completed tasks yet. Keep going!' : filter === 'active' ? 'All tasks done! Great work.' : 'No tasks yet. Add one above!'}</p>
                </div>
              ) : filtered.map((t, i) => {
                const id = t.id || t._id;
                return (
                  <li key={id} className={`todo-item ${t.completed ? 'done' : ''} ${removingIds.has(id) ? 'removing' : ''}`} style={{animationDelay:`${i*0.04}s`}}>
                    <button className="todo-check" onClick={() => toggleTodo(t)}>{t.completed ? '✓' : ''}</button>
                    <span className="todo-title" onClick={() => toggleTodo(t)}>{t.title}</span>
                    <button className="btn-delete" onClick={() => deleteTodo(id)}>×</button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Footer />
      </div>
    </>
  );
}
