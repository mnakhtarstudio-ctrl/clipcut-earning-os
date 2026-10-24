#!/usr/bin/env python3
"""ClipCut OS v2 Earnings Estimator (with 10% fee)"""
def main():
    print("=== ClipCut OS v2 – Net Earnings Calculator (Oct 2026) ===\n")
    clips = float(input("Clips posted per day: ") or 8)
    avg_views = float(input("Avg views per approved clip: ") or 12000)
    gross_cpm = float(input("Gross CPM ($/1k): ") or 1.15)
    approval = float(input("Approval rate %: ") or 70) / 100
    fee = float(input("Platform fee % (default 10): ") or 10) / 100
    days = float(input("Active days/month: ") or 26)

    gross_daily = clips * (avg_views / 1000) * gross_cpm * approval
    net_daily = gross_daily * (1 - fee)
    monthly_net = net_daily * days

    print(f"\n--- Results ---")
    print(f"Gross daily:  ${gross_daily:,.2f}")
    print(f"Net daily:    ${net_daily:,.2f}  (after {fee*100:.0f}% fee)")
    print(f"Monthly net:  ${monthly_net:,.2f}")
    print(f"\nBreak-even:")
    for plan, cost in [("Creator $9", 9), ("Clipper $15", 15), ("Pro $30", 30)]:
        print(f"  {plan}: ~{cost / (net_daily or 0.01):.1f} days")
    print("\nTip: Raise viral score filter + focus higher CPM niches to improve both views and approval.")
if __name__ == "__main__":
    main()
