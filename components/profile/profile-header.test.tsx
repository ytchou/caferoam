import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProfileHeader } from './profile-header';

describe('ProfileHeader', () => {
  const defaultProps = {
    displayName: 'Mei-Ling',
    avatarUrl: null as string | null,
    stampCount: 12,
    checkinCount: 8,
  };

  it('renders display name and stats', () => {
    render(<ProfileHeader {...defaultProps} />);
    expect(screen.getByText('Mei-Ling')).toBeInTheDocument();
    expect(screen.getByText(/12 stamps/)).toBeInTheDocument();
    expect(screen.getByText(/8 check-ins/)).toBeInTheDocument();
  });

  it('shows initials when no avatar URL', () => {
    render(<ProfileHeader {...defaultProps} />);
    expect(screen.getByText('M')).toBeInTheDocument(); // First char of display name
  });

  it('shows avatar image when URL provided', () => {
    render(<ProfileHeader {...defaultProps} avatarUrl="https://example.com/avatar.jpg" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('avatar.jpg'));
  });

  it('falls back to "User" when no display name', () => {
    render(<ProfileHeader {...defaultProps} displayName={null} />);
    expect(screen.getByText('U')).toBeInTheDocument(); // First char of "User"
  });

  it('renders an Edit Profile link to /settings', () => {
    render(<ProfileHeader {...defaultProps} />);
    const link = screen.getByRole('link', { name: /edit profile/i });
    expect(link).toHaveAttribute('href', '/settings');
  });
});
