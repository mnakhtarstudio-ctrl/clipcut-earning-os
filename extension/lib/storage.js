/** Shared storage defaults for ClipCut OS Manager extension */

export const DEFAULT_CONFIG = {
  operatorName: "Operator",
  defaultAccount: "Main_TikTok",
  feePct: 10,
  minViralScore: 72,
  dailyClipTarget: 5,
  timezone: "Asia/Kolkata",
  reminderHour: 8,
  reminderMinute: 30,
  notificationsEnabled: true,
  clipcutUrl: "https://www.clipcut.pro",
  whopUrl: "https://whop.com",
  intelUrls: [
    "https://whop.com",
    "https://clippingalpha.com",
    "https://clippingatlas.xyz/campaigns"
  ]
};

export const DEFAULT_STATE = {
  campaigns: [],
  clips: [],
  lastDailyBriefAt: null,
  badgeMode: "remaining" // remaining | pending | off
};

export async function getConfig() {
  const { config } = await chrome.storage.local.get("config");
  return { ...DEFAULT_CONFIG, ...(config || {}) };
}

export async function setConfig(partial) {
  const config = { ...(await getConfig()), ...partial };
  await chrome.storage.local.set({ config });
  return config;
}

export async function getState() {
  const { state } = await chrome.storage.local.get("state");
  return { ...DEFAULT_STATE, ...(state || {}) };
}

export async function setState(partial) {
  const state = { ...(await getState()), ...partial };
  await chrome.storage.local.set({ state });
  return state;
}

export function calcNet(views, cpm, feePct) {
  const gross = (Number(views) / 1000) * Number(cpm);
  return Math.round(gross * (1 - Number(feePct) / 100) * 100) / 100;
}

export function scoreCampaign({ cpm, budgetLeft, clippers, minViews, sourceQuality, rulesClarity }) {
  const sCpm = cpm < 0.8 ? 2 : cpm < 1.5 ? 6 : cpm < 2.5 ? 9 : 10;
  const sBud = budgetLeft < 2000 ? 2 : budgetLeft < 10000 ? 6 : budgetLeft < 30000 ? 9 : 10;
  const sComp = clippers > 200 ? 2 : clippers > 50 ? 5 : clippers > 10 ? 9 : 10;
  const sMin = minViews > 10000 ? 2 : minViews > 3000 ? 5 : minViews > 0 ? 9 : 10;
  const sSrc = Math.max(1, Math.min(10, sourceQuality || 7));
  const sRules = Math.max(1, Math.min(10, rulesClarity || 7));
  const total = sCpm + sBud + sComp + sMin + sSrc + sRules;
  const decision =
    total >= 45 ? "PRIORITY — join now" : total >= 38 ? "ACCEPTABLE — join if capacity" : "SKIP";
  return {
    scores: { cpm: sCpm, budget: sBud, competition: sComp, minViews: sMin, sourceQuality: sSrc, rulesClarity: sRules },
    total,
    decision
  };
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function clipsToday() {
  const state = await getState();
  const t = todayISO();
  return (state.clips || []).filter((c) => c.date === t);
}
