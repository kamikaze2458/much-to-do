import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API = process.env.REACT_APP_API_URL || '';

export default function App() {
  const [view, setView] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchTodos = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTodos(Array.isArray(data) ? data : data.tasks || []);
      setError(null);
    } catch {
      setError('Could not load tasks.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      setView('app');
      fetchTodos();
    }
  }, [token, fetchTodos]);

  const login = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API}/auth/login`, { username, password });
      const t = data.token || data.access_token || data.data?.token || '';
      localStorage.setItem('token', t);
      setToken(t);
      setError(null);
    } catch {
      setError('Login failed. Check your credentials.');
    }
  };

  const register = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/auth/register`, {
        username,
        password,
        firstName: firstName,
        lastName: lastName,
      });
      setError(null);
      setView('login');
      alert('Registered successfully! Please log in.');
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed.';
      setError(msg);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken('');
    setTodos([]);
    setView('login');
  };

  const addTodo = async (e) => {
    e.preventDefault();
    const title = input.trim();
    if (!title) return;
    try {
      const { data } = await axios.post(`${API}/tasks`, { title }, { headers: authHeaders });
      setTodos(prev => [data, ...prev]);
      setInput('');
    } catch {
      setError('Failed to add task.');
    }
  };

  const deleteTodo = async (id) => {
    try {
      await axios.delete(`${API}/tasks/${id}`, { headers: authHeaders });
      setTodos(prev => prev.filter(t => (t.id || t._id) !== id));
    } catch {
      setError('Failed to delete task.');
    }
  };

  const toggleTodo = async (todo) => {
    const id = todo.id || todo._id;
    try {
      const { data } = await axios.put(`${API}/tasks/${id}`,
        { title: todo.title, completed: !todo.completed },
        { headers: authHeaders }
      );
      setTodos(prev => prev.map(t => (t.id || t._id) === id ? data : t));
    } catch {
      setError('Failed to update task.');
    }
  };

  const pending = todos.filter(t => !t.completed).length;
  const completed = todos.filter(t => t.completed).length;

  if (view === 'register') {
    return (
      <div className="app">
        <header className="app-header"><h1>✅ Much To Do</h1></header>
        <main className="app-main">
          {error && (
            <div className="error-banner" role="alert">
              {error}<button onClick={() => setError(null)}>×</button>
            </div>
          )}
          <form className="add-form" onSubmit={register}>
            <h2>Register</h2>
            <input value={firstName} onChange={e => setFirstName(e.target.value)}
              placeholder="First Name" required />
            <input value={lastName} onChange={e => setLastName(e.target.value)}
              placeholder="Last Name" required />
            <input value={username} onChange={e => setUsername(e.target.value)}
              placeholder="Username" required />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password" required />
            <button type="submit">Register</button>
            <button type="button" onClick={() => setView('login')}>
              Have an account? Login
            </button>
          </form>
        </main>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="app">
        <header className="app-header"><h1>✅ Much To Do</h1></header>
        <main className="app-main">
          {error && (
            <div className="error-banner" role="alert">
              {error}<button onClick={() => setError(null)}>×</button>
            </div>
          )}
          <form className="add-form" onSubmit={login}>
            <h2>Login</h2>
            <input value={username} onChange={e => setUsername(e.target.value)}
              placeholder="Username" required />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password" required />
            <button type="submit">Login</button>
            <button type="button" onClick={() => setView('register')}>
              Need an account? Register
            </button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>✅ Much To Do</h1>
        <p className="subtitle">{pending} pending · {completed} done</p>
        <button onClick={logout} style={{marginTop:'8px',padding:'4px 12px'}}>Logout</button>
      </header>
      <main className="app-main">
        {error && (
          <div className="error-banner" role="alert">
            {error}<button onClick={() => setError(null)}>×</button>
          </div>
        )}
        <form className="add-form" onSubmit={addTodo}>
          <input value={input} onChange={e => setInput(e.target.value)}
            placeholder="Add a new task…" />
          <button type="submit">Add</button>
        </form>
        {loading ? <p>Loading…</p> : (
          <ul className="todo-list">
            {todos.map(t => {
              const id = t.id || t._id;
              return (
                <li key={id} className={t.completed ? 'done' : ''}>
                  <span onClick={() => toggleTodo(t)} style={{cursor:'pointer',flex:1}}>
                    {t.completed ? '✅' : '⬜'} {t.title}
                  </span>
                  <button onClick={() => deleteTodo(id)}>🗑</button>
                </li>
              );
            })}
            {todos.length === 0 && <p>No tasks yet. Add one above!</p>}
          </ul>
        )}
      </main>
    </div>
  );
}
