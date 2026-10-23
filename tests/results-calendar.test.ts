import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { ResultsCalendar } from '../src/components/v2/ResultsCalendar';

it('renders signed percentage gains, losses and break-even days with truthful compounded totals',()=>{
  const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
  const html=renderToStaticMarkup(createElement(ResultsCalendar,{asOf:'2026-10-23T12:00:00Z',points:[{day:'2026-09-01',returnBps:10000},{day:'2026-09-02',returnBps:-2000},{day:'2026-09-03',returnBps:5500},{day:'2026-09-04',returnBps:0}]}));
  expect(html).toContain('Club daily performance · % · UTC');
  expect(html).toContain('+148.00%');expect(html).toContain('results-calendar-day win');expect(html).toContain('results-calendar-day loss');expect(html).toContain('results-calendar-day flat');
  expect(html).toContain('partial daily history');expect(html).not.toContain('Actual allocation results · USD');expect(html).not.toContain('$');
  expect(errors).not.toHaveBeenCalled();errors.mockRestore();
});
it('leaves missing days unknown and permits previous-month browsing before any daily figures exist',()=>{
  const html=renderToStaticMarkup(createElement(ResultsCalendar,{asOf:'2026-10-23T12:00:00Z',points:[]}));
  expect(html).toContain('no daily result reported');expect(html).toContain('Daily results will appear after Super Admin publishes them.');
  expect(html).toContain('Last month');expect(html).not.toMatch(/aria-label="Previous month" disabled/);
  expect(html).toContain('Personal allocation results and payouts are recorded separately.');
});

it('labels a supplied 148% future-ending cycle as owner-reported with a pending daily breakdown',()=>{
  const html=renderToStaticMarkup(createElement(ResultsCalendar,{asOf:'2026-10-23T12:00:00Z',points:[],cycle:{endDay:'2026-10-25',profitBps:14800,updatedAt:'2026-10-23T00:00:00Z'}}));
  expect(html).toContain('+148.00%');expect(html).toContain('Owner-reported summary');expect(html).toContain('Scheduled cycle end is still ahead.');
  expect(html).toContain('Daily breakdown pending: 0/33 days supplied.');expect(html).toContain('This summary does not confirm a personal payout.');
  expect(html).not.toContain('results-calendar-day win');expect(html).not.toContain('results-calendar-day loss');
});
