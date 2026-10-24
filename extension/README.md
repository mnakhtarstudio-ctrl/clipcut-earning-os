# ClipCut OS Manager — Browser Extension (MV3)

Background-capable Chrome/Edge extension for the ClipCut Earning Operating System.

## What runs in the background
- **Service worker** (`background/service-worker.js`)
  - Daily reminder alarm (default 08:30 local)
  - Badge refresh every 15 minutes (clips remaining / pending)
  - Context menu: “Log this link as clip”
  - Message bus for popup / options
  - Local campaign registry + clip tracker (chrome.storage.local)
  - Net earnings after fee %
  - CSV export

## What it does **not** do (by design)
- Does not auto-post to TikTok
- Does not auto-submit to Whop (no public clipper API / ToS)
- Does not scrape private dashboards aggressively
- Content script on Whop only adds a floating launcher

## Install (Chrome / Edge / Brave)
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this `extension/` folder
4. Pin **ClipCut OS Manager**
5. Open popup → Settings → set your name / daily target / reminder

## Daily operator flow
1. Background notifies at reminder time
2. Badge shows clips remaining
3. Join campaigns on Whop → **Campaigns** tab → add if new
4. ClipCut → post → **Log clip** (or right-click post link → Log)
5. Export CSV into repo `data/earnings_tracker.csv` when needed

## Files
```
extension/
  manifest.json
  background/service-worker.js
  lib/storage.js
  popup/
  options/
  content/whop-helper.js
  icons/
```

## Sync with Python connector
Export CSV from the extension, then merge into `data/earnings_tracker.csv`,  
or log in both places while scaling.

## Permissions (why)
| Permission | Why |
|------------|-----|
| storage | campaigns + clips + config |
| alarms | daily reminder + badge |
| notifications | morning run alert |
| contextMenus | right-click log link |
| host_permissions | open Whop/ClipCut/intel + optional helper |

Version: **1.0.0**
