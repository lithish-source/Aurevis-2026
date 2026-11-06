#!/bin/bash
# E2E round 2: GPS-provider mock (tests the auto-detect code path end-to-end),
# photo upload via CSS selector, case-insensitive result checks.
cd /home/z/my-project
OUT=download/ai-report-tests
mkdir -p $OUT

# ── server ──────────────────────────────────────────────────────────────────
pkill -f "next dev" 2>/dev/null; pkill -f next-server 2>/dev/null; sleep 1
setsid nohup node node_modules/.bin/next dev -p 3000 > dev.log 2>&1 < /dev/null &
for i in $(seq 1 40); do sleep 2; code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:3000/ 2>/dev/null); [ "$code" = "200" ] && break; done
echo "SERVER: $code"

# warm models (photo request → BERT+YOLO both loaded)
curl -s -X POST http://127.0.0.1:3000/api/citizen/report -H "content-type: application/json" -d @/tmp/warm-photo.json | python3 -c "import json,sys; print('warm engines:', json.load(sys.stdin).get('ai',{}).get('engines'))"

AB="agent-browser"
$AB set viewport 405 850
$AB open http://127.0.0.1:3000/
$AB wait --load networkidle
sleep 5

# mock the GPS provider BEFORE the overlay mounts its detector
$AB eval "navigator.geolocation.getCurrentPosition = (ok) => ok({ coords: { latitude: 13.0356, longitude: 80.156, accuracy: 24 }, timestamp: Date.now() }); 'gps mocked'"

# open the report overlay
$AB eval "[...document.querySelectorAll('button')].find(b => b.textContent.includes('See something')).click(); 'clicked'"
sleep 2.5
$AB eval "var t = document.body.innerText; 'LOC: ' + ((t.match(/Porur Junction/) || ['NOT PORUR'])[0]) + ' | gps-chip: ' + (t.includes('re-detect') ? 'GPS OK' : 'fallback shown') + ' | accuracy: ' + (t.includes('±24 m') ? 'OK' : 'MISSING')"
$AB screenshot $OUT/ui-02-report-form-gps.png

# fill the description
$AB find label "Describe the incident" fill "Massive waterlogging under the bridge near Porur, autos and buses stuck, water not draining at all"
sleep 1
$AB eval "document.querySelector('textarea').value.length + ' chars in textarea'"

# attach the photo via CSS selector
$AB find first "input[type=file]" upload /home/z/my-project/scripts/models/traffic-jam.jpg 2>&1
sleep 2.5
$AB eval "document.body.innerText.includes('YOLO will scan') ? 'PHOTO ATTACHED' : 'PHOTO MISSING'"
$AB screenshot $OUT/ui-03-form-filled.png

# submit
$AB find role button click --name "Send report"
sleep 2
$AB eval "document.body.innerText.toLowerCase().includes('analysing your report') ? 'ANALYSING SHOWN' : 'analysing not visible (may have finished)'"
$AB screenshot $OUT/ui-04-analysing.png

# wait for the result screen (case-insensitive)
for i in $(seq 1 30); do
  sleep 2
  DONE=$($AB eval "document.body.innerText.toLowerCase().includes('ai severity analysis') ? 'DONE' : 'wait'" 2>/dev/null)
  [ "$DONE" = '"DONE"' ] && { echo "RESULT after ~$((i*2))s"; break; }
done
$AB screenshot $OUT/ui-05-result.png
$AB eval "var t = document.body.innerText.toLowerCase(); JSON.stringify({ bert: t.includes('description · bert'), yolo: t.includes('photo · yolo'), fusion: t.includes('combined severity'), place: (t.match(/porur junction/) || ['no-place'])[0], cars: (t.match(/\\d+ cars/) || ['no-cars'])[0] })"

# alerts
$AB find role button click --name "View my alerts"
sleep 3
$AB screenshot $OUT/ui-06-alerts.png

echo "=== E2E-2 COMPLETE ==="
