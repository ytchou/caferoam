import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MapView } from './map-view';

vi.mock('react-map-gl/mapbox', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  Marker: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick: () => void;
  }) => <div onClick={onClick}>{children}</div>,
}));

vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}));

describe('MapView', () => {
  const shops = [
    { id: 'shop-1', name: '湛盧咖啡 Zhanlu Coffee', latitude: 25.033, longitude: 121.565 },
    { id: 'shop-2', name: '山頂咖啡 Summit Coffee', latitude: 25.041, longitude: 121.532 },
  ];

  it('a visitor sees a pin for each shop on the map', () => {
    render(<MapView shops={shops} onPinClick={vi.fn()} />);

    expect(screen.getByTestId('map')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '湛盧咖啡 Zhanlu Coffee' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '山頂咖啡 Summit Coffee' })).toBeInTheDocument();
  });

  it('a visitor clicking a pin calls onPinClick with the shop ID', async () => {
    const onPinClick = vi.fn();
    render(<MapView shops={shops} onPinClick={onPinClick} />);

    await userEvent.click(screen.getByRole('button', { name: '湛盧咖啡 Zhanlu Coffee' }));

    expect(onPinClick).toHaveBeenCalledWith('shop-1');
  });
});
