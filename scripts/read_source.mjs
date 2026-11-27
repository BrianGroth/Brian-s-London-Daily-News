import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EvidenceClient, saveJson, publicUrl, mapLimit, digest } from './lib/source_access.mjs';
import { extractEvidence } from './lib/source_adapters.mjs';
import { resourceContext } from './prepare_daily_brief.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { observeAvailability, availabilityProvider } from './lib/availability.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function sourceOptions(args) {
  const options = { urls: [], refresh: false, format: 'compact', concurrency: 3, availability: false };
  for (let i=0;i<args.length;i++) {
    const arg=args[i];
    if (arg === '--refresh') options.refresh=true;
    else if (arg === '--availability') options.availability=true;
    else if (['--urls','--input','--format','--concurrency'].includes(arg)) {
      if (!args[i+1] || args[i+1].startsWith('--')) throw new Error('Missing value for '+arg);
      const v=args[++i];
      if(arg==='--urls') options.urls.push(...v.split(','));
      else options[arg.slice(2)]=arg==='--concurrency'?Number(v):v;
    } else if (arg.startsWith('--')) throw new Error('Unknown source option '+arg);
    else options.urls.push(arg);
  }
  if (!['compact','full'].includes(options.format) || !Number.isInteger(options.concurrency) || options.concurrency<1 || options.concurrency>4) throw new Error('Use --format compact|full and --concurrency 1–4');
  return options;
}
// Source checkedAt may be old on cache hits; recordedAt measures this reader invocation.
export async function saveEvidenceRecord(record, cacheDir, now = Date.now()) {
  const stored = { ...record, requestId: randomUUID(), recordedAt: new Date(now).toISOString() };
  const requests = path.join(cacheDir, 'requests');
  await mkdir(requests, { recursive: true });
  await writeFile(path.join(requests, stored.requestId + '.json'), JSON.stringify(stored, null, 2) + '\n', { flag: 'wx' });
  await saveJson(path.join(cacheDir, digest(publicUrl(stored.url).href) + '.extracted.json'), stored);
  return stored;
}
export function compactEvidence(record) {
  const { title,published,fields,unknownFields,conflicts,structuredEvents,actions,snippets,note }=record.evidence || {};
  const { textExcerpt: browserText, ...availability } = record.availability || {};
  return { url:record.url,ok:record.ok,status:record.status,error:record.error,checkedAt:record.checkedAt,recordedAt:record.recordedAt,requestId:record.requestId,cacheState:record.cacheState,bodyFile:record.bodyFile,
    evidence:record.evidence?{title,published,fields,unknownFields,conflicts,structuredEvents,actions,snippets,note}:null, availability:record.availability?availability:undefined,metrics:record.metrics };
}
export async function main(args=process.argv.slice(2)) {
  const options=sourceOptions(args);
  if(options.input){const input=JSON.parse(await readFile(path.resolve(root,options.input),'utf8'));const urls=Array.isArray(input)?input:input.urls;if(!Array.isArray(urls)||urls.some(u=>typeof u!=='string'))throw new Error('Input must be a URL array or {urls:[]}');options.urls.push(...urls);}
  options.urls=[...new Set(options.urls.map(u=>publicUrl(u).href))];
  if(!options.urls.length || options.urls.length>24)throw new Error('Provide 1–24 public HTTPS URLs');
  const blocked=resourceContext(await readFile(path.join(root,'resources.html'),'utf8')).blockedResourceDomains;
  for(const url of options.urls){const h=new URL(url).hostname.replace(/^www\./,'');if(blocked.some(d=>h===d||h.endsWith('.'+d)))throw new Error('Source is blocked in resources.html');if(options.availability)availabilityProvider(url);}
  const records=await mapLimit(options.urls,options.concurrency,async url=>{
    // Separate clients make metrics per URL rather than ambiguous overlapping batch totals.
    const client=new EvidenceClient({cacheDir:path.join(root,'.daily-work/evidence'),fetcher:async (value,init)=>{const h=publicUrl(value).hostname.replace(/^www\./,'');if(blocked.some(d=>h===d||h.endsWith('.'+d)))throw new Error('Source is blocked in resources.html');return fetch(value,init);}});
    const result=await client.get(url,{refresh:options.refresh});const {body,...metadata}=result;
    if(result.finalUrl){const h=publicUrl(result.finalUrl).hostname.replace(/^www\./,'');if(blocked.some(d=>h===d||h.endsWith('.'+d)))throw new Error('Redirected source is blocked in resources.html');}
    const record={...metadata,evidence:result.ok?extractEvidence(body,result.finalUrl):null,metrics:{...client.metrics},requestMetrics:{...client.metrics},metricsScope:'Per-request source-reader HTTP metrics; excludes browser/tool/model payload and tokens.'};
    if(options.availability)record.availability=await observeAvailability(url,{blockedDomains:blocked});
    const stored = await saveEvidenceRecord(record, path.join(root,'.daily-work/evidence'));
    if(!result.ok)process.exitCode=1;
    return options.format==='full'?stored:compactEvidence(stored);
  });
  console.log(JSON.stringify(records.length===1?records[0]:{records},null,options.format==='full'?2:undefined));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
