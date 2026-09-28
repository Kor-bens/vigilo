const KEY = "vigilo-watchlist-v1";
const $ = (id) => document.getElementById(id);

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || seed(); }
  catch { return seed(); }
}
function save(list) { localStorage.setItem(KEY, JSON.stringify(list)); }

function seed() {
  const list = [
    { id: crypto.randomUUID(), label: "exemple.com", url: "https://example.com", status: "nouveau", lastScan: null, snapshot: "", lastDiff: "" },
    { id: crypto.randomUUID(), label: "Wikipedia — SaaS", url: "https://en.wikipedia.org/wiki/Software_as_a_service", status: "nouveau", lastScan: null, snapshot: "", lastDiff: "" }
  ];
  save(list);
  return list;
}

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 2800);
}

function shortDiff(oldText, newText) {
  const a = new Set(oldText.split(/\s+/).filter(Boolean));
  const b = new Set(newText.split(/\s+/).filter(Boolean));
  const added = [...b].filter(w => !a.has(w)).slice(0, 40);
  const removed = [...a].filter(w => !b.has(w)).slice(0, 40);
  if (!added.length && !removed.length) return "Aucun changement textuel notable.";
  let out = "";
  if (removed.length) out += "SUPPRIMÉ : " + removed.join(" ") + "\n\n";
  if (added.length) out += "AJOUTÉ : " + added.join(" ");
  return out.trim();
}

async function fetchSnapshot(url) {
  const target = url.startsWith("http") ? url : "https://" + url;
  const res = await fetch("https://r.jina.ai/" + target);
  if (!res.ok) throw new Error("Fetch " + res.status);
  const text = await res.text();
  return text.replace(/\s+/g, " ").trim().slice(0, 20000);
}

async function scanItem(item) {
  item.status = "scan…";
  render();
  try {
    const snap = await fetchSnapshot(item.url);
    if (item.snapshot) {
      item.lastDiff = shortDiff(item.snapshot, snap);
      item.status = item.lastDiff.startsWith("Aucun") ? "stable" : "changé";
    } else {
      item.lastDiff = "Premier snapshot enregistré (" + snap.length + " caractères).";
      item.status = "stable";
    }
    item.snapshot = snap;
    item.lastScan = new Date().toISOString();
  } catch (e) {
    item.status = "erreur";
    item.lastDiff = "Impossible de lire la page (" + e.message + ").";
  }
}

function render() {
  const list = load();
  $("statPages").textContent = list.length;
  $("statChanges").textContent = list.filter(i => i.status === "changé").length;
  $("statStable").textContent = list.filter(i => i.status === "stable").length;
  const last = list.map(i => i.lastScan).filter(Boolean).sort().at(-1);
  $("statLast").textContent = last ? new Date(last).toLocaleString("fr-FR") : "—";
  $("rows").innerHTML = list.map(i => `
    <tr>
      <td><strong>${escapeHtml(i.label)}</strong><br><a href="${escapeHtml(i.url)}" target="_blank" style="color:#8b97a8;font-size:12px">${escapeHtml(i.url)}</a></td>
      <td><span class="tag ${i.status === "changé" ? "tag-chg" : "tag-ok"}">${escapeHtml(i.status)}</span></td>
      <td>${i.lastScan ? new Date(i.lastScan).toLocaleString("fr-FR") : "jamais"}</td>
      <td style="white-space:nowrap">
        <button class="btn" data-scan="${i.id}">Scanner</button>
        <button class="btn" data-diff="${i.id}">Diff</button>
        <button class="btn" data-del="${i.id}">Suppr.</button>
      </td>
    </tr>`).join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&","<":"<",">":">","\"":""","'":"&#39;" }[c]));
}

$("addForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const list = load();
  list.unshift({ id: crypto.randomUUID(), label: $("label").value.trim(), url: $("url").value.trim(), status: "nouveau", lastScan: null, snapshot: "", lastDiff: "" });
  save(list);
  $("addForm").reset();
  render();
  toast("Page ajoutée");
});

document.addEventListener("click", async (e) => {
  const scanId = e.target.dataset.scan;
  const delId = e.target.dataset.del;
  const diffId = e.target.dataset.diff;
  let list = load();
  if (scanId) {
    const item = list.find(i => i.id === scanId);
    await scanItem(item);
    save(list);
    render();
    $("diffOut").textContent = item.lastDiff;
    toast("Scan terminé : " + item.status);
  }
  if (delId) {
    list = list.filter(i => i.id !== delId);
    save(list);
    render();
  }
  if (diffId) {
    const item = list.find(i => i.id === diffId);
    $("diffOut").textContent = item.lastDiff || "Pas encore de diff.";
  }
});

$("scanAll").addEventListener("click", async () => {
  const list = load();
  for (const item of list) await scanItem(item);
  save(list);
  render();
  toast("Scan global terminé");
});

render();
