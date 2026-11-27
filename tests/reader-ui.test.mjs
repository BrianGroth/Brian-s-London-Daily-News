import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const calendar = await readFile(new URL('../upcoming-events.js', import.meta.url), 'utf8');

test('publication freshness uses London date across summer midnight and clock changes', () => {
  const source = index.slice(index.indexOf('    function londonDateKey'), index.indexOf('    function renderMorning'));
  const context = { Intl, Date }; vm.createContext(context);
  vm.runInContext(source + '\nthis.key = londonDateKey; this.label = snapshotLabel;', context);
  assert.equal(context.key(new Date('2026-07-01T23:30:00Z')), '2026-07-02');
  assert.equal(context.key(new Date('2026-12-01T23:30:00Z')), '2026-12-01');
  assert.equal(context.key(new Date('2026-10-25T00:30:00Z')), '2026-10-25');
  assert.equal(context.key(new Date('2026-10-25T01:30:00Z')), '2026-10-25');
  assert.match(context.label({}, { stories: [{id:'2026-11-16-example'}] }), /2026-11-16.*check source links/);
  assert.doesNotMatch(context.label({}, { stories: [{id:'2026-11-16-example'}] }), /\d{2}:\d{2}/, 'historical check times are never invented');
});

test('story-calendar matching retains query IDs and requires explicit IDs or exact sources', () => {
  const source = index.slice(index.indexOf('    function canonicalEventUrl'), index.indexOf('    async function linkCalendarStories'));
  const context = { URL }; vm.createContext(context);
  vm.runInContext(source + '\nthis.match = matchingEvents;', context);
  const events = [{id:'a',sourceUrl:'https://example.org/event?performance=1'}, {id:'b',sourceUrl:'https://example.org/event?performance=2'}, {id:'c',sourceUrl:'https://elsewhere.org/'}];
  assert.deepEqual(Array.from(context.match({ sources:[['Venue','https://www.example.org/event?performance=1']] }, events), event => event.id), ['a']);
  assert.deepEqual(Array.from(context.match({sources:[],eventIds:['c']},events), event => event.id), ['c']);
  assert.deepEqual(Array.from(context.match({sources:[['Venue','https://example.org/event?performance=1']],eventIds:['c']},events), event => event.id), ['c'], 'explicit occurrence IDs take precedence over a shared source URL');
  assert.equal(context.match({sources:[['Bad','javascript:alert(1)']]},events).length, 0);
});

test('calendar puts one-offs and closing deadlines ahead of ongoing displays, and ranks upcoming decisions by date', () => {
  const source = calendar.slice(calendar.indexOf('function priorityDate'), calendar.indexOf('function shiftMonth'));
  const context = { today: new Date('2026-11-27T12:00:00Z'), dateKey: () => '2026-11-27' }; vm.createContext(context); vm.runInContext(source + '\nthis.dayOrder = dayOrder; this.order = decisionOrder;',context);
  const exhibition = {title:'Exhibition',startDate:'2026-08-01',endDate:'2027-01-01'};
  const closing = {title:'Closing',startDate:'2026-09-01',endDate:'2026-11-27'};
  const oneOff = {title:'Talk',startDate:'2026-11-27',time:'19:00'};
  assert.deepEqual([exhibition,closing,oneOff].sort((a,b)=>context.dayOrder(a,b,'2026-11-27')).map(x=>x.title), ['Talk','Closing','Exhibition']);
  assert.deepEqual([exhibition,oneOff,{title:'Tomorrow',startDate:'2026-11-28'}].sort(context.order).map(x=>x.title), ['Talk','Tomorrow','Exhibition']);
});

test('stale and archive notices explain preserved facts without rewriting data', () => {
  const source = index.slice(index.indexOf('    function updateEditionStatus'), index.indexOf('    function applyReadingView'));
  const status = {};
  const context = { document:{getElementById:()=>status}, issues:{today:{},yesterday:{}}, selectedDay:'today', issueDate:()=> '2026-11-16', londonDateKey:()=> '2026-11-27' };
  vm.createContext(context);vm.runInContext(source+'\nupdateEditionStatus();',context);
  assert.equal(status.hidden,false);assert.match(status.textContent,/No edition has been published for 2026-11-27/);
  context.selectedDay='yesterday';vm.runInContext('updateEditionStatus()',context);assert.match(status.textContent,/Archive edition/);
  context.selectedDay='today';context.londonDateKey=()=> '2026-11-16';vm.runInContext('updateEditionStatus()',context);assert.equal(status.hidden,true);
});
