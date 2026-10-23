import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SyndicateWatch } from "../src/components/SyndicateWatch";
import { ResultsCalendar } from "../src/components/v2/ResultsCalendar";
it("renders the published moon entries and a server-stable countdown with reservation terms",()=>{
  const html=renderToStaticMarkup(createElement(SyndicateWatch,{asOf:'2026-10-23T00:00:00Z',entries:[{id:'a',phase:'FULL',startsAt:'2026-10-26T00:00:00Z',endsAt:'2026-11-23T00:00:00Z'},{id:'b',phase:'NEW',startsAt:'2026-11-09T00:00:00Z',endsAt:'2026-12-07T00:00:00Z'}]}));
  expect(html).toContain('Syndicate horse watch');expect(html).toContain('26 Oct 2026');expect(html).toContain('9 Nov 2026');expect(html).toContain('<strong>03</strong>');
  expect(html).toContain('00:00 UTC');expect(html).toContain('28-day trading period');expect(html).toContain('approval reserves capital');expect(html).toContain('Join Trading with Rob');expect(html).not.toContain('Harry');
});
it("does not invent another date after the published schedule is exhausted",()=>{
  const html=renderToStaticMarkup(createElement(SyndicateWatch,{asOf:'2028-01-01T00:00:00Z',entries:[]}));
  expect(html).toContain('Next entry to be announced');expect(html).not.toContain('Time until the next syndicate start');
});
it("uses the saved duration when showing a cycle report",()=>{
  const html=renderToStaticMarkup(createElement(ResultsCalendar,{asOf:'2026-10-23T00:00:00Z',points:[],cycle:{endDay:'2026-11-23',profitBps:100,updatedAt:'2026-10-23T00:00:00Z',lockDays:28}}));
  expect(html).toContain('28-day club cycle');expect(html).toContain('0/28 days supplied');expect(html).not.toContain('33-day');
});
