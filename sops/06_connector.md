# SOP 06 — System Connector

The **Connector** is the operational bridge between all ClipCut OS layers.

## What it connects
| Layer | Connector role |
|-------|----------------|
| Research | Daily brief + intel links |
| Strategy | Campaign add / score / list registry |
| Production | Min viral score + caption templates |
| Distribution | Links + post logging |
| Finance | Tracker log / update / summary |

## Install / run
```bash
cd clipcut-earning-os
python tools/connector.py init
python tools/connector.py daily
```

## Daily flow (manager-approved)
1. `python tools/connector.py daily` — open brief
2. Join campaigns on Whop → `python tools/connector.py campaign add`
3. Clip in ClipCut → post → `python tools/connector.py log`
4. When views update → `python tools/connector.py update`
5. End of day → `python tools/connector.py status` + `summary`

## Commands
| Command | Purpose |
|---------|---------|
| `init` | Create config + empty data files |
| `status` | Snapshot of campaigns + tracker |
| `daily` | Morning operating brief |
| `campaign add` | Register + auto-score campaign (60-pt) |
| `campaign list` | Ranked campaign registry |
| `campaign score` | Score without saving |
| `log` | Append clip to earnings_tracker.csv |
| `update` | Update views / approval status + net $ |
| `summary` | Net earnings by campaign |
| `caption` | Hook templates |
| `links` | ClipCut / Whop / intel boards |

## Config
Edit `data/connector_config.json`:
- `operator_name`, `default_account`
- `default_fee_pct` (10)
- `min_viral_score` (72)
- `daily_clip_target` (5)

## Limits (honest)
- No official public Whop clipper API for auto-submit — you still submit links in Whop UI
- Connector does **not** auto-post to TikTok (platform ToS)
- It **does** connect your OS: scoring, logging, daily ops, net math

## Manager note
Use the connector every session. Report `campaign list` + `summary` back for strategy updates.
