import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Much To Do heading', () => {
  render(<App />);
  const heading = screen.getByText(/Much To Do/i);
  expect(heading).toBeTruthy();
});

test('renders login form by default', () => {
  render(<App />);
  const loginButton = screen.getByRole('button', { name: /login/i });
  expect(loginButton).toBeTruthy();
});
