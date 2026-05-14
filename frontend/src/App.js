import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API = process.env.REACT_APP_API_URL || '';

export default function App() {
  const [todos,   setTodos]   = useState([]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchTodos = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/v1/todos`);
      setTodos(data ?? []);
      setError(null);
    } catch (err) {
      setError('Could not load todos. Is the backend reachable?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

  const addTodo = async (e) => {
    e.preventDefault();
    const title = input.trim();
    if (!title) return;
    try {
      const { data } = await axios.post(`${API}/api/v1/todos`, { title });
      setTodos(prev => [data, ...prev]);
      setInput('');
    } catch {
      setError('Failed to add todo.');
    }
  };

  const toggleTodo = async (todo) => {
    try {
      const { data } = await axios.patch(`${API}/api/v1/todos/${todo.id}`, {
        completed: !todo.completed,
      });
      setTodos(prev => prev.map(t => t.id === data.id ? data : t));
    } catch {
      setError('Failed to update todo.');
    }
  };

  const deleteTodo = async (id) => {
    try {
      await axios.delete(`${API}/api/v1/todos/${id}`);
      setTodos(prev => prev.filter(t => t.id !== id));
    } catch {
      setError('Failed to delete todo.');
    }
  };

  const pending   = todos.filter(t => !t.completed).length;
  const completed = todos.filter(t =>  t.completed).length;

  return (
    <div className="app">
      <header className="app-header">
        <h1>✅ Much To Do</h1>
        <p className="subtitle">
          {pending} pending · {completed} done
        </p>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button onClick={() => setError(null)} aria-label="dismiss">×</button>
          </div>
        )}

        <form className="add-form" onSubmit={addTodo}>
          <input
            className="add-input"
            type="text"
            placeholder="What needs to be done?"
            value={input}
            onChange={e => setInput(e.target.value)}
            aria-label="New todo"
          />
          <button className="add-btn" type="submit" disabled={!input.trim()}>
            Add
          </button>
        </form>

        {loading ? (
          <p className="loading">Loading…</p>
        ) : todos.length === 0 ? (
          <p className="empty">Nothing to do. Add something above!</p>
        ) : (
          <ul className="todo-list">
            {todos.map(todo => (
              <li key={todo.id} className={`todo-item ${todo.completed ? 'done' : ''}`}>
                <button
                  className="toggle-btn"
                  onClick={() => toggleTodo(todo)}
                  aria-label={todo.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {todo.completed ? '☑' : '☐'}
                </button>
                <span className="todo-title">{todo.title}</span>
                <button
                  className="delete-btn"
                  onClick={() => deleteTodo(todo.id)}
                  aria-label="Delete todo"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
