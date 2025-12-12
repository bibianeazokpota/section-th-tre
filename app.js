// ===============================
// HASH SHA-256
// ===============================
async function sha256(message) {
  const msg = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msg);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ===============================
// NOTIFICATION BANNER UTIL
// ===============================
function showBanner(msg, type = 'info', timeout = 3000) {
  let b = document.getElementById('banner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'banner';
    document.body.appendChild(b);
  }
  b.className = 'banner show ' + (type || 'info');
  b.innerHTML = `<div class="banner-inner"><div class="banner-message">${msg}</div><button class="banner-close" onclick="hideBanner()">✖</button></div>`;
  if (window._bannerTimeout) clearTimeout(window._bannerTimeout);
  if (timeout && timeout > 0) {
    window._bannerTimeout = setTimeout(() => hideBanner(), timeout);
  }
}
function hideBanner() {
  const b = document.getElementById('banner');
  if (!b) return;
  b.classList.remove('show');
  b.classList.add('hidden');
  if (window._bannerTimeout) { clearTimeout(window._bannerTimeout); window._bannerTimeout = null; }
}

// ===============================
// PWA Install prompt handling
// ===============================
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('beforeinstallprompt event received', e);
  e.preventDefault();
  deferredPrompt = e;
  showBanner('Installation disponible — cliquez sur Installer', 'info', 3500);
  const btn = document.getElementById('installBtn');
  if (btn) btn.classList.remove('hidden');
});

document.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('installBtn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) {
        // diagnostics
        const reasons = [];
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') reasons.push('Non servi en HTTPS');
        if (!('serviceWorker' in navigator)) reasons.push('Service Worker non supporté');
        else {
          try {
            const regs = await navigator.serviceWorker.getRegistrations();
            if (!regs || regs.length === 0) reasons.push('Service Worker non enregistré');
          } catch (e) { console.warn('Erreur vérif SW', e); reasons.push('Impossible de vérifier Service Worker'); }
        }
        try {
          const res = await fetch('manifest.json', {cache: 'no-store'});
          if (!res.ok) reasons.push('manifest.json manquant ou inaccessible');
          else {
            try { const mf = await res.json(); if (!mf || !mf.icons) reasons.push('Manifest: icônes manquantes'); } catch(e){ reasons.push('Manifest invalide'); }
          }
        } catch(e){ reasons.push('Impossible de charger manifest.json'); }

        const message = 'Installation indisponible: ' + (reasons.length ? reasons.join(' • ') : 'Aucun prompt reçu par le navigateur');
        console.warn('PWA install diagnostics:', reasons);
        showBanner(message, 'error', 7000);
        return;
      }

      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') showBanner('Installation acceptée', 'success', 2000);
      else showBanner('Installation annulée', 'info', 2000);
      deferredPrompt = null;
      installBtn.classList.add('hidden');
    });
  }
});

// ===============================
// DONNÉES GLOBALES
// ===============================
let membres = [];

// pending deletion name (used by confirm modal)
let _pendingDelete = null;

let currentPage = Number(localStorage.getItem("currentPage")) || 1;
let pagesData = JSON.parse(localStorage.getItem("pagesData") || "{}");

// création automatique
if (!pagesData[currentPage]) pagesData[currentPage] = {};
let data = pagesData[currentPage];

// ----- Members persistence -----
function loadMembers() {
  try {
    const raw = localStorage.getItem('members');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) {
        membres = arr;
        return;
      }
    }
  } catch (e) {}
  // fallback default
  membres = ["ASSABOU Fadil Cocobe"];
  saveMembers();
}

// ----- Members roles/positions persistence -----
let memberRoles = {};
function loadMemberRoles() {
  try {
    const raw = localStorage.getItem('memberRoles');
    if (raw) memberRoles = JSON.parse(raw) || {};
  } catch (e) { memberRoles = {}; }
}
function saveMemberRoles() {
  try { localStorage.setItem('memberRoles', JSON.stringify(memberRoles)); } catch(e){}
}

// load roles after loading members
loadMemberRoles();

function saveMembers(){
  localStorage.setItem('members', JSON.stringify(membres));
}

// load members now
loadMembers();

// restore theme preference
const _savedTheme = localStorage.getItem('theme');
if (_savedTheme) document.documentElement.setAttribute('data-theme', _savedTheme);

function savePages() {
  localStorage.setItem("pagesData", JSON.stringify(pagesData));
  localStorage.setItem("currentPage", currentPage);
}

// ===============================
// PAGE NAVIGATION HELPERS
// ===============================
function loadPages() {
  const sel = document.getElementById('pageSelector');
  if (!sel) return;
  // determine numeric pages present
  const keys = Object.keys(pagesData).map(k => Number(k)).filter(n => !isNaN(n) && n > 0);
  const max = Math.max(1, ...(keys.length ? keys : [currentPage]));
  // ensure contiguous pages up to max
  for (let i = 1; i <= max; i++) if (!pagesData[i]) pagesData[i] = {};
  sel.innerHTML = '';
  for (let i = 1; i <= max; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.text = 'Page ' + i;
    if (i === currentPage) opt.selected = true;
    sel.appendChild(opt);
  }
  // disable prev/next when at edges
  const prev = document.querySelector('.page-nav button[onclick*="changePage(-1)"]');
  const next = document.querySelector('.page-nav button[onclick*="changePage(1)"]');
  if (prev) prev.disabled = currentPage <= 1;
  if (next) next.disabled = currentPage >= max;
  document.getElementById('pageLabel').innerText = 'Page ' + currentPage;
}

function changePage(delta) {
  const keys = Object.keys(pagesData).map(k => Number(k)).filter(n => !isNaN(n) && n > 0);
  let max = Math.max(1, ...(keys.length ? keys : [currentPage]));
  let next = currentPage + delta;
  if (next < 1) next = 1;
  if (next > max) {
    // create a new page when moving forward beyond current max
    max = next;
    pagesData[next] = {};
  }
  currentPage = next;
  savePages();
  reloadPage();
}

function jumpToPage(val) {
  const p = Number(val);
  if (isNaN(p) || p < 1) return;
  currentPage = p;
  if (!pagesData[currentPage]) pagesData[currentPage] = {};
  savePages();
  reloadPage();
}

// ===============================
// PAGE SUIVANTE / PRÉCÉDENTE
// ===============================
function reloadPage() {
  if (!pagesData[currentPage]) pagesData[currentPage] = {};
  data = pagesData[currentPage];
  document.getElementById("pageLabel").innerText = "Page " + currentPage;
  
  const container = document.getElementById('members');
  container.innerHTML = '';
  
  // notebook wrapper
  const nb = document.createElement('div');
  nb.className = 'notebook';

    membres.forEach((nom, i) => {
      const d = data[nom] || {};
      const statut = d.statut || "Aucun";
      const heure = d.heure || "—";
      let statusKey = "none";
      if (statut === "Présent" || statut.toLowerCase() === "present") statusKey = "present";
      if (statut === "Absent" || statut.toLowerCase() === "absent") statusKey = "absent";
      if (statut === "Permission" || statut.toLowerCase() === "permission") statusKey = "permission";
      const role = memberRoles[nom] || 'Membre';

      const sheet = document.createElement('div');
      sheet.className = 'sheet';
      sheet.id = 'sheet-' + i;

      sheet.innerHTML = `
        <div class="sheet-header" onclick="toggleSheet(${i})">
          <div>
            <div class="sheet-title">${i+1}. ${nom}</div>
            <div class="sheet-summary">${statut} — ${heure}</div>
          </div>
          <div>
            <button class="sheet-toggle" onclick="toggleSheet(${i});event.stopPropagation()">Ouvrir</button>
          </div>
        </div>
        <div class="sheet-content">
          <div class="card ${statusKey}">
            <div>
              <h3>${i+1}. ${nom}</h3>
                <div class="meta">
                <span class="status ${statusKey}">${statut}</span>
                <div>Date & Heure: <strong>${heure}</strong></div>
              </div>
            </div>
            <div class="controls">
              <div class="role-row">
                <div class="role-badge ${role==='Chef de section' ? 'chef' : ''}">Rôle</div>
                <select class="role-select" onchange="setRole('${nom}', this.value)">${roleOptions(role)}</select>
              </div>
              <div style="height:6px"></div>
              <button class="btn btn-present" onclick="setStatus('${nom}','Présent')">Présent</button>
              <button class="btn btn-absent" onclick="setStatus('${nom}','Absent')">Absent</button>
              <button class="btn btn-permission" onclick="setStatus('${nom}','Permission')">Permission</button>
              <button class="btn btn-danger" onclick="deleteMember('${nom}')">Supprimer</button>
            </div>
          </div>
        </div>`;

      nb.appendChild(sheet);
    });

    container.appendChild(nb);
    loadPages();
}

// ===============================
// CHANGER CODE ADMIN
// ===============================
async function saveSecretCode() {
  const val = document.getElementById("secretCode").value.trim();
  if (!val) { showBanner("Le code ne peut pas être vide !", 'error'); return; }
  localStorage.setItem("ADMIN_HASH", await sha256(val));
  showBanner("✔ Code administrateur enregistré !", 'success', 2500);
}

async function checkCode() {
  const val = document.getElementById('codeToCheck').value.trim();
  const out = document.getElementById('result');
  if (!val) return out.textContent = 'Entrez un code à vérifier';
  const h = await sha256(val);
  const superHash = localStorage.getItem('SUPER_HASH');
  const adminHash = localStorage.getItem('ADMIN_HASH');
  out.className = '';
  if (h === superHash) {
    out.textContent = '✅ Code SUPER administrateur — OK';
    out.classList.add('result','success');
    return;
  }
  if (h === adminHash) {
    out.textContent = '✅ Code administrateur — OK';
    out.classList.add('result','success');
    return;
  }
  out.textContent = '❌ Code invalide';
  out.classList.add('result','error');
}

// ===============================
// AFFICHER / MASQUER MOT DE PASSE
// ===============================
function toggleVisibility(id) {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
}

// ===============================
// AFFICHAGE MEMBRES
// ===============================
function render() {
  const container = document.getElementById("members");
  container.innerHTML = "";

  membres.forEach((nom, i) => {
    const d = data[nom] || {};
    const statut = d.statut || "Aucun";
    // normaliser la classe de statut pour correspondre aux classes CSS (sans accents)
    let statusKey = "none";
    if (statut === "Présent" || statut.toLowerCase() === "present") statusKey = "present";
    if (statut === "Absent" || statut.toLowerCase() === "absent") statusKey = "absent";
    if (statut === "Permission" || statut.toLowerCase() === "permission") statusKey = "permission";
    const heure = d.heure || "—";
    const role = memberRoles[nom] || 'Membre';

    const card = document.createElement("div");
    card.className = "card";
    if(statut==="Présent") card.classList.add("present");
    if(statut==="Absent") card.classList.add("absent");
    if(statut==="Permission") card.classList.add("permission");

    card.innerHTML = `
      <div>
        <h3>${i+1}. ${nom}</h3>
        <div class="meta">
          <span class="status ${statusKey}">${statut}</span>
          <div>Heure: <strong>${heure}</strong></div>
        </div>
      </div>
      <div class="controls">
        <div class="role-row">
          <div class="role-badge ${role==='Chef de section' ? 'chef' : ''}">Rôle</div>
          <select class="role-select" onchange="setRole('${nom}', this.value)">${roleOptions(role)}</select>
        </div>
        <div style="height:6px"></div>
        <button class="btn btn-present" onclick="setStatus('${nom}','Présent')">Présent</button>
        <button class="btn btn-absent" onclick="setStatus('${nom}','Absent')">Absent</button>
        <button class="btn btn-permission" onclick="setStatus('${nom}','Permission')">Permission</button>
        <button class="btn btn-danger" onclick="deleteMember('${nom}')">Supprimer</button>
      </div>`;
    
    container.appendChild(card);
  });
}

// Supprimer un membre (ouvre la modal de confirmation)
function deleteMember(nom) {
  _pendingDelete = nom;
  const modal = document.getElementById('modalConfirm');
  const msg = document.getElementById('confirmMessage');
  const title = document.getElementById('confirmTitle');
  if (title) title.textContent = 'Confirmer la suppression';
  if (msg) msg.textContent = `Supprimer "${nom}" ? Cette action est irréversible.`;
  if (modal) {
    modal.classList.remove('hidden');
    // focus the confirm button for keyboard users
    const yes = document.getElementById('confirmYes');
    if (yes) yes.focus();
  }
}

// Exécute la suppression après confirmation
function confirmDeleteYes() {
  if (!_pendingDelete) {
    // nothing to do
    const m = document.getElementById('modalConfirm'); if (m) m.classList.add('hidden');
    return;
  }
  const nom = _pendingDelete;
  _pendingDelete = null;
  // remove from membres
  membres = membres.filter(m => m !== nom);
  // also remove role metadata
  _removeMemberRolesFor(nom);
  // remove member data from all pages
  Object.keys(pagesData).forEach(p => {
    if (pagesData[p] && pagesData[p][nom]) delete pagesData[p][nom];
  });
  saveMembers();
  savePages();
  // hide modal and refresh
  const m = document.getElementById('modalConfirm'); if (m) m.classList.add('hidden');
  showBanner(`Membre « ${nom} » supprimé.`, 'info', 2200);
  reloadPage();
}

// ensure memberRoles entry removed when deleting member (also used elsewhere)
function _removeMemberRolesFor(nom) {
  if (memberRoles && memberRoles[nom]) {
    delete memberRoles[nom];
    saveMemberRoles();
  }
}

// ===============================
// ROLE / POSITION
// ===============================
function roleOptions(selected) {
  const opts = ["Membre","Ss","TCM","Cs","Autre"];
  return opts.map(o=>`<option value="${o}" ${o===selected? 'selected':''}>${o}</option>`).join('');
}

async function login(password) {
  const h = await sha256(password);
  const superHash = localStorage.getItem('SUPER_HASH');
  const adminHash = localStorage.getItem('ADMIN_HASH');

  if (h === superHash) return 'super';
  if (h === adminHash) return 'admin';

  return 'refusé';
}

async function setRole(nom, role) {
  // only admin/super can set roles
  const pwd = document.getElementById("password").value.trim();
  const roleAuth = await login(pwd);
  if (roleAuth === 'refusé') { showBanner('❌ Mot de passe incorrect (rôle non autorisé)', 'error'); return; }
  memberRoles[nom] = role;
  saveMemberRoles();
  showBanner(`Rôle de ${nom} mis à jour: ${role}`, 'success', 2000);
  // refresh UI to show updated badge if any
  reloadPage();
}
function formatDateTime(date) {
  const d = new Date(date);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}


// ===============================
// SET STATUS
// ===============================
async function setStatus(nom, statut) {
  const pwd = document.getElementById("password").value.trim();
  const role = await login(pwd);

  if (role === "refusé") { showBanner("❌ Mot de passe incorrect !", 'error'); return; }
  
  const now = new Date();
  pagesData[currentPage][nom] = {
    statut,
    heure: formatDateTime(now),
    _ts: now.getTime()
  };

  savePages();
  reloadPage();

  // Auto-advance: if the current page is complete (all members have a statut), go to next page
  setTimeout(() => {
    try {
      if (isPageComplete()) {
        // small notify then change page
        // use changePage to keep behavior consistent
        changePage(1);
        // optional small notification
        try { showBanner('Page terminée — ouverture automatique de la page suivante', 'info', 2200); } catch(e){}
      }
    } catch (e) { /* ignore */ }
  }, 120);
}

// Retourne true si tous les membres de la page courante ont un statut != 'Aucun'
function isPageComplete() {
  if (!pagesData[currentPage]) return false;
  const page = pagesData[currentPage];
  if (!membres || membres.length === 0) return false;
  for (const nom of membres) {
    const d = page[nom] || {};
    const s = d.statut || 'Aucun';
    if (!s || s === 'Aucun') return false;
  }
  return true;
}

// Ouvrir / fermer une feuille (par index)
function toggleSheet(index) {
  const nb = document.querySelector('.notebook');
  if (!nb) return;
  const target = document.getElementById('sheet-' + index);
  if (!target) return;
  const opened = nb.querySelector('.sheet.open');
  if (opened && opened !== target) {
    opened.classList.remove('open');
    const obtn = opened.querySelector('.sheet-toggle');
    if (obtn) obtn.textContent = 'Ouvrir';
    opened.setAttribute('aria-expanded','false');
  }

  const willOpen = !target.classList.contains('open');
  target.classList.toggle('open');
  // update the toggle button text and aria
  const btn = target.querySelector('.sheet-toggle');
  if (btn) btn.textContent = willOpen ? 'Fermer' : 'Ouvrir';
  target.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
}

// ===============================
// EXPORT CSV
// ===============================
document.getElementById("downloadBtn").addEventListener("click", () => {
  const headers = ["Nom","Statut","Heure"];
  
  const rows = membres.map(nom=>{
    const d = data[nom] || {};
    return [nom, d.statut || "Aucun", d.heure || ""];
  });

  const csv = [headers, ...rows].map(r=>r.join(",")).join("\r\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "presence_page_" + currentPage + ".csv";
  a.click();
});

// ===============================
// AJOUT MEMBRE
// ===============================
document.getElementById("addMember").addEventListener("click",()=>{
  document.getElementById("modalAdd").classList.remove("hidden");
});

document.getElementById("cancelNew").addEventListener("click",()=>{
  document.getElementById("modalAdd").classList.add("hidden");
});

document.getElementById("saveNew").addEventListener("click",()=>{
  const n = document.getElementById("newName").value.trim();
  if (!n) { showBanner("Nom vide !", 'error'); return; }
  membres.push(n);
  // ensure a slot exists for this member on current page
  if (!pagesData[currentPage]) pagesData[currentPage] = {};
  if (!pagesData[currentPage][n]) pagesData[currentPage][n] = {};
  // initialize role for the new member
  if (!memberRoles[n]) memberRoles[n] = 'Membre';
  saveMemberRoles();
  saveMembers();
  savePages();
  document.getElementById("modalAdd").classList.add("hidden");
  render();
});

// modal confirm buttons
document.getElementById('confirmYes').addEventListener('click', confirmDeleteYes);
document.getElementById('confirmNo').addEventListener('click', ()=>{
  _pendingDelete = null;
  const m = document.getElementById('modalConfirm'); if (m) m.classList.add('hidden');
});

// ===============================
// RESET PAGE
// ===============================
document.getElementById("resetData").addEventListener("click",()=>{
  if (!confirm("Réinitialiser cette page ? ")) return;
  pagesData[currentPage] = {};
  savePages();
  reloadPage();

  // attempt to unregister service workers to ensure fresh assets on reload
  if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      Promise.all(regs.map(r => r.unregister())).finally(() => {
        // small delay to allow unregister to propagate
        setTimeout(() => location.reload(), 250);
      });
    }).catch(() => setTimeout(() => location.reload(), 250));
  } else {
    // fallback: normal reload
    setTimeout(() => location.reload(), 250);
  }
});

// ===============================
// MODE SOMBRE
// ===============================
document.getElementById("themeBtn").addEventListener("click",()=>{
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur==="dark" ? "" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem('theme', next); } catch(e){}
});

// ===============================
// LANCEMENT
// ===============================
reloadPage();
