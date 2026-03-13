import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { ShopDescription } from './shop-description';

describe('ShopDescription', () => {
  const longText = '這是一間位於大安區的咖啡廳，' +
    '提供手沖咖啡和自家烘焙的甜點。店內環境安靜舒適，適合工作和閱讀。' +
    '老闆是澳洲回來的咖啡師，特別注重豆子的產地和烘焙方式。';

  it('a visitor sees the shop description text', () => {
    render(<ShopDescription text="A cozy shop" />);
    expect(screen.getByText('A cozy shop')).toBeInTheDocument();
  });

  it('a visitor can expand a long description by clicking Read More', async () => {
    const user = userEvent.setup();
    render(<ShopDescription text={longText} />);
    const button = screen.getByRole('button', { name: /更多|Read more/i });
    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(screen.queryByRole('button', { name: /更多|Read more/i })).not.toBeInTheDocument();
  });

  it('does not render when text is empty', () => {
    const { container } = render(<ShopDescription text="" />);
    expect(container.firstChild).toBeNull();
  });
});
