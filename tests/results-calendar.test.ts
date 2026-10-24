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
  expect(html).toContain('Profit on top of participants’ original capital.');
  expect(html).toContain('Example using $1,000.00 starting capital');
  expect(html).toContain('Original capital</dt><dd>$1,000.00');
  expect(html).toContain('Net profit</dt><dd class="win">+$1,480.00');
  expect(html).toContain('Capital + profit</dt><dd>$2,480.00');
  expect(html).toContain('248.00% of the original capital in total');
  expect(html).toContain('It does not set the return for a future cycle.');
  expect(html).not.toContain('Previous 33-day cycle');
});

it.each([
  { profitBps: -2500, label: '-25.00% net loss', result: '$750.00', total: '75.00%', definition: 'The reported loss is deducted from participants’ original capital.' },
  { profitBps: -10000, label: '-100.00% net loss', result: '$0.00', total: '0.00%', definition: 'The reported loss is deducted from participants’ original capital.' },
  { profitBps: 0, label: '0.00% net profit', result: '$1,000.00', total: '100.00%', definition: 'No profit or loss. The original capital is unchanged.' },
])('explains a $label summary without describing a loss or break-even as added profit', ({ profitBps, label, result, total, definition }) => {
  const html = renderToStaticMarkup(createElement(ResultsCalendar, { asOf: '2026-10-24T00:00:00Z', points: [], cycle: { endDay: '2026-10-25', lockDays: 28, profitBps, updatedAt: '2026-10-24T00:00:00Z' } }));
  expect(html).toContain(label);
  expect(html).toContain(definition);
  expect(html).toContain(`${total} of the original capital in total`);
  expect(html).toContain(`${profitBps < 0 ? 'Capital after loss' : 'Capital + profit'}</dt><dd>${result}`);
  expect(html).not.toContain('Profit on top of participants’ original capital.');
});
