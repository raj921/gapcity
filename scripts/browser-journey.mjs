// Run inside ego-browser nodejs, using one existing agent-owned TaskSpace.
// testGapCityJourney(spaceId,pageLabel) tests sample UI without provider credits.
async function testGapCityJourney(spaceId,pageLabel){
  const {default:assert}=await import('node:assert/strict');
  const p=(await taskSpace(spaceId)).page(pageLabel),passed=[];
  const ok=name=>{passed.push(name);console.log('PASS',name);};
  const read=()=>p.evaluate(()=>({count:document.querySelector('.summary-grid strong')?.textContent,category:document.querySelector('#business-type').value,caption:document.querySelector('.coordinate-caption').textContent,pending:!!document.querySelector('.pending-banner'),source:document.querySelector('.source-pill').textContent,reviews:document.querySelectorAll('.review-card').length,overflow:document.documentElement.scrollWidth>innerWidth}));
  const reset=()=>p.click('loc=css:.search-extras > button');
  await p.goto('http://127.0.0.1:3010');
  await p.waitForSelector('.search-pin',{timeout:35000});
  await p.waitForFunction(()=>document.querySelector('.summary-grid strong')?.textContent==='49');
  assert.equal((await read()).overflow,false);ok('Initial sample and map');
  const calls=await p.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.name.endsWith('/api/zones')).length);
  await p.click('loc=css:.search-pin');await p.keyboard.press('ArrowRight');await p.waitForSelector('.pending-banner');
  assert.notEqual((await read()).caption,'16.5062° N · 80.6480° E');await reset();ok('Pin keyboard nudge and reset');
  await p.click('loc=css:.search-pin');const r=await p.evaluate(()=>document.querySelector('.search-pin').getBoundingClientRect().toJSON());
  await p.mouse.move(r.x+22,r.y+22);await p.mouse.down();await p.mouse.move(r.x+82,r.y-20,{steps:15});await p.mouse.up();
  await p.waitForSelector('.pending-banner');assert.notEqual((await read()).caption,'16.5062° N · 80.6480° E');await reset();ok('Native pin drag');
  await p.click('loc=css:button[aria-label="Pick a centre on the map"]');const canvas=await p.evaluate(()=>document.querySelector('.map-canvas canvas').getBoundingClientRect().toJSON());await p.mouse.click(canvas.x+140,canvas.y+220,{label:'Place preview pin on the map'});
  await p.waitForSelector('.pending-banner');assert.equal(await p.evaluate(()=>document.querySelector('.picking-banner')===null),true);await reset();ok('Click-to-place pin');
  assert.equal(await p.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.name.endsWith('/api/zones')).length),calls);ok('Preview changes do not trigger a search');
  await p.click('loc=css:.coordinate-editor summary');await p.fill('loc=css:.coordinate-editor input[min="-70"]','71');await p.click('loc=css:.coordinate-editor .secondary-button');
  assert.match(await p.evaluate(()=>document.querySelector('.coordinate-editor .error-message').textContent),/latitude/);
  await p.fill('loc=css:.coordinate-editor input[min="-70"]','16.5082');await p.fill('loc=css:.coordinate-editor input[min="-180"]','80.649');await p.click('loc=css:.coordinate-editor .secondary-button');
  assert.match((await read()).caption,/16.5082/);await reset();await p.click('loc=css:.coordinate-editor summary');ok('Manual coordinates validate and preview');
  await p.selectOption('loc=css:#business-type','custom');await p.fill('loc=css:input[aria-label="Custom business type"]','Pet grooming');assert.equal((await read()).category,'custom');
  await p.selectOption('loc=css:#business-type','Bakeries');await p.press('loc=css:#radius','Home');for(let i=0;i<4;i++)await p.press('loc=css:#radius','ArrowRight');
  await p.click('loc=css:.primary-button');await p.waitForFunction(()=>!document.querySelector('.primary-button').disabled);
  assert.equal((await read()).pending,false);assert.notEqual((await read()).count,'49');assert.match(await p.evaluate(()=>document.querySelector('.map-context strong').textContent),/Bakeries/);ok('Category options, custom type, radius and completed search');
  await p.selectOption('loc=css:#business-type','Cafes');await p.press('loc=css:#radius','Home');for(let i=0;i<14;i++)await p.press('loc=css:#radius','ArrowRight');await p.click('loc=css:.primary-button');
  await p.waitForFunction(()=>document.querySelector('.summary-grid strong')?.textContent==='49'&&!document.querySelector('.primary-button').disabled);
  await p.click('loc=css:.compare-toggle');assert.equal(await p.evaluate(()=>document.querySelectorAll('.area-comparison tbody tr').length),3);ok('Area comparison uses three existing zones');
  await p.click('loc=css:button[aria-label="Inspect recommended area 1"]');await p.waitForSelector('.review-card',{timeout:20000});assert.equal((await read()).reviews,8);
  await p.click('loc=css:.evidence-content > .secondary-button');assert.equal((await read()).reviews,16);
  await p.click('loc=css:.theme-row:first-child');assert.equal((await read()).reviews,8);await p.click('loc=css:.section-heading .text-button');ok('Zone evidence, review expansion and theme reset');
  await p.click('loc=css:.area-guidance .secondary-button');assert.equal((await read()).pending,true);await reset();ok('Recommended area can become next search centre');
  await p.click('loc=css:#businesses-tab');await p.fill('loc=css:#competitor-filter','Cafe 10');assert.equal(await p.evaluate(()=>document.querySelectorAll('.business-row').length),1);
  await p.click('loc=css:.business-row');await p.waitForSelector('.review-card',{timeout:20000});assert.match(await p.evaluate(()=>document.querySelector('.evidence-content h2').textContent),/Cafe 10/);
  await p.fill('loc=css:#competitor-filter','not-a-real-name');assert.equal(await p.evaluate(()=>document.querySelectorAll('.business-row').length),0);await p.fill('loc=css:#competitor-filter','');
  await p.selectOption('loc=css:select[aria-label="Sort competitors"]','reviews');const own=await p.evaluate(()=>document.querySelector('#own-business option:nth-child(2)').value);await p.selectOption('loc=css:#own-business',own);assert.ok(await p.evaluate(()=>document.querySelector('.comparison')?.textContent.includes('peer average')));ok('Competitor filtering, profile, sorting and own-business comparison');
  await p.click('loc=css:button[aria-label="How the analysis works"]');assert.equal(await p.evaluate(()=>document.querySelector('dialog').open),true);await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.querySelector('dialog').open),false);ok('Methodology dialog keyboard dismissal');
  const downloadPromise=p.waitForEvent('download',{timeout:30000});await p.click('loc=css:.report-button');const download=await downloadPromise;await download.saveAs('/Users/rajkumar/Desktop/gapcity/recordings/browser-journey-export.json');ok('Actual report download');
  await p.click('loc=css:button[aria-label="Close evidence"]');assert.equal(await p.evaluate(()=>document.querySelector('.evidence-content')===null),true);
  await p.click('loc=css:#zones-tab');await p.press('loc=css:#zones-tab','ArrowRight');assert.equal(await p.evaluate(()=>document.activeElement.id),'businesses-tab');await p.press('loc=css:#businesses-tab','ArrowLeft');ok('Close evidence and arrow-key result tabs');
  await p.click('loc=css:.map-controls button:first-child');assert.equal(await p.evaluate(()=>document.querySelector('.map-controls button').textContent),'2D');await p.click('loc=css:button[aria-label="Inspect 3D buildings at street level"]');
  await p.click('loc=css:.layer-control > button');await p.click('loc=css:.layer-options label:first-child input');await p.click('loc=css:.layer-options label:first-child input');await p.click('loc=css:.layer-control > button');
  await p.click('loc=css:button[aria-label="Point map north"]');await p.click('loc=css:button[aria-label="Zoom in"]');await p.click('loc=css:button[aria-label="Zoom out"]');await p.click('loc=css:button[aria-label="Fit the preview radius"]');ok('2D, street buildings, layers, north, zoom and fit');
  console.log(JSON.stringify({journey:'passed',checks:passed.length,passed,state:await read()}));
}

// Access code is an argument; never log it or commit it to this file.
async function testGapCityLive(spaceId,pageLabel,code){
  const {default:assert}=await import('node:assert/strict');const p=(await taskSpace(spaceId)).page(pageLabel);
  await p.click('loc=css:.mode-select button:last-child');await p.fill('loc=css:#live-access','incorrect-test-code');await p.click('loc=css:.primary-button');
  await p.waitForSelector('.search-section > .error-message',{timeout:15000});assert.equal(await p.evaluate(()=>document.querySelector('.source-pill').textContent),'Sample data');assert.equal(await p.evaluate(()=>document.querySelector('.summary-grid strong').textContent),'49');console.log('PASS Incorrect live access preserves sample result');
  await p.fill('loc=css:#live-access',code);await p.click('loc=css:.primary-button');await p.waitForFunction(()=>document.querySelector('.source-pill')?.textContent==='SerpApi data',undefined,{timeout:45000});
  const count=await p.evaluate(()=>Number(document.querySelector('.summary-grid strong').textContent));assert.ok(count>0);console.log('PASS Real protected live search',count);
  await p.click('loc=css:button[aria-label="Inspect recommended area 1"]');await p.waitForSelector('.review-card',{timeout:45000});assert.ok(await p.evaluate(()=>document.querySelectorAll('.review-card a[href^="https://"]').length)>0);console.log('PASS Live recommended area and linked reviews');
  await p.click('loc=css:.evidence-content > .secondary-button');assert.equal(await p.evaluate(()=>document.querySelectorAll('.review-card').length),16);console.log('PASS Live review expansion');
  const downloadPromise=p.waitForEvent('download',{timeout:30000});await p.click('loc=css:.report-button');const download=await downloadPromise;await download.saveAs('/Users/rajkumar/Desktop/gapcity/recordings/browser-live-ux-export.json');console.log('PASS Real live report download');
}

async function testGapCityKeyboard(spaceId,pageLabel){
  const {default:assert}=await import('node:assert/strict');const p=(await taskSpace(spaceId)).page(pageLabel);
  await p.goto('http://127.0.0.1:3010');await p.waitForSelector('.search-pin',{timeout:35000});await p.waitForFunction(()=>document.querySelector('.summary-grid strong')?.textContent==='49');
  async function tabTo(selector){for(let i=0;i<90;i++){if(await p.evaluate(s=>document.activeElement?.matches(s),selector))return;await p.keyboard.press('Tab');}throw Error(`Keyboard could not reach ${selector}`);}
  await tabTo('#business-type');await p.keyboard.press('r');await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>document.querySelector('#business-type').value),'Restaurants');
  await tabTo('.primary-button');await p.keyboard.press('Enter');await p.waitForFunction(()=>document.querySelector('.map-context strong')?.textContent.includes('Restaurants')&&!document.querySelector('.primary-button').disabled);console.log('PASS Keyboard-only category and search');
  await tabTo('.zone-card');await p.keyboard.press('Enter');await p.waitForSelector('.review-card',{timeout:20000});console.log('PASS Keyboard-only area inspection');
  await tabTo('.search-pin');await p.keyboard.press('ArrowUp');await p.waitForSelector('.pending-banner');await tabTo('.search-extras > button');await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>!!document.querySelector('.pending-banner')),false);console.log('PASS Keyboard-only pin movement and reset');
  await tabTo('.theme-row');await p.keyboard.press('Enter');assert.ok(await p.evaluate(()=>!!document.querySelector('.theme-row.active')));console.log('PASS Keyboard-only evidence filtering');
  await tabTo('button[aria-label="How the analysis works"]');await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>document.querySelector('dialog').open),true);await p.keyboard.press('Escape');console.log('PASS Keyboard-only methodology and Escape');
  await tabTo('.report-button');const downloadPromise=p.waitForEvent('download',{timeout:30000});await p.keyboard.press('Enter');await (await downloadPromise).saveAs('/Users/rajkumar/Desktop/gapcity/recordings/browser-keyboard-export.json');console.log('PASS Keyboard-only export');
}

async function testGapCityPhone(spaceId,pageLabel,width=390){
 const {default:assert}=await import('node:assert/strict');const p=(await taskSpace(spaceId)).page(pageLabel);
 await p.cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await p.cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await p.evaluate(()=>scrollTo(0,0));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const sourceButtons=await p.evaluate(()=>[...document.querySelectorAll('.mode-select button')].map(b=>b.getBoundingClientRect().height));assert.ok(sourceButtons.every(h=>h>=44));
 await p.screenshot({path:'/Users/rajkumar/Desktop/gapcity/docs/phone-ux-qa.png'});
 await p.click('loc=css:button[aria-label="Fit the preview radius"]');await p.click('loc=css:.search-pin');const r=await p.evaluate(()=>document.querySelector('.search-pin').getBoundingClientRect().toJSON());const before=await p.evaluate(()=>document.querySelector('.coordinate-caption').textContent);
 await p.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+22,y:r.y+22}]});for(let i=1;i<=10;i++)await p.cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+22+i*4,y:r.y+22-i*3}]});await p.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.notEqual(await p.evaluate(()=>document.querySelector('.coordinate-caption').textContent),before);assert.ok(await p.evaluate(()=>!!document.querySelector('.pending-banner')));console.log('PASS Phone one-finger pin drag');
 await p.evaluate(()=>scrollTo(0,0));await p.click('loc=css:.search-extras > button');await p.click('loc=css:button[aria-label="Inspect recommended area 1"]');await p.waitForFunction(()=>document.querySelector('#evidence-panel').getBoundingClientRect().top<40,undefined,{timeout:8000});
 await p.screenshot({path:'/Users/rajkumar/Desktop/gapcity/docs/phone-evidence-ux-qa.png'});await p.click('loc=css:.map-return');await p.waitForFunction(()=>Math.abs(document.querySelector('#district-map').getBoundingClientRect().top)<5);console.log('PASS Phone area, evidence and Back to map');
 await p.cdp('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});await p.evaluate(()=>scrollTo(0,0));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:'/Users/rajkumar/Desktop/gapcity/docs/phone-375-ux-qa.png'});console.log('PASS Phone 390px/375px layout and action targets');
}

// The missing-shortlist regression: small, expanded and relocated search circles.
async function testGapCityCircles(spaceId,pageLabel){
  const {default:assert}=await import('node:assert/strict');
  const p=(await taskSpace(spaceId)).page(pageLabel);
  const read=()=>p.evaluate(()=>({count:Number(document.querySelector('.summary-grid strong').textContent),areas:document.querySelectorAll('.zone-card').length,tab:document.querySelector('[role="tab"][aria-selected="true"]').id,cards:Array.from(document.querySelectorAll('.zone-card')).map(x=>x.textContent),caption:document.querySelector('.coordinate-caption').textContent}));
  const search=async()=>{await p.evaluate(()=>scrollTo(0,0));await p.click('loc=css:.primary-button');await p.waitForFunction(()=>!document.querySelector('.primary-button').disabled,undefined,{timeout:15000});assert.equal(await p.evaluate(()=>!!document.querySelector('.search-section > .error-message')),false);};
  await p.goto('http://127.0.0.1:3010');await p.waitForFunction(()=>document.querySelector('.summary-grid strong')?.textContent==='49',undefined,{timeout:15000});
  await p.click('loc=css:#businesses-tab');await p.press('loc=css:#radius','Home');await search();
  const tiny=await read();assert.equal(tiny.areas,1);assert.equal(tiny.count,0);assert.equal(tiny.tab,'zones-tab');assert.match(tiny.cards[0],/Site visit.*unscored/s);console.log('PASS 100m empty circle shows an unscored site-visit area and reopens recommendations');
  await p.click('loc=css:button[aria-label="Inspect recommended area 1"]');await p.waitForSelector('.evidence-source',{timeout:15000});assert.match(await p.evaluate(()=>document.querySelector('.area-guidance').textContent),/No listings/);assert.match(await p.evaluate(()=>document.querySelector('.zone-score').textContent),/Not enough data/);assert.equal(await p.evaluate(()=>document.querySelectorAll('.review-card').length),0);console.log('PASS Empty-circle area opens honest guidance without invented reviews');
  await p.evaluate(()=>scrollTo(0,0));await p.press('loc=css:#radius','End');await search();const expanded=await read();assert.equal(expanded.areas,3);assert.equal(expanded.count,49);assert.ok(expanded.cards.every(c=>c.includes('/100')));console.log('PASS Expanding to 5km restores three review-supported areas');
  await p.evaluate(()=>scrollTo(0,0));await p.click('loc=css:.coordinate-editor summary');await p.fill('loc=css:.coordinate-editor input[min="-70"]','16.54');await p.evaluate(()=>scrollTo(0,0));await p.fill('loc=css:.coordinate-editor input[min="-180"]','80.70');await p.evaluate(()=>scrollTo(0,0));await p.click('loc=css:.coordinate-editor .secondary-button');await p.click('loc=css:.coordinate-editor summary');await p.press('loc=css:#radius','Home');await search();
  const moved=await read();assert.equal(moved.areas,1);assert.match(moved.cards[0],/16\.5400, 80\.7000/);assert.match(moved.caption,/16\.5400/);assert.equal(await p.evaluate(()=>!!document.querySelector('.pending-banner')),false);console.log('PASS Relocating the pin produces a shortlist for the new circle');
  await p.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await p.evaluate(()=>scrollTo(0,0));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.click('loc=css:button[aria-label="Inspect recommended area 1"]');await p.waitForSelector('.evidence-source',{timeout:15000});assert.match(await p.evaluate(()=>document.querySelector('.area-guidance').textContent),/No listings/);console.log('PASS Phone layout and empty-area inspection');
  await p.cdp('Emulation.clearDeviceMetricsOverride');await p.evaluate(()=>scrollTo(0,0));
}
