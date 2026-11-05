#!/usr/bin/env bash
# vlmcheck.sh <image> <prompt> — send a screenshot to the vision model for QA.
IMG="$1"
PROMPT="${2:-Describe this mobile app screenshot top to bottom. Note any visual glitches, overlapping elements, empty states, or broken rendering.}"
z-ai vision --image "$IMG" --prompt "$PROMPT" -o /tmp/vlm-out.json 2>/dev/null
python3 -c "
import json
d = json.load(open('/tmp/vlm-out.json'))
print(d['choices'][0]['message']['content'])
"
