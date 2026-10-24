/**
 * ClipCut OS Manager — Background Service Worker
 * Runs continuously (event-driven MV3): alarms, notifications, badge, context menus, message bus.
 */

import {
  getConfig,
  setConfig,
  getState,
  setState,
  calcNet,
  scoreCampaign,
  todayISO,
  clipsToday,
  DEFAULT_CONFIG,
  DEFAULT_STATE
} from "../lib/storage.js";

const ALARM_DAILY = "clipcut_os_daily_reminder";
const ALARM_BADGE = "clipcut_os_badge_refresh";

async function ensureDefaults() {
  const { config, state } = await chrome.storage.local.get(["config", "state"]);
  if (!config) await chrome.storage.local.set({ config: DEFAULT_CONFIG });
  if (!state) {
    // Seed starter campaigns (same priority set as OS connector)
    const seeded = [
      { name: "Clip Farm – Technology", cpm: 2.0, budgetLeft: 37414, clippers: 40, minViews: 1000, niche: "tech" },
      { name: "CoD / Gaming style", cpm: 1.5, budgetLeft: 15000, clippers: 30, minViews: 1000, niche: "gaming" },
      { name: "Clipping Culture – Gaming", cpm: 1.75, budgetLeft: 111935, clippers: 80, minViews: 1000, niche: "gaming" },
      { name: "Pen.Dev Clipping", cpm: 2.5, budgetLeft: 2500, clippers: 20, minViews: 1000, niche: "tech" },
      { name: "DIGGER x ClipFarm", cpm: 1.5, budgetLeft: 17100, clippers: 100, minViews: 1000, niche: "general" },
      { name: "Vest Markets (Finance)", cpm: 4.0, budgetLeft: 2500, clippers: 15, minViews: 2000, niche: "finance" }
    ].map((c, i) => {
      const sc = scoreCampaign({
        cpm: c.cpm,
        budgetLeft: c.budgetLeft,
        clippers: c.clippers,
        minViews: c.minViews,
        sourceQuality: 7,
        rulesClarity: 7
      });
      return {
        id: `seed_${i + 1}`,
        ...c,
        cpm_gross: c.cpm,
        score_total: sc.total,
        decision: sc.decision,
        status: sc.total >= 38 ? "active" : "watch",
        fee_pct: 10,
        added_at: new Date().toISOString()
      };
    });
    await chrome.storage.local.set({
      state: { ...DEFAULT_STATE, campaigns: seeded }
    });
  }
}

function nextReminderWhen(hour, minute) {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime();
}

async function scheduleAlarms() {
  const config = await getConfig();
  await chrome.alarms.clear(ALARM_DAILY);
  await chrome.alarms.clear(ALARM_BADGE);
  // Daily reminder
  await chrome.alarms.create(ALARM_DAILY, {
    when: nextReminderWhen(config.reminderHour ?? 8, config.reminderMinute ?? 30),
    periodInMinutes: 24 * 60
  });
  // Badge refresh every 15 min
  await chrome.alarms.create(ALARM_BADGE, { periodInMinutes: 15 });
}

async function updateBadge() {
  const config = await getConfig();
  const state = await getState();
  const today = await clipsToday();
  const target = config.dailyClipTarget || 5;
  const remaining = Math.max(0, target - today.length);
  const pending = (state.clips || []).filter((c) => (c.status || "").toLowerCase() === "pending").length;

  if (state.badgeMode === "off") {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }
  if (state.badgeMode === "pending") {
    await chrome.action.setBadgeBackgroundColor({ color: pending ? "#f59e0b" : "#10b981" });
    await chrome.action.setBadgeText({ text: pending ? String(pending) : "" });
    return;
  }
  // remaining
  await chrome.action.setBadgeBackgroundColor({ color: remaining ? "#22d3ee" : "#10b981" });
  await chrome.action.setBadgeText({ text: remaining ? String(remaining) : "✓" });
}

async function notifyDaily() {
  const config = await getConfig();
  if (!config.notificationsEnabled) return;
  const today = await clipsToday();
  const remaining = Math.max(0, (config.dailyClipTarget || 5) - today.length);
  const state = await getState();
  const active = (state.campaigns || []).filter((c) => c.status === "active").length;

  await chrome.notifications.create(`daily_${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "ClipCut OS — Daily Run",
    message:
      remaining > 0
        ? `${remaining} clips left today · ${active} active campaigns · Open extension to log & score.`
        : `Daily target hit · ${today.length} clips logged. Update views / approvals.`,
    priority: 2
  });
}

async function addClip(payload) {
  const config = await getConfig();
  const state = await getState();
  const clip = {
    id: `clip_${Date.now()}`,
    date: todayISO(),
    account: payload.account || config.defaultAccount,
    campaign: payload.campaign || "",
    source: payload.source || "",
    title: payload.title || "",
    viralScore: Number(payload.viralScore || config.minViralScore),
    platform: payload.platform || "TikTok",
    postLink: payload.postLink || "",
    status: payload.status || "Pending",
    views: Number(payload.views || 0),
    cpmGross: Number(payload.cpmGross || 1.25),
    feePct: Number(payload.feePct ?? config.feePct),
    estNet: 0,
    notes: payload.notes || "extension",
    createdAt: new Date().toISOString()
  };
  clip.estNet = calcNet(clip.views, clip.cpmGross, clip.feePct);
  state.clips = [...(state.clips || []), clip];
  await setState({ clips: state.clips });
  await updateBadge();
  return clip;
}

async function updateClip(id, patch) {
  const state = await getState();
  const config = await getConfig();
  const clips = (state.clips || []).map((c) => {
    if (c.id !== id) return c;
    const next = { ...c, ...patch };
    const fee = next.feePct ?? config.feePct;
    next.estNet = calcNet(next.views || 0, next.cpmGross || 1.25, fee);
    return next;
  });
  await setState({ clips });
  await updateBadge();
  return clips.find((c) => c.id === id);
}

async function addCampaign(payload) {
  const sc = scoreCampaign({
    cpm: Number(payload.cpm || payload.cpm_gross || 1.25),
    budgetLeft: Number(payload.budgetLeft || payload.budget_left || 0),
    clippers: Number(payload.clippers || 50),
    minViews: Number(payload.minViews || payload.min_views || 1000),
    sourceQuality: Number(payload.sourceQuality || 7),
    rulesClarity: Number(payload.rulesClarity || 7)
  });
  const campaign = {
    id: `cmp_${Date.now()}`,
    name: payload.name || "Untitled",
    niche: payload.niche || "general",
    cpm: Number(payload.cpm || 1.25),
    cpm_gross: Number(payload.cpm || 1.25),
    budgetLeft: Number(payload.budgetLeft || 0),
    clippers: Number(payload.clippers || 0),
    minViews: Number(payload.minViews || 1000),
    score_total: sc.total,
    decision: sc.decision,
    scores: sc.scores,
    status: sc.total >= 38 ? "active" : "watch",
    fee_pct: 10,
    notes: payload.notes || "",
    added_at: new Date().toISOString()
  };
  const state = await getState();
  state.campaigns = [...(state.campaigns || []), campaign];
  await setState({ campaigns: state.campaigns });
  return campaign;
}

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "log_link_as_clip",
      title: "ClipCut OS: Log this link as clip",
      contexts: ["link", "page"]
    });
    chrome.contextMenus.create({
      id: "open_clipcut",
      title: "ClipCut OS: Open ClipCut",
      contexts: ["action"]
    });
    chrome.contextMenus.create({
      id: "open_whop",
      title: "ClipCut OS: Open Whop",
      contexts: ["action"]
    });
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaults();
  await scheduleAlarms();
  setupContextMenus();
  await updateBadge();
  console.log("[ClipCut OS] installed / updated");
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();
  await scheduleAlarms();
  await updateBadge();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_DAILY) {
    await notifyDaily();
    await updateBadge();
  } else if (alarm.name === ALARM_BADGE) {
    await updateBadge();
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "log_link_as_clip") {
    const link = info.linkUrl || info.pageUrl || tab?.url || "";
    await addClip({
      postLink: link,
      title: tab?.title || "Logged from context menu",
      platform: link.includes("tiktok") ? "TikTok" : link.includes("instagram") ? "Instagram" : "Web"
    });
    if (tab?.id) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Clip logged",
        message: "Saved to ClipCut OS tracker (open popup to edit campaign/score)."
      });
    }
  } else if (info.menuItemId === "open_clipcut") {
    const c = await getConfig();
    chrome.tabs.create({ url: c.clipcutUrl });
  } else if (info.menuItemId === "open_whop") {
    const c = await getConfig();
    chrome.tabs.create({ url: c.whopUrl });
  }
});

chrome.notifications.onClicked.addListener(() => {
  chrome.action.openPopup?.();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case "GET_DASHBOARD": {
          const config = await getConfig();
          const state = await getState();
          const today = await clipsToday();
          const remaining = Math.max(0, (config.dailyClipTarget || 5) - today.length);
          const totalNet = (state.clips || []).reduce((s, c) => s + (Number(c.estNet) || 0), 0);
          sendResponse({
            ok: true,
            config,
            state,
            todayCount: today.length,
            remaining,
            totalNet
          });
          break;
        }
        case "ADD_CLIP":
          sendResponse({ ok: true, clip: await addClip(msg.payload || {}) });
          break;
        case "UPDATE_CLIP":
          sendResponse({ ok: true, clip: await updateClip(msg.id, msg.payload || {}) });
          break;
        case "ADD_CAMPAIGN":
          sendResponse({ ok: true, campaign: await addCampaign(msg.payload || {}) });
          break;
        case "SCORE_CAMPAIGN":
          sendResponse({ ok: true, result: scoreCampaign(msg.payload || {}) });
          break;
        case "SET_CONFIG":
          sendResponse({ ok: true, config: await setConfig(msg.payload || {}) });
          await scheduleAlarms();
          await updateBadge();
          break;
        case "SET_STATE":
          sendResponse({ ok: true, state: await setState(msg.payload || {}) });
          await updateBadge();
          break;
        case "EXPORT_CSV": {
          const state = await getState();
          const headers = [
            "Date","Account","Campaign","Source_Video","Clip_Title","Viral_Score","Platform",
            "Post_Link","Status","Views","CPM_Gross","Fee_Pct","Est_Net_USD","Notes"
          ];
          const lines = [headers.join(",")];
          for (const c of state.clips || []) {
            const row = [
              c.date, c.account, c.campaign, c.source, c.title, c.viralScore, c.platform,
              c.postLink, c.status, c.views, c.cpmGross, c.feePct, c.estNet, c.notes
            ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`);
            lines.push(row.join(","));
          }
          sendResponse({ ok: true, csv: lines.join("\n") });
          break;
        }
        case "REFRESH_BADGE":
          await updateBadge();
          sendResponse({ ok: true });
          break;
        case "PING":
          sendResponse({ ok: true, alive: true, ts: Date.now() });
          break;
        default:
          sendResponse({ ok: false, error: "unknown_type" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true; // async
});

// Keep worker responsive
console.log("[ClipCut OS] service worker loaded");
