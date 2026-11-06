#!/bin/bash
# Final clean E2E: UI report with photo (final thresholds) + admin console view.
cd /home/z/my-project
OUT=download/ai-report-tests

AB="agent-browser"
$AB set viewport 405 850
$AB storage local clear
$AB open http://127.0.0.1:3000/
$AB wait --load networkidle
sleep 5
$AB eval "navigator.geolocation.getCurrentPosition = (ok) => ok({ coords: { latitude: 13.0356, longitude: 80.156, accuracy: 24 }, timestamp: Date.now() }); 'gps mocked'"
$AB eval "[...document.querySelectorAll('button')].find(b => b.textContent.includes('See something')).click(); 'clicked'"
sleep 2.5
$AB screenshot $OUT/final-01-form-autodetected.png
$AB eval "var t=document.body.innerText; 'loc: ' + (t.includes('Porur Junction') ? 'PORUR OK' : 'MISSING') + ' | time: ' + (t.toLowerCase().includes('auto-captured') ? 'OK' : 'MISSING')"

$AB find label "Describe the incident" fill "Massive waterlogging under the bridge near Porur, autos and buses stuck, water not draining at all"
sleep 1
$AB eval "var i=document.querySelector('input[type=file]'); i.classList.remove('hidden'); i.setAttribute('aria-label','Pick photo'); 'exposed'"
$AB snapshot > /tmp/snapF.txt 2>&1
REF='@'$(grep -E 'Pick photo' /tmp/snapF.txt | grep -oE 'e[0-9]+' | head -1)
echo "REF=$REF"
$AB upload "$REF" /home/z/my-project/scripts/models/traffic-jam-640.jpg
sleep 2.5
$AB eval "document.body.innerText.includes('YOLO will scan') ? 'PHOTO OK' : 'PHOTO MISSING'"
$AB screenshot $OUT/final-02-form-filled.png

$AB find role button click --name "Send report"
sleep 3
$AB screenshot $OUT/final-03-analysing.png
for i in $(seq 1 30); do
  sleep 2
  DONE=$($AB eval "document.body.innerText.toLowerCase().includes('ai severity analysis') ? 'DONE' : 'wait'" 2>/dev/null)
  [ "$DONE" = '"DONE"' ] && { echo "RESULT after ~$((i*2+3))s"; break; }
done
$AB screenshot $OUT/final-04-result.png
$AB eval "var t=document.body.innerText; JSON.stringify({ score:(t.match(/0\\.\\d\\d/)||['?'])[0], cars:(t.match(/\\d+ cars?/)||['?'])[0], radius:(t.match(/\\d+ km/)||['?'])[0], bert:t.toLowerCase().includes('description · bert'), yolo:t.toLowerCase().includes('photo · yolo') })"

# admin console
$AB eval "[...document.querySelectorAll('button')].find(b => b.textContent.includes('Admin Console')).click(); 'admin'"
sleep 4
$AB screenshot $OUT/final-05-admin-console.png
$AB eval "var t=document.body.innerText.toLowerCase(); JSON.stringify({ waterloggingReport: t.includes('waterlogging'), openCount: (t.match(/\\d+ open/) || ['?'])[0] })"

echo "=== FINAL E2E COMPLETE ==="
