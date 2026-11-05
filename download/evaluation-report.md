# Social Mobility-Pulse Pipeline — Evaluation Report

Generated 2026-11-05T20:39:10.599Z · corpus: data/social/corpus.jsonl (105 posts)

## Phase 1 — NLP classification (LLM engine)

Corpus: **105 posts** (86 mobility events, 19 noise) · engine mix: llm 105

### Mobility-event detection (isMobility)

| Metric | Value |
|---|---|
| Accuracy | 91.4% (96/105) |
| Precision | 94.3% |
| Recall | 95.3% |
| F1 | 94.8% |

### Event-type classification (mobility posts only)

| Event type | Support | Precision | Recall | F1 |
|---|---|---|---|---|
| congestion | 18 | 80.0% | 88.9% | 84.2% |
| accident | 9 | 80.0% | 88.9% | 84.2% |
| flood | 25 | 100.0% | 92.0% | 95.8% |
| transit_disruption | 28 | 91.7% | 78.6% | 84.6% |
| road_closure | 2 | 50.0% | 50.0% | 50.0% |
| infrastructure | 4 | 100.0% | 50.0% | 66.7% |
| **macro F1** | 86 | | | **77.6%** |
| exact-match accuracy | 86 | | | 83.7% |

### Severity & sentiment

| Task | Exact | Within ±1 level |
|---|---|---|
| Severity | 68.6% | 97.7% |
| Sentiment | 84.9% | — |

### Event-type confusion matrix (rows = truth, cols = predicted)

| | congestion | accident | flood | transit_disruption | road_closure | infrastructure |
|---|---|---|---|---|---|---|
| **congestion** | 16 | 1 | 0 | 0 | 1 | 0 |
| **accident** | 0 | 8 | 0 | 0 | 0 | 0 |
| **flood** | 0 | 0 | 23 | 2 | 0 | 0 |
| **transit_disruption** | 4 | 0 | 0 | 22 | 0 | 0 |
| **road_closure** | 0 | 1 | 0 | 0 | 1 | 0 |
| **infrastructure** | 0 | 0 | 0 | 0 | 0 | 2 |

## Phase 2 — Verification effectiveness (full-pipeline replay)

All scenarios replayed end-to-end (classify → geocode → cluster → trust).

| Group | n | verified | unverified | flagged |
|---|---|---|---|---|
| Rumor / exaggerated posts | 8 | 0 | 5 | 3 |
| True event posts | 78 | 29 | 45 | 4 |

- **Misinformation suppression rate** (rumors NOT shown as verified): **100.0%**
- **True-event confirmation rate** (true posts reaching verified): **37.2%**

### Rumor posts — final pipeline verdict

| id | scenario | verdict | trust | post |
|---|---|---|---|---|
| mf-015 | monsoon-flood | flagged | 23% | BREAKING: ENTIRE OMR SHUT DOWN!!! TCS INFOSYS SENDING EVERYONE HOME!! … |
| mf-019 | monsoon-flood | unverified | 43% | Little Mount metro station FLOODED!! gates closed, trains skipping the… |
| mf-030 | monsoon-flood | unverified | 67% | KATHIPARA FLYOVER COLLAPSED??? CRACKS SEEN!!! AVOID GST ROAD!!! SHARE … |
| mf-038 | monsoon-flood | unverified | 35% | 3 FEET water everywhere in Velachery!! Phoenix mall basement fully sub… |
| mf-044 | monsoon-flood | unverified | 37% | WhatsApp forward says all trains from Chennai Central cancelled tonigh… |
| md-006 | metro-disruption | flagged | 26% | CABLE THEFT at Alandur metro!! POWER FAILURE whole line!! PANIC in pea… |
| md-025 | metro-disruption | flagged | 24% | SECOND failure coming, they know it's the old cables!! whole system wi… |
| oi-010 | omr-incident | unverified | 65% | TRAGIC: CYCLIST DIES in OMR accident at Tidel Park!! IT corridor's dea… |
