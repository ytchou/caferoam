import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll } from 'vitest';

import { PhotoUploader } from './photo-uploader';

global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// jsdom does not implement window.matchMedia — stub it as non-mobile (desktop)
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function makeImageFile(name: string, sizeKB = 100): File {
  const content = new ArrayBuffer(sizeKB * 1024);
  return new File([content], name, { type: 'image/jpeg' });
}

describe('PhotoUploader', () => {
  it('shows an upload prompt when no photos are selected', () => {
    render(<PhotoUploader files={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/take photo|add photo/i)).toBeInTheDocument();
  });

  it('displays thumbnails for selected files', () => {
    const files = [makeImageFile('latte.jpg'), makeImageFile('vibe.jpg')];
    render(<PhotoUploader files={files} onChange={vi.fn()} />);
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);
  });

  it('allows removing a selected photo', async () => {
    const onChange = vi.fn();
    const files = [makeImageFile('latte.jpg'), makeImageFile('vibe.jpg')];
    render(<PhotoUploader files={files} onChange={onChange} />);

    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await userEvent.click(removeButtons[0]);

    expect(onChange).toHaveBeenCalledWith([files[1]]);
  });

  it('hides the add button when 3 photos are selected', () => {
    const files = [
      makeImageFile('a.jpg'),
      makeImageFile('b.jpg'),
      makeImageFile('c.jpg'),
    ];
    render(<PhotoUploader files={files} onChange={vi.fn()} maxPhotos={3} />);
    expect(screen.queryByText(/add another/i)).not.toBeInTheDocument();
  });

  it('rejects files larger than 5 MB', async () => {
    const onChange = vi.fn();
    render(<PhotoUploader files={[]} onChange={onChange} maxSizeMB={5} />);

    const file = makeImageFile('huge.jpg', 6 * 1024); // 6 MB
    const input = screen.getByTestId('photo-input');

    await userEvent.upload(input, file);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/too large/i)).toBeInTheDocument();
  });
});
