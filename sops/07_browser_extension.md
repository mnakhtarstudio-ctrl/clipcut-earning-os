# SOP 07 — Browser Extension (Background)

## Install
1. Chrome → `chrome://extensions` → Developer mode ON  
2. Load unpacked → `extension/` folder from the repo  
3. Pin **ClipCut OS Manager**

## Background behavior
- Daily alarm (default 08:30) → notification “clips left / campaigns”
- Badge = remaining clips toward daily target
- Right-click any post link → **ClipCut OS: Log this link as clip**
- Data stored in `chrome.storage.local` (survives browser restarts)

## Operator loop
1. Click extension when notified  
2. **Brief** tab → open Whop / ClipCut / Intel  
3. **Campaigns** → keep only score ≥ 38  
4. After each post → **Log clip**  
5. Weekly → Export CSV → paste into repo tracker if desired  

## Limits
No auto-post / auto-Whop-submit. Extension is the **background ops console** for the OS.
