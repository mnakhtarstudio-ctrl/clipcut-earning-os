const $ = (s) => document.querySelector(s);

function send(type, extra = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...extra }, resolve);
  });
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${name}`));
}

document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => switchTab(t.dataset.tab));
});

function fillCampaigns(campaigns, selectEl) {
  selectEl.innerHTML = "";
  const opts = campaigns.filter((c) => c.status === "active" || true);
  if (!opts.length) {
    selectEl.innerHTML = `<option value="">(no campaigns — add one)</option>`;
    return;
  }
  for (const c of opts.sort((a, b) => (b.score_total || 0) - (a.score_total || 0))) {
    const o = document.createElement("option");
    o.value = c.name;
    o.textContent = `${c.name} · $${c.cpm_gross || c.cpm}/1K · ${c.score_total}/60`;
    o.dataset.cpm = c.cpm_gross || c.cpm;
    selectEl.appendChild(o);
  }
}

function renderCampaignList(campaigns) {
  const box = $("#campaignList");
  box.innerHTML = "";
  const sorted = [...(campaigns || [])].sort((a, b) => (b.score_total || 0) - (a.score_total || 0));
  if (!sorted.length) {
    box.innerHTML = `<div class="item muted">No campaigns yet</div>`;
    return;
  }
  for (const c of sorted) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<strong>${c.name}</strong>
      <span class="score">${c.score_total}/60</span> · $${c.cpm_gross || c.cpm}/1K
      <div class="muted">${c.decision || ""} · ${c.niche || ""}</div>`;
    box.appendChild(div);
  }
}

function renderRecent(clips) {
  const box = $("#recentClips");
  box.innerHTML = "";
  const recent = [...(clips || [])].slice(-8).reverse();
  if (!recent.length) {
    box.innerHTML = `<div class="item muted">No clips logged yet</div>`;
    return;
  }
  for (const c of recent) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<strong>${c.title || c.campaign || "Clip"}</strong>
      <div class="muted">${c.date} · ${c.status} · ${c.views || 0} views · net $${c.estNet || 0}</div>`;
    box.appendChild(div);
  }
}

async function refresh() {
  const res = await send("GET_DASHBOARD");
  if (!res?.ok) {
    $("#ping").textContent = "worker error";
    return;
  }
  const { config, state, todayCount, remaining, totalNet } = res;
  $("#operator").textContent = config.operatorName || "Operator";
  $("#todayCount").textContent = todayCount;
  $("#remaining").textContent = remaining;
  $("#activeCamp").textContent = (state.campaigns || []).filter((c) => c.status === "active").length;
  $("#totalNet").textContent = `$${Number(totalNet || 0).toFixed(0)}`;
  $("#badge-pill").textContent = remaining ? `${remaining} left` : "Target hit";
  $("#minScore").textContent = config.minViralScore;
  $("#account").value = config.defaultAccount || "";
  $("#viralScore").value = config.minViralScore || 72;
  fillCampaigns(state.campaigns || [], $("#campaignSelect"));
  renderCampaignList(state.campaigns || []);
  renderRecent(state.clips || []);

  const sel = $("#campaignSelect");
  const applyCpm = () => {
    const opt = sel.selectedOptions[0];
    if (opt?.dataset?.cpm) $("#cpm").value = opt.dataset.cpm;
  };
  sel.onchange = applyCpm;
  applyCpm();

  const ping = await send("PING");
  $("#ping").textContent = ping?.alive ? "BG online" : "offline";
}

$("#btnLog").addEventListener("click", async () => {
  const payload = {
    campaign: $("#campaignSelect").value,
    title: $("#title").value,
    viralScore: Number($("#viralScore").value),
    cpmGross: Number($("#cpm").value),
    postLink: $("#postLink").value,
    platform: $("#platform").value,
    account: $("#account").value
  };
  const res = await send("ADD_CLIP", { payload });
  $("#logMsg").textContent = res?.ok ? `Logged: ${res.clip.title || res.clip.campaign}` : `Error: ${res?.error}`;
  $("#title").value = "";
  $("#postLink").value = "";
  await refresh();
});

$("#btnAddCamp").addEventListener("click", async () => {
  const payload = {
    name: $("#cName").value,
    cpm: Number($("#cCpm").value),
    budgetLeft: Number($("#cBudget").value),
    clippers: Number($("#cClippers").value),
    minViews: Number($("#cMin").value)
  };
  const res = await send("ADD_CAMPAIGN", { payload });
  $("#campMsg").textContent = res?.ok
    ? `Added ${res.campaign.name} → ${res.campaign.score_total}/60 ${res.campaign.decision}`
    : `Error: ${res?.error}`;
  await refresh();
});

$("#btnWhop").addEventListener("click", async () => {
  const res = await send("GET_DASHBOARD");
  chrome.tabs.create({ url: res.config.whopUrl });
});
$("#btnClipCut").addEventListener("click", async () => {
  const res = await send("GET_DASHBOARD");
  chrome.tabs.create({ url: res.config.clipcutUrl });
});
$("#btnIntel").addEventListener("click", async () => {
  const res = await send("GET_DASHBOARD");
  for (const u of (res.config.intelUrls || []).slice(0, 3)) chrome.tabs.create({ url: u });
});
$("#btnOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("#btnExport").addEventListener("click", async () => {
  const res = await send("EXPORT_CSV");
  if (!res?.ok) return;
  const blob = new Blob([res.csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clipcut-os-clips-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

refresh();
