import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Much To Do branding', () => {
  render(<App />);
  const logos = screen.getAllByText(/Much To Do/i);
  expect(logos.length).toBeGreaterThan(0);
});

test('renders sign in button', () => {
  render(<App />);
  const btn = screen.getByRole('button', { name: /sign in/i });
  expect(btn).toBeTruthy();
});
