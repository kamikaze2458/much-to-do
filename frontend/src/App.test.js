import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import App from './App';

jest.mock('axios');

const mockTodos = [
  { id: '1', title: 'Buy groceries',    completed: false },
  { id: '2', title: 'Walk the dog',     completed: true  },
];

beforeEach(() => {
  axios.get.mockResolvedValue({ data: mockTodos });
});

afterEach(() => {
  jest.clearAllMocks();
});

test('renders the app heading', async () => {
  render(<App />);
  expect(screen.getByText(/Much To Do/i)).toBeInTheDocument();
});

test('loads and displays todos', async () => {
  render(<App />);
  await waitFor(() => expect(screen.getByText('Buy groceries')).toBeInTheDocument());
  expect(screen.getByText('Walk the dog')).toBeInTheDocument();
});

test('shows pending and done counts', async () => {
  render(<App />);
  await waitFor(() => screen.getByText('Buy groceries'));
  expect(screen.getByText(/1 pending/i)).toBeInTheDocument();
  expect(screen.getByText(/1 done/i)).toBeInTheDocument();
});

test('add button is disabled when input is empty', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: /add/i })).toBeDisabled();
});

test('adds a new todo', async () => {
  const newTodo = { id: '3', title: 'New task', completed: false };
  axios.get.mockResolvedValue({ data: [] });
  axios.post.mockResolvedValue({ data: newTodo });

  render(<App />);
  const input = screen.getByPlaceholderText(/What needs to be done/i);
  await userEvent.type(input, 'New task');
  fireEvent.click(screen.getByRole('button', { name: /add/i }));

  await waitFor(() => expect(screen.getByText('New task')).toBeInTheDocument());
  expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining('/api/v1/todos'),
    { title: 'New task' }
  );
});

test('shows error banner on fetch failure', async () => {
  axios.get.mockRejectedValue(new Error('Network Error'));
  render(<App />);
  await waitFor(() =>
    expect(screen.getByRole('alert')).toBeInTheDocument()
  );
});
