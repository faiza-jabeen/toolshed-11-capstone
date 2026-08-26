import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToolCard } from '../ToolCard.jsx';
import { aTool } from '../../test/factories.js';

const show = (tool) => render(<MemoryRouter><ToolCard tool={tool} /></MemoryRouter>);

describe('ToolCard', () => {
  test('shows the tag, name, shelf and deposit', () => {
    show(aTool({ assetTag: 'TS-0117', name: 'Orbital sander', shelf: 'B4', deposit: 10 }));
    expect(screen.getByText('TS-0117')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Orbital sander' })).toBeInTheDocument();
    expect(screen.getByText('Shelf B4')).toBeInTheDocument();
    expect(screen.getByText('£10 deposit')).toBeInTheDocument();
  });

  test('links to the tool detail page', () => {
    show(aTool({ id: 42, name: 'Wet tile cutter' }));
    expect(screen.getByRole('link', { name: 'Wet tile cutter' })).toHaveAttribute('href', '/tools/42');
  });

  test('states the status in words, not only in colour', () => {
    show(aTool({ status: 'repair' }));
    // Anyone who cannot distinguish the pip colour still gets the answer.
    expect(screen.getByText('In repair')).toBeInTheDocument();
  });

  test('falls back gracefully when a tool has no notes', () => {
    show(aTool({ notes: '' }));
    expect(screen.getByText('No notes yet.')).toBeInTheDocument();
  });
});
