function send(type, extra = {}) {
  return chrome.runtime.sendMessage({ type, ...extra });
}

async function load() {
  const res = await send("GET_DASHBOARD");
  if (!res?.ok) return;
  const c = res.config;
  const s = res.state;
  operatorName.value = c.operatorName || "";
  defaultAccount.value = c.defaultAccount || "";
  dailyClipTarget.value = c.dailyClipTarget ?? 5;
  minViralScore.value = c.minViralScore ?? 72;
  feePct.value = c.feePct ?? 10;
  reminderHour.value = c.reminderHour ?? 8;
  reminderMinute.value = c.reminderMinute ?? 30;
  notificationsEnabled.checked = c.notificationsEnabled !== false;
  clipcutUrl.value = c.clipcutUrl || "";
  whopUrl.value = c.whopUrl || "";
  badgeMode.value = s.badgeMode || "remaining";
}

save.addEventListener("click", async () => {
  await send("SET_CONFIG", {
    payload: {
      operatorName: operatorName.value,
      defaultAccount: defaultAccount.value,
      dailyClipTarget: Number(dailyClipTarget.value),
      minViralScore: Number(minViralScore.value),
      feePct: Number(feePct.value),
      reminderHour: Number(reminderHour.value),
      reminderMinute: Number(reminderMinute.value),
      notificationsEnabled: notificationsEnabled.checked,
      clipcutUrl: clipcutUrl.value,
      whopUrl: whopUrl.value
    }
  });
  await send("SET_STATE", { payload: { badgeMode: badgeMode.value } });
  msg.textContent = "Saved. Background alarms rescheduled.";
});

load();
