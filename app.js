/* ====== CONFIG / MEMBRES ====== */
let membres = JSON.parse(localStorage.getItem('presence_members')) || [
  "Afi Adjo","Bio Ali","Cèdric Lawson","Dona Chabi","Mivon Douho"
];

const passwordAdmin = "1234"; // change-le pour la production
let data = JSON.parse(localStorage.getItem("presencePro")) || {};
let theme = localStorage.getItem("presence_theme") || "light";

/* ====== THEME ====== */
function applyTheme() {
  if(theme === "dark") document.documentElement.setAttribute('data-theme','dark');
  else document.documentElement.removeAttribute('data-theme');
  document.getElementById('themeBtn').innerText = theme==='dark'?'☀️':'🌙';
}
document.getElementById('themeBtn').addEventListener('click', ()=>{
  theme = theme === "dark" ? "light" : "dark";
  localStorage.setItem('presence_theme', theme);
  applyTheme();
});
applyTheme();

/* ====== DATE BOX ====== */
function loadInfos(){
  const now = new Date();
  const jours=["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
  document.getElementById('date-box').innerText = `${jours[now.getDay()]}, ${now.toLocaleDateString('fr-FR')} • ${now.toLocaleTimeString('fr-FR')}`;
}
setInterval(loadInfos,1000);
loadInfos();

/* ====== RENDER CARDS ====== */
function render(){
  const container = document.getElementById('members');
  container.innerHTML = '';
  membres.forEach((nom,i)=>{
    const statut = data[nom] ? data[nom].statut : 'Aucun';
    const heure = data[nom] ? data[nom].heure : '—';
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div>
        <h3>${i+1}. ${nom}</h3>
        <div class="meta">
          <span class="status ${statut.toLowerCase()}">${statut}</span>
          <div>Heure : <strong>${heure}</strong></div>
        </div>
      </div>
      <div class="controls">
        <button class="btn btn-present" onclick="setStatus('${nom}','Présent')">Présent</button>
        <button class="btn btn-absent" onclick="setStatus('${nom}','Absent')">Absent</button>
        <button class="btn btn-permission" onclick="setStatus('${nom}','Permission')">Permission</button>
      </div>
    `;
    container.appendChild(card);
  });
}
window.render = render;
render();

/* ====== SET STATUS (requiert mot de passe) ====== */
function setStatus(nom, statut) {
  const pwd = document.getElementById('password').value;
  if(pwd !== passwordAdmin) { alert('Mot de passe incorrect !'); return; }
  data[nom] = { statut, heure: new Date().toLocaleTimeString('fr-FR'), date: new Date().toLocaleDateString('fr-FR') };
  localStorage.setItem('presencePro', JSON.stringify(data));
  render();
}

/* ====== EXPORT CSV (lisible avec Excel) ====== */
function exportCSV(){
  // entêtes
  const headers = ['Nom','Statut','Date','Heure'];
  const rows = membres.map(nom => {
    const d = data[nom] || { statut:'Aucun', heure:'', date:'' };
    return [nom, d.statut, d.date || '', d.heure || ''];
  });

  const csvArray = [headers, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csvArray], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `presence_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
document.getElementById('downloadBtn').addEventListener('click', exportCSV);

/* ====== AJOUT / RESET MEMBRES ====== */
document.getElementById('addMember').addEventListener('click', ()=>{ document.getElementById('modalAdd').classList.remove('hidden'); document.getElementById('newName').value='';});
document.getElementById('cancelNew').addEventListener('click', ()=> document.getElementById('modalAdd').classList.add('hidden'));
document.getElementById('saveNew').addEventListener('click', ()=>{
  const name = document.getElementById('newName').value.trim();
  if(!name){ alert('Nom vide'); return; }
  membres.push(name);
  localStorage.setItem('presence_members', JSON.stringify(membres));
  render();
  document.getElementById('modalAdd').classList.add('hidden');
});

/* RESET journée */
document.getElementById('resetData').addEventListener('click', ()=>{
  if(!confirm('Réinitialiser les présences pour aujourd\'hui ?')) return;
  data = {};
  localStorage.setItem('presencePro', JSON.stringify(data));
  render();
});

/* expose setStatus pour onclick in HTML */
window.setStatus = setStatus;
