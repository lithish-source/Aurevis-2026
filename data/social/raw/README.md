# Real datasets (optional)

The prototype ships with a synthetic Chennai corpus (`scripts/corpus/scenarios.mjs`).
Drop real labeled datasets here and `bun scripts/corpus/build-corpus.mjs` will merge
them into `data/social/corpus.jsonl` automatically.

## Supported formats

### 1. Generic JSONL — `*.jsonl`, one post per line

```json
{"text": "Waterlogging at Kathipara junction, buses stuck", "source": "twitter",
 "author": {"handle": "@someone", "accountAgeDays": 800, "followers": 300, "verified": false},
 "tOffsetMin": 5,
 "labels": {"isMobility": true, "eventType": "flood", "severity": "medium", "sentiment": "negative", "isRumor": false}}
```

- `source`: twitter | reddit | instagram | facebook | telegram | news | official
- `tOffsetMin`: minutes from scenario start (default: 3 min per post)
- `labels` are ground truth for evaluation only — the pipeline never sees them.

### 2. CrisisLex CSV — `crisislex_*.csv`

Standard CrisisLexT26 format (`Tweet ID, Tweet Text, " Information Type", …`).
Only "Related and informative" tweets are kept; the event type is inferred from
the filename (flood/storm → flood, collapse/derail → infrastructure, fire → hazard…).

## Where to download real datasets

| Dataset | Labels | URL |
|---|---|---|
| CrisisLexT26 | informativeness per crisis event | https://crisislex.org/crisis-lex-t26.html |
| CrisisNLP (multiple) | humanitarian info types | https://crisisnlp.qcri.org/ |
| PHEME rumour dataset | rumour / non-rumour + veracity | https://figshare.com/articles/dataset/PHEME_dataset_for_Rumour_Detection_and_Veracity_Classification/6392078 |
| RumourEval 2017/19 | rumour detection & stance | http://alt.qcri.org/rumoureval2017/ , rumoureval2019 |
| TREC-IS incident streams | incident type labels | https://trecis.org/ (datasets tab) |
| Kaggle Chennai floods / India traffic | varies | search "Chennai flood tweets", "India traffic tweets" |

PHEME/RumourEval: export the rumour source tweets + replies to the generic JSONL
format above (set `labels.isRumor` from the thread annotation; keep `isMobility`
true for event-related threads) — the loader will pick them up.

For a Twitter/Reddit live connector instead of replay, see
`download/social-pipeline-guide.md` (free APIs: Reddit PRAW, Telegram t.me/s
web preview, Google News RSS, GDELT, Bluesky Jetstream).
