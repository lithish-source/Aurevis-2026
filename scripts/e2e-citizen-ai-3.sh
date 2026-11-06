#!/bin/bash
# E2E round 3 (focused): photo upload through the UI.
cd /home/z/my-project
OUT=download/ai-report-tests

pkill -f "next dev" 2>/dev/null; pkill -f next-server 2>/dev/null; sleep 1
setsid nohup node node_modules/.bin/next dev -p 3000 > dev.log 2>&1 < /dev/null &
for i in $(seq 1 40); do sleep 2; code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:3000/ 2>/dev/null); [ "$code" = "200" ] && break; done
echo "SERVER: $code"
curl -s -X POST http://127.0.0.1:3000/api/citizen/report -H "content-type: application/json" -d @/tmp/warm-photo.json -o /dev/null
echo "models warm"

AB="agent-browser"
$AB set viewport 405 850
$AB open http://127.0.0.1:3000/
$AB wait --load networkidle
sleep 5
$AB eval "navigator.geolocation.getCurrentPosition = (ok) => ok({ coords: { latitude: 13.0356, longitude: 80.156, accuracy: 24 }, timestamp: Date.now() }); 'gps mocked'"
$AB eval "[...document.querySelectorAll('button')].find(b => b.textContent.includes('See something')).click(); 'clicked'"
sleep 2
$AB find label "Describe the incident" fill "Massive waterlogging under the bridge near Porur, autos and buses stuck, water not draining at all"
sleep 1

# expose the hidden file input so the a11y snapshot picks it up
$AB eval "var i=document.querySelector('input[type=file]'); i.classList.remove('hidden'); i.setAttribute('aria-label','Pick photo'); 'exposed'"
$AB snapshot > /tmp/snap3.txt 2>&1
grep -nE "Choose|Pick photo|file" /tmp/snap3.txt | head -5
REF='@'$(grep -E 'Pick photo' /tmp/snap3.txt | grep -oE 'e[0-9]+' | head -1)
echo "REF=$REF"
if [ -n "$REF" ]; then
  $AB upload "$REF" /home/z/my-project/scripts/models/traffic-jam.jpg 2>&1
else
  echo "no ref found"; grep -c "button" /tmp/snap3.txt
fi
sleep 2.5
$AB eval "document.body.innerText.includes('YOLO will scan') ? 'PHOTO ATTACHED' : 'PHOTO MISSING'"
$AB screenshot $OUT/ui-03-form-filled.png

$AB find role button click --name "Send report"
for i in $(seq 1 30); do
  sleep 2
  DONE=$($AB eval "document.body.innerText.toLowerCase().includes('ai severity analysis') ? 'DONE' : 'wait'" 2>/dev/null)
  [ "$DONE" = '"DONE"' ] && { echo "RESULT after ~$((i*2))s"; break; }
done
$AB screenshot $OUT/ui-05-result-photo.png
$AB eval "var t = document.body.innerText; JSON.stringify({ yoloRow: t.includes('Photo · YOLO'), cars: (t.match(/\\d+ cars?/) || ['none'])[0], people: (t.match(/\\d+ people?/) || ['none'])[0], place: (t.match(/Porur Junction/) || ['?'])[0], score: (t.match(/0\\.\\d\\d/) || ['?'])[0] })"

echo "=== E2E-3 COMPLETE ==="
