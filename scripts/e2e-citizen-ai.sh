#!/bin/bash
# Full E2E for the AI citizen-report feature, in ONE invocation (the sandbox
# reaps background servers between tool calls, so server + browser flow must
# share this script's lifetime).
set -x
cd /home/z/my-project

OUT=download/ai-report-tests
mkdir -p $OUT

# ── 1. start the dev server ────────────────────────────────────────────────
pkill -f "next dev" 2>/dev/null
pkill -f next-server 2>/dev/null
sleep 1
setsid nohup node node_modules/.bin/next dev -p 3000 > dev.log 2>&1 < /dev/null &
for i in $(seq 1 40); do
  sleep 2
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
done
echo "SERVER UP: $code"

# ── 2. warm the models (first request loads BERT+YOLO into RAM) ───────────
echo "— warming models —"
curl -s -X POST http://127.0.0.1:3000/api/citizen/report -H "content-type: application/json" \
  -d '{"text":"Warming request: slight delay near the signal, traffic moving slowly","lat":13.0418,"lon":80.2341}' | head -c 200
echo ""
python3 -c "
import base64, json
b64 = base64.b64encode(open('scripts/models/traffic-jam-640.jpg','rb').read()).decode()
body = {'text':'Warming request two: heavy queue of vehicles on this stretch','lat':12.9016,'lon':80.2279,'imageBase64':'data:image/jpeg;base64,'+b64}
open('/tmp/warm-photo.json','w').write(json.dumps(body))
"
curl -s -X POST http://127.0.0.1:3000/api/citizen/report -H "content-type: application/json" -d @/tmp/warm-photo.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('warm2 engines:', d.get('ai',{}).get('engines'))"
free -m | head -2

# ── 3. browser E2E ─────────────────────────────────────────────────────────
AB="agent-browser"
$AB set viewport 405 850
$AB open http://127.0.0.1:3000/
$AB wait --load networkidle
sleep 5
$AB eval "document.body.innerText.includes('See something') ? 'HOME LOADED' : ('NOT LOADED: ' + document.body.innerText.slice(0,60))"

# geolocation: Porur junction (13.0356, 80.156)
$AB set geo 13.0356 80.156

# open the report overlay
$AB eval "[...document.querySelectorAll('button')].find(b => b.textContent.includes('See something')).click(); 'clicked'"
sleep 2
$AB eval "document.body.innerText.includes('Report an incident') ? 'OVERLAY OPEN' : 'OVERLAY CLOSED'"
$AB screenshot $OUT/ui-02-report-form.png

# check the auto-detected location card
$AB eval "var t = document.body.innerText; (t.includes('Auto-detected location') ? 'LOC-CARD OK; ' : 'LOC-CARD MISSING; ') + (t.match(/Porur[^\\n]*/) || ['no porur'])[0] + ' | ' + (t.includes('auto-captured') ? 'TIME OK' : 'TIME MISSING')"

# fill the description
$AB find label "Describe the incident" fill "Huge waterlogging under the bridge, autos stuck, water not draining at all"
sleep 1

# attach the photo: expose the hidden file input, upload, restore
$AB eval "var i=document.querySelector('input[type=file]'); i.classList.remove('hidden'); i.style.display='block'; 'input exposed'"
$AB snapshot -i -c > /tmp/snap.txt 2>&1
grep -o 'textbox\|upload\|file' /tmp/snap.txt | head -3
REF=$(grep -oE '@e[0-9]+' /tmp/snap.txt | tail -1)
echo "file input ref guess: $REF"
$AB upload "$REF" /home/z/my-project/scripts/models/traffic-jam.jpg 2>&1 || echo "UPLOAD FAILED"
sleep 2
$AB eval "document.querySelector('input[type=file]').style.display='none'; document.body.innerText.includes('YOLO will scan') ? 'PHOTO ATTACHED' : 'no photo preview'"
$AB screenshot $OUT/ui-03-form-filled.png

# submit
$AB find role button click --name "Send report"
sleep 3
$AB screenshot $OUT/ui-04-analysing.png
$AB eval "document.body.innerText.includes('Analysing your report') ? 'ANALYSING SHOWN' : 'no analysing screen'"

# wait for the result (BERT+YOLO+pipeline, generous timeout)
for i in $(seq 1 30); do
  sleep 2
  DONE=$($AB eval "document.body.innerText.includes('AI severity analysis') ? 'DONE' : 'wait'" 2>/dev/null)
  echo "poll $i: $DONE"
  [ "$DONE" = '"DONE"' ] && break
done
$AB screenshot $OUT/ui-05-result.png
$AB eval "var t=document.body.innerText; 'severity shown: ' + ((t.match(/(low|medium|high|critical)\\n/) || ['?'])[0]) + ' | BERT: ' + (t.includes('Description · BERT') ? 'yes' : 'no') + ' | YOLO: ' + (t.includes('Photo · YOLO') ? 'yes' : 'no')"

# view my alerts
$AB find role button click --name "View my alerts"
sleep 3
$AB screenshot $OUT/ui-06-alerts.png
$AB eval "document.body.innerText.includes('Waterlogging') || document.body.innerText.includes('Waterlog') ? 'NOTIFICATION PRESENT' : 'notification not found'"

echo "=== E2E COMPLETE ==="
free -m | head -2
