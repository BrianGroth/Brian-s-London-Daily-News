import test from 'node:test';
import assert from 'node:assert/strict';
import { extractEvidence } from '../scripts/lib/source_adapters.mjs';
import { availabilityProvider, availabilityObservation, observeAvailability } from '../scripts/lib/availability.mjs';
import { sourceOptions, compactEvidence } from '../scripts/read_source.mjs';

test('main content beats a large navigation menu and finds a price-only statement',()=>{
  const result=extractEvidence('<header>'+('Menu '.repeat(400))+'</header><nav>Free membership tickets <a href="/account">Book tickets</a></nav><main><h1>Workshop</h1><p>Adults pay £10 per person.</p><p>18 November 2026 at 12:30 GMT.</p><a href="https://booking.example/event/1">Book here</a></main>','https://example.org/workshop');
  assert.match(result.textExcerpt,/Adults pay £10/);assert.doesNotMatch(result.textExcerpt,/Menu|membership/);
  assert.ok(result.snippets.some(s=>s.includes('£10')));assert.deepEqual(result.fields.prices,['£10 per person']);
  assert.ok(result.fields.dates.includes('18 November 2026'));assert.equal(result.fields.bookingUrl,'https://booking.example/event/1');
  assert.deepEqual(result.fields.availability,[]);assert.ok(result.unknownFields.includes('availability'));
});
test('account links never outrank the event action and unsafe actions are omitted',()=>{
 const e=extractEvidence('<main><a href="/shop/workbook">Nature Journaling Workbook</a><a href="https://127.0.0.1/register">Book</a><a href="/account/tickets">Tickets</a><a href="/membership">Book membership</a><a href="javascript:alert(1)">Book</a><a href="https://user:secret@example.com">Book</a><a href="/event/2/register">Register here</a></main>','https://example.org/workshop');
 assert.deepEqual(e.actions,[{label:'Register here',url:'https://example.org/event/2/register'}]);
});
test('structured event evidence retains facts and flags contradictory availability',()=>{
 const html='<script type="application/ld+json">{"@type":"Event","name":"Talk","startDate":"2026-12-01T16:00:00Z","location":{"name":"Hall"}}</script><main>Tuesday sold out. Wednesday tickets are available.</main>';
 const e=extractEvidence(html,'https://example.org/talk');assert.deepEqual(e.fields.venue,['Hall']);assert.ok(e.fields.dates.includes('2026-12-01T16:00:00Z'));assert.equal(e.conflicts.length,1);
});
test('read-only adapters identify providers with strict host and path boundaries',()=>{
 assert.equal(availabilityProvider('https://heathhands.beaconforms.com/form/123'),'beacon');assert.equal(availabilityProvider('https://ucl.zoom.us/webinar/register/id'),'zoom');
 for(const u of ['https://eventbrite.co.uk.evil.example/e/test','https://www.eventbrite.co.uk/account','https://127.0.0.1/e/test','https://name:secret@ucl.zoom.us/webinar/register/id'])assert.throws(()=>availabilityProvider(u));
});
test('provider observations distinguish unknown, registration and availability without claiming bookings',()=>{
 assert.equal(availabilityObservation('beacon','Choose your tickets').status,'unknown');
 assert.equal(availabilityObservation('beacon','Only 5 tickets are available for this event.').status,'available-statement');
 assert.equal(availabilityObservation('eventbrite','FEW TICKETS LEFT\nReserve a spot').status,'available-statement');
 assert.equal(availabilityObservation('zoom','Webinar Registration\nFirst name\nRegister').status,'registration-form-open');
 assert.equal(availabilityObservation('barbican','Sold out\nAvailable').status,'conflicting');
});
test('browser failures become explicit unknown and unsupported URLs do not launch a browser',async()=>{
 let launches=0;const browserFactory=async()=>{launches++;throw new Error('Browser unavailable');};
 const result=await observeAvailability('https://www.eventbrite.co.uk/e/test',{browserFactory});assert.equal(result.status,'unknown');assert.match(result.error,/Browser unavailable/);
 await assert.rejects(observeAvailability('https://example.org/event',{browserFactory}));assert.equal(launches,1);
 await assert.rejects(observeAvailability('https://ucl.zoom.us/webinar/register/id',{browserFactory,blockedDomains:['zoom.us']}));assert.equal(launches,1);
});
test('source CLI supports explicit bounded batches, preserving single-url and refresh',()=>{
 assert.deepEqual(sourceOptions(['https://example.org','--refresh']).urls,['https://example.org']);
 assert.deepEqual(sourceOptions(['--urls','https://a.example,https://b.example','--format','full','--concurrency','2']).urls,['https://a.example','https://b.example']);
 for(const args of [['--format','opaque'],['--concurrency','0'],['--urls'],['--whatever']])assert.throws(()=>sourceOptions(args));
 const packet=compactEvidence({url:'https://example.org',ok:true,bodyFile:'/cache/body',evidence:extractEvidence('<main>Workshop</main>','https://example.org')});assert.ok(packet.evidence.unknownFields.includes('availability'));assert.equal(packet.bodyFile,'/cache/body');
 const observed=compactEvidence({availability:{status:'unknown',textExcerpt:'long browser document',checkedAt:'2026-11-27T08:00:00Z'}});assert.equal(observed.availability.textExcerpt,undefined);assert.equal(observed.availability.status,'unknown');
});

test('availability browser strips credentials and blocks mutations and private/account requests',async()=>{
 let handler;const outcomes=[];let closed=0;
 const page={goto:async()=>{for(const [url,method] of [['https://ucl.zoom.us/webinar/register/id','GET'],['https://ucl.zoom.us/api/register','POST'],['https://127.0.0.1/','GET'],['https://ucl.zoom.us/account','GET']]){await handler({request:()=>({url:()=>url,method:()=>method,headers:()=>({cookie:'private',authorization:'secret',accept:'text/html'})}),abort:async()=>outcomes.push({url,aborted:true}),continue:async options=>outcomes.push({url,...options})});}},url:()=> 'https://ucl.zoom.us/webinar/register/id',waitForTimeout:async()=>{},locator:()=>({innerText:async()=> 'Webinar Registration\nRegister'})};
 const context={route:async(_,fn)=>handler=fn,newPage:async()=>page,close:async()=>closed++};
 const result=await observeAvailability('https://ucl.zoom.us/webinar/register/id',{browserFactory:async()=>({newContext:async()=>context,close:async()=>closed++})});
 assert.equal(result.status,'registration-form-open');assert.equal(result.metrics.blockedRequests,3);assert.equal(outcomes[0].headers.cookie,undefined);assert.equal(outcomes[0].headers.authorization,undefined);assert.equal(closed,2);
});

test('reader request history retains repeated URL reads and counts cache hits without redating source evidence',async t=>{
 const {mkdtemp,readdir,readFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const path=await import('node:path');
 const {saveEvidenceRecord}=await import('../scripts/read_source.mjs');
 const {digest}=await import('../scripts/lib/source_access.mjs');
 const directory=await mkdtemp(path.join(tmpdir(),'source-history-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const url='https://example.org/workshop',checkedAt='2026-11-16T07:30:00Z',now=Date.parse('2026-11-27T08:00:00Z');
 const first=await saveEvidenceRecord({url,ok:true,checkedAt,requestMetrics:{requests:1,cacheHits:0,failures:0,bytes:100}},directory,now);
 const second=await saveEvidenceRecord({url,ok:true,checkedAt,cacheState:'cached-needs-reverification',requestMetrics:{requests:0,cacheHits:1,failures:0,bytes:0}},directory,now+1000);
 const files=await readdir(path.join(directory,'requests'));assert.equal(files.length,2);assert.notEqual(first.requestId,second.requestId);
 const history=await Promise.all(files.map(f=>readFile(path.join(directory,'requests',f),'utf8').then(JSON.parse)));
 assert.equal(history.reduce((sum,r)=>sum+r.requestMetrics.requests,0),1);assert.equal(history.reduce((sum,r)=>sum+r.requestMetrics.cacheHits,0),1);
 assert.ok(history.every(r=>r.checkedAt===checkedAt && Date.parse(r.recordedAt)>=now));
 const latest=JSON.parse(await readFile(path.join(directory,digest(url)+'.extracted.json'),'utf8'));
 assert.equal(latest.requestId,second.requestId);assert.equal(latest.checkedAt,checkedAt);assert.equal(latest.recordedAt,'2026-11-27T08:00:01.000Z');
});
