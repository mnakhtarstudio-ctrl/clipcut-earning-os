#!/usr/bin/env python3
"""
ClipCut OS — System Connector v1.0
==================================
Connects Research → Strategy → Production → Distribution → Finance layers.

Usage:
  python tools/connector.py init
  python tools/connector.py status
  python tools/connector.py campaign add
  python tools/connector.py campaign list
  python tools/connector.py campaign score
  python tools/connector.py log
  python tools/connector.py update
  python tools/connector.py daily
  python tools/connector.py summary
  python tools/connector.py caption
  python tools/connector.py links
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# Resolve project root (parent of tools/)
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CONFIG_PATH = DATA / "connector_config.json"
CAMPAIGNS_PATH = DATA / "campaigns.json"
TRACKER_PATH = DATA / "earnings_tracker.csv"
SOURCES_PATH = DATA / "source_bank.json"

TRACKER_HEADERS = [
    "Date", "Account", "Campaign", "Source_Video", "Clip_Title", "Viral_Score",
    "Platform", "Post_Link", "Status", "Views", "CPM_Gross", "Fee_Pct",
    "Est_Net_USD", "Notes",
]

DEFAULT_CONFIG = {
    "operator_name": "Operator",
    "default_account": "Main_TikTok",
    "default_fee_pct": 10.0,
    "min_viral_score": 72,
    "daily_clip_target": 5,
    "timezone": "Asia/Kolkata",
    "clipcut_url": "https://www.clipcut.pro",
    "whop_url": "https://whop.com",
    "intel_urls": [
        "https://whop.com",
        "https://clippingalpha.com",
        "https://clippingatlas.xyz/campaigns",
    ],
}


def ensure_data_dir() -> None:
    DATA.mkdir(parents=True, exist_ok=True)


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: Any) -> None:
    ensure_data_dir()
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def load_config() -> Dict[str, Any]:
    ensure_data_dir()
    if not CONFIG_PATH.exists():
        save_json(CONFIG_PATH, DEFAULT_CONFIG)
        return dict(DEFAULT_CONFIG)
    cfg = load_json(CONFIG_PATH, DEFAULT_CONFIG)
    for k, v in DEFAULT_CONFIG.items():
        cfg.setdefault(k, v)
    return cfg


def ensure_tracker() -> None:
    ensure_data_dir()
    if not TRACKER_PATH.exists():
        with TRACKER_PATH.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=TRACKER_HEADERS)
            writer.writeheader()


def read_tracker() -> List[Dict[str, str]]:
    ensure_tracker()
    with TRACKER_PATH.open("r", newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def append_tracker(row: Dict[str, Any]) -> None:
    ensure_tracker()
    # Normalize all fields to strings
    out = {h: str(row.get(h, "")) for h in TRACKER_HEADERS}
    with TRACKER_PATH.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=TRACKER_HEADERS)
        writer.writerow(out)


def rewrite_tracker(rows: List[Dict[str, str]]) -> None:
    ensure_tracker()
    with TRACKER_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=TRACKER_HEADERS)
        writer.writeheader()
        for r in rows:
            writer.writerow({h: r.get(h, "") for h in TRACKER_HEADERS})


def calc_net(views: float, cpm: float, fee_pct: float) -> float:
    gross = (views / 1000.0) * cpm
    return round(gross * (1.0 - fee_pct / 100.0), 2)


def score_campaign(
    cpm: float,
    budget_left: float,
    clippers: int,
    min_views: float,
    source_quality: int,
    rules_clarity: int,
) -> Dict[str, Any]:
    """60-point scorecard used by the OS."""
    # CPM 1-10
    if cpm < 0.8:
        s_cpm = 2
    elif cpm < 1.5:
        s_cpm = 6
    else:
        s_cpm = 9 if cpm < 2.5 else 10

    # Budget 1-10
    if budget_left < 2000:
        s_bud = 2
    elif budget_left < 10000:
        s_bud = 6
    else:
        s_bud = 9 if budget_left < 30000 else 10

    # Competition (fewer clippers = better)
    if clippers > 200:
        s_comp = 2
    elif clippers > 50:
        s_comp = 5
    else:
        s_comp = 9 if clippers > 10 else 10

    # Min views threshold
    if min_views > 10000:
        s_min = 2
    elif min_views > 3000:
        s_min = 5
    else:
        s_min = 9 if min_views > 0 else 10

    s_src = max(1, min(10, source_quality))
    s_rules = max(1, min(10, rules_clarity))

    total = s_cpm + s_bud + s_comp + s_min + s_src + s_rules
    if total >= 45:
        decision = "PRIORITY — join now"
    elif total >= 38:
        decision = "ACCEPTABLE — join if capacity"
    else:
        decision = "SKIP"

    return {
        "scores": {
            "cpm": s_cpm,
            "budget": s_bud,
            "competition": s_comp,
            "min_views": s_min,
            "source_quality": s_src,
            "rules_clarity": s_rules,
        },
        "total": total,
        "max": 60,
        "decision": decision,
    }


def cmd_init(_: argparse.Namespace) -> None:
    ensure_data_dir()
    cfg = load_config()
    if not CAMPAIGNS_PATH.exists():
        save_json(CAMPAIGNS_PATH, {"campaigns": []})
    if not SOURCES_PATH.exists():
        save_json(SOURCES_PATH, {"sources": []})
    ensure_tracker()
    print("✅ ClipCut OS Connector initialized")
    print(f"   Root:     {ROOT}")
    print(f"   Config:   {CONFIG_PATH}")
    print(f"   Campaigns:{CAMPAIGNS_PATH}")
    print(f"   Tracker:  {TRACKER_PATH}")
    print(f"   Operator: {cfg.get('operator_name')}")
    print("\nNext: python tools/connector.py daily")


def cmd_status(_: argparse.Namespace) -> None:
    cfg = load_config()
    campaigns = load_json(CAMPAIGNS_PATH, {"campaigns": []}).get("campaigns", [])
    rows = read_tracker()
    active = [c for c in campaigns if c.get("status", "active") == "active"]
    pending = [r for r in rows if r.get("Status", "").lower() == "pending"]
    approved = [r for r in rows if r.get("Status", "").lower() == "approved"]
    total_net = 0.0
    for r in rows:
        try:
            total_net += float(r.get("Est_Net_USD") or 0)
        except ValueError:
            pass

    print("═══ ClipCut OS Connector — STATUS ═══")
    print(f"Operator:        {cfg.get('operator_name')}")
    print(f"Default account: {cfg.get('default_account')}")
    print(f"Fee %:           {cfg.get('default_fee_pct')}")
    print(f"Min viral score: {cfg.get('min_viral_score')}")
    print(f"Daily target:    {cfg.get('daily_clip_target')} clips")
    print(f"Active campaigns:{len(active)} / {len(campaigns)}")
    print(f"Tracker rows:    {len(rows)}")
    print(f"  Pending:       {len(pending)}")
    print(f"  Approved:      {len(approved)}")
    print(f"Est. net total:  ${total_net:,.2f}")
    print("════════════════════════════════════")


def cmd_campaign_add(_: argparse.Namespace) -> None:
    cfg = load_config()
    print("Add campaign to connector registry")
    name = input("Campaign name: ").strip()
    if not name:
        print("Aborted — name required")
        return
    platform = input("Platform [Whop]: ").strip() or "Whop"
    niche = input("Niche (gaming/podcast/finance/...): ").strip() or "general"
    try:
        cpm = float(input("Gross CPM $/1K [1.25]: ").strip() or "1.25")
        budget = float(input("Budget left $ [5000]: ").strip() or "5000")
        clippers = int(input("Clippers count [50]: ").strip() or "50")
        min_views = float(input("Min views threshold [1000]: ").strip() or "1000")
        src_q = int(input("Source quality 1-10 [7]: ").strip() or "7")
        rules_q = int(input("Rules clarity 1-10 [7]: ").strip() or "7")
    except ValueError:
        print("Invalid number — aborted")
        return
    tiktok = input("TikTok allowed? [y/N]: ").strip().lower().startswith("y")
    notes = input("Notes / source links: ").strip()

    result = score_campaign(cpm, budget, clippers, min_views, src_q, rules_q)
    entry = {
        "id": f"cmp_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        "name": name,
        "platform": platform,
        "niche": niche,
        "cpm_gross": cpm,
        "budget_left": budget,
        "clippers": clippers,
        "min_views": min_views,
        "source_quality": src_q,
        "rules_clarity": rules_q,
        "tiktok_allowed": tiktok,
        "score_total": result["total"],
        "decision": result["decision"],
        "scores": result["scores"],
        "status": "active" if result["total"] >= 38 else "watch",
        "notes": notes,
        "added_at": datetime.utcnow().isoformat() + "Z",
        "fee_pct": cfg.get("default_fee_pct", 10.0),
    }

    data = load_json(CAMPAIGNS_PATH, {"campaigns": []})
    data.setdefault("campaigns", []).append(entry)
    save_json(CAMPAIGNS_PATH, data)

    print(f"\n✅ Saved: {name}")
    print(f"   Score: {result['total']}/60 → {result['decision']}")
    print(f"   Net CPM ≈ ${cpm * (1 - cfg.get('default_fee_pct', 10)/100):.2f}")


def cmd_campaign_list(_: argparse.Namespace) -> None:
    data = load_json(CAMPAIGNS_PATH, {"campaigns": []})
    campaigns = data.get("campaigns", [])
    if not campaigns:
        print("No campaigns yet. Run: python tools/connector.py campaign add")
        return
    print(f"{'Name':<32} {'CPM':>6} {'Budget':>8} {'Score':>5} {'Status':<10} Decision")
    print("-" * 90)
    for c in sorted(campaigns, key=lambda x: -x.get("score_total", 0)):
        print(
            f"{c.get('name','')[:32]:<32} "
            f"${c.get('cpm_gross',0):>5.2f} "
            f"${c.get('budget_left',0):>7.0f} "
            f"{c.get('score_total',0):>4}/60 "
            f"{c.get('status',''):<10} "
            f"{c.get('decision','')}"
        )


def cmd_campaign_score(_: argparse.Namespace) -> None:
    print("Quick score a campaign (does not save unless you add it)")
    try:
        cpm = float(input("Gross CPM: ").strip())
        budget = float(input("Budget left $: ").strip())
        clippers = int(input("Clippers: ").strip())
        min_views = float(input("Min views: ").strip() or "0")
        src_q = int(input("Source quality 1-10: ").strip() or "7")
        rules_q = int(input("Rules clarity 1-10: ").strip() or "7")
    except ValueError:
        print("Invalid input")
        return
    r = score_campaign(cpm, budget, clippers, min_views, src_q, rules_q)
    print(f"\nTotal: {r['total']}/60")
    for k, v in r["scores"].items():
        print(f"  {k}: {v}/10")
    print(f"Decision: {r['decision']}")


def cmd_log(_: argparse.Namespace) -> None:
    cfg = load_config()
    campaigns = load_json(CAMPAIGNS_PATH, {"campaigns": []}).get("campaigns", [])
    print("Log a posted clip into the tracker")
    account = input(f"Account [{cfg.get('default_account')}]: ").strip() or cfg.get("default_account")
    if campaigns:
        print("Active campaigns:")
        for i, c in enumerate(campaigns, 1):
            if c.get("status") == "active":
                print(f"  {i}. {c.get('name')} (${c.get('cpm_gross')}/1K)")
    campaign = input("Campaign name: ").strip()
    source = input("Source video title/URL: ").strip()
    title = input("Clip title / hook: ").strip()
    try:
        score = int(input(f"Viral score [{cfg.get('min_viral_score')}]: ").strip() or str(cfg.get("min_viral_score")))
    except ValueError:
        score = int(cfg.get("min_viral_score", 72))
    platform = input("Platform [TikTok]: ").strip() or "TikTok"
    link = input("Post link: ").strip()
    # Find CPM from registry if possible
    cpm = cfg.get("default_cpm", 1.25)
    fee = float(cfg.get("default_fee_pct", 10))
    for c in campaigns:
        if c.get("name", "").lower() == campaign.lower():
            cpm = float(c.get("cpm_gross", cpm))
            fee = float(c.get("fee_pct", fee))
            break
    try:
        cpm_in = input(f"Gross CPM [{cpm}]: ").strip()
        if cpm_in:
            cpm = float(cpm_in)
    except ValueError:
        pass

    net = calc_net(0, cpm, fee)  # 0 views yet
    row = {
        "Date": date.today().isoformat(),
        "Account": account,
        "Campaign": campaign,
        "Source_Video": source,
        "Clip_Title": title,
        "Viral_Score": score,
        "Platform": platform,
        "Post_Link": link,
        "Status": "Pending",
        "Views": "0",
        "CPM_Gross": cpm,
        "Fee_Pct": fee,
        "Est_Net_USD": "0.00",
        "Notes": "logged-via-connector",
    }
    append_tracker(row)
    print(f"\n✅ Logged: {title or campaign} | score {score} | pending")
    if score < int(cfg.get("min_viral_score", 72)):
        print(f"⚠ Score below min ({cfg.get('min_viral_score')}) — consider filtering harder next batch")


def cmd_update(_: argparse.Namespace) -> None:
    rows = read_tracker()
    if not rows:
        print("Tracker empty")
        return
    print("Recent clips:")
    for i, r in enumerate(rows[-15:], start=max(0, len(rows) - 15)):
        print(f"  [{i}] {r.get('Date')} | {r.get('Campaign')[:20]} | {r.get('Clip_Title')[:24]} | {r.get('Status')} | {r.get('Views')} views")
    try:
        idx = int(input("Row index to update: ").strip())
        row = rows[idx]
    except (ValueError, IndexError):
        print("Invalid index")
        return
    status = input(f"Status [{row.get('Status')}] (Pending/Approved/Rejected): ").strip() or row.get("Status")
    views_s = input(f"Views [{row.get('Views')}]: ").strip() or row.get("Views")
    try:
        views = float(views_s or 0)
        cpm = float(row.get("CPM_Gross") or 1.25)
        fee = float(row.get("Fee_Pct") or 10)
    except ValueError:
        print("Bad numbers")
        return
    net = calc_net(views, cpm, fee)
    row["Status"] = status
    row["Views"] = str(int(views)) if views == int(views) else str(views)
    row["Est_Net_USD"] = f"{net:.2f}"
    note = input("Notes (optional): ").strip()
    if note:
        row["Notes"] = note
    rows[idx] = row
    rewrite_tracker(rows)
    print(f"✅ Updated → {status} | {views} views | net ${net:.2f}")


def cmd_daily(_: argparse.Namespace) -> None:
    cfg = load_config()
    campaigns = load_json(CAMPAIGNS_PATH, {"campaigns": []}).get("campaigns", [])
    rows = read_tracker()
    today = date.today().isoformat()
    today_rows = [r for r in rows if r.get("Date") == today]
    active = [c for c in campaigns if c.get("status") == "active"]
    target = int(cfg.get("daily_clip_target", 5))

    print("╔══════════════════════════════════════════════╗")
    print("║     CLIP CUT OS — DAILY CONNECTOR BRIEF      ║")
    print("╚══════════════════════════════════════════════╝")
    print(f"Date: {today}  |  Operator: {cfg.get('operator_name')}")
    print()
    print("① RESEARCH")
    print("   Read Daily Research Agent report (08:30 IST)")
    print("   Open intel boards:")
    for u in cfg.get("intel_urls", []):
        print(f"   · {u}")
    print()
    print("② STRATEGY — Active campaigns")
    if not active:
        print("   ⚠ None registered. Run: python tools/connector.py campaign add")
    else:
        for c in sorted(active, key=lambda x: -x.get("score_total", 0))[:5]:
            print(f"   · {c.get('name')} | ${c.get('cpm_gross')}/1K | score {c.get('score_total')}/60")
    print()
    print("③ PRODUCTION")
    print(f"   ClipCut: {cfg.get('clipcut_url')}")
    print(f"   Keep viral score ≥ {cfg.get('min_viral_score')}")
    print(f"   Target today: {target} clips")
    print(f"   Logged today: {len(today_rows)}")
    print()
    print("④ DISTRIBUTION")
    print("   Post TikTok first → Reels/Shorts → submit Whop immediately")
    print(f"   Whop: {cfg.get('whop_url')}")
    print()
    print("⑤ FINANCE")
    print("   Log each clip:  python tools/connector.py log")
    print("   Update views:   python tools/connector.py update")
    print("   Full status:    python tools/connector.py status")
    print()
    remaining = max(0, target - len(today_rows))
    if remaining:
        print(f"▶ ACTION: Produce & log {remaining} more clip(s) today.")
    else:
        print("▶ Daily target hit. Update pending views / review approvals.")
    print("══════════════════════════════════════════════")


def cmd_summary(_: argparse.Namespace) -> None:
    rows = read_tracker()
    if not rows:
        print("No data yet")
        return
    by_campaign: Dict[str, Dict[str, float]] = {}
    total_net = 0.0
    total_views = 0.0
    for r in rows:
        camp = r.get("Campaign") or "Unknown"
        try:
            views = float(r.get("Views") or 0)
            net = float(r.get("Est_Net_USD") or 0)
        except ValueError:
            views, net = 0.0, 0.0
        by_campaign.setdefault(camp, {"clips": 0, "views": 0.0, "net": 0.0})
        by_campaign[camp]["clips"] += 1
        by_campaign[camp]["views"] += views
        by_campaign[camp]["net"] += net
        total_net += net
        total_views += views

    print("═══ EARNINGS SUMMARY (from tracker) ═══")
    print(f"{'Campaign':<30} {'Clips':>5} {'Views':>10} {'Net $':>10}")
    print("-" * 60)
    for camp, s in sorted(by_campaign.items(), key=lambda x: -x[1]["net"]):
        print(f"{camp[:30]:<30} {int(s['clips']):>5} {int(s['views']):>10} ${s['net']:>9.2f}")
    print("-" * 60)
    print(f"{'TOTAL':<30} {len(rows):>5} {int(total_views):>10} ${total_net:>9.2f}")


def cmd_caption(_: argparse.Namespace) -> None:
    hooks = [
        "The moment he said this changed everything…",
        "Nobody talks about this part…",
        "I wasn’t ready for what came next…",
        "This is why 99% fail…",
        "Wait for the last 5 seconds…",
        "They laughed until he showed the proof…",
        "This 30-second clip will save you years…",
    ]
    print("Caption templates (copy-paste)\n")
    for i, h in enumerate(hooks, 1):
        print(f"--- Template {i} ---")
        print(f"{h}\n")
        print("Key moment from the source.\n")
        print("[PASTE EXACT CAMPAIGN HASHTAGS + CTA HERE]\n")


def cmd_links(_: argparse.Namespace) -> None:
    cfg = load_config()
    print("═══ CONNECTED LINKS ═══")
    print(f"ClipCut:  {cfg.get('clipcut_url')}")
    print(f"Whop:     {cfg.get('whop_url')}")
    print("Intel:")
    for u in cfg.get("intel_urls", []):
        print(f"  · {u}")
    print(f"\nRepo system path: {ROOT}")
    print("GitHub: https://github.com/mnakhtarstudio-ctrl/clipcut-earning-os")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="connector",
        description="ClipCut OS System Connector — wires all layers together",
    )
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("init", help="Initialize config + data files").set_defaults(func=cmd_init)
    sub.add_parser("status", help="System status dashboard").set_defaults(func=cmd_status)
    sub.add_parser("daily", help="Daily operating brief").set_defaults(func=cmd_daily)
    sub.add_parser("summary", help="Earnings summary from tracker").set_defaults(func=cmd_summary)
    sub.add_parser("caption", help="Print caption templates").set_defaults(func=cmd_caption)
    sub.add_parser("links", help="Print connected tool links").set_defaults(func=cmd_links)
    sub.add_parser("log", help="Log a new clip post").set_defaults(func=cmd_log)
    sub.add_parser("update", help="Update views/status on a clip").set_defaults(func=cmd_update)

    camp = sub.add_parser("campaign", help="Campaign registry")
    camp_sub = camp.add_subparsers(dest="campaign_cmd", required=True)
    camp_sub.add_parser("add", help="Add + score campaign").set_defaults(func=cmd_campaign_add)
    camp_sub.add_parser("list", help="List campaigns").set_defaults(func=cmd_campaign_list)
    camp_sub.add_parser("score", help="Score without saving").set_defaults(func=cmd_campaign_score)

    return p


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
