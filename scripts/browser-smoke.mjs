// Load this file into an Ego nodejs round, then call checkGapCityMap(spaceId, pageLabel).
async function checkGapCityMap(spaceId,pageLabel="p2",url="http://127.0.0.1:3010"){
const {default:assert}=await import('node:assert/strict');
const task=await taskSpace(spaceId);
const page=task.page(pageLabel);
await page.goto(url);
await page.waitForSelector('.map-geometry-note',{timeout:35000});
await page.waitForFunction(()=>document.querySelector('.summary-grid strong')?.textContent==='49');
const state=await page.evaluate(()=>({
  source:document.querySelector('.source-pill').textContent,
  mapHeight:document.querySelector('.map-canvas').getBoundingClientRect().height,
  canvasHeight:document.querySelector('.map-canvas canvas').getBoundingClientRect().height,
  overflow:document.documentElement.scrollWidth>innerWidth
}));
assert.equal(state.source,'Sample data');
assert.ok(state.mapHeight>=500,'Map container collapsed after CDN CSS loaded.');
assert.ok(Math.abs(state.mapHeight-state.canvasHeight)<2,'Canvas does not fill the map container.');
assert.equal(state.overflow,false);
await page.click('loc=css:.map-controls button:first-child');
await page.waitForFunction(()=>document.querySelector('.map-controls button').textContent==='2D');
console.log({browserSmoke:'passed',...state});
}
