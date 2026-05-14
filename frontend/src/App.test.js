import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: [] })),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
}));

test('renders Much To Do heading', async () => {
  render(<App />);
  const heading = screen.getByText(/Much To Do/i);
  expect(heading).toBeTruthy();
});

test('renders add button', () => {
  render(<App />);
  const button = screen.getByRole('button', { name: /add/i });
  expect(button).toBeTruthy();
  expect(button.disabled).toBe(true);
});
