// Capacity Dashboard Utilities — adapted from Claude Design template
const HOURS_PER_DAY = 8;

export function secToH(sec) {
  return (sec || 0) / 3600;
}

export function fmtHours(sec) {
  if (!sec) return "—";
  const h = sec / 3600;
  const wholeH = Math.floor(h);
  const m = Math.round((h - wholeH) * 60);
  if (m === 0) return `${wholeH}h`;
  if (wholeH === 0) return `${m}m`;
  return `${wholeH}h ${m}m`;
}

export function fmtDate(iso) {
  if (!iso) return "—";
  const p = iso.split("-");
  if (p.length !== 3) return iso;
  return `${p[2]}/${p[1]}`;
}

export function countBusinessDays(startISO, endISO) {
  // Counts Mon-Fri between two dates inclusive
  let n = 0;
  const s = new Date(startISO);
  const e = new Date(endISO);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

export function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function shortName(full) {
  if (!full) return "—";
  const p = full.split(" ");
  if (p.length <= 2) return full;
  return p[0] + " " + p[p.length - 1];
}

export function initials(full) {
  if (!full) return "—";
  const p = full.split(" ").filter(Boolean);
  return ((p[0]?.[0] || "") + (p[p.length - 1]?.[0] || "")).toUpperCase();
}

// Main computation function adapted from template
export function computeSprint(D, CFG, sprintNum, includeLT) {
  const sp = CFG.sprints[sprintNum] || CFG.sprints["1"];
  if (!sp) return null;

  const sprintStart = sp.start;
  const sprintEnd = sp.end;
  const excl = new Set(CFG.excluidos || []);
  if (!includeLT && CFG.ltPersona) excl.add(CFG.ltPersona);
  const epicasExcl = new Set(CFG.epicasExcluidas || []);

  // Ensure data arrays exist
  const parents = Array.isArray(D.parents) ? D.parents : [];
  const items = Array.isArray(D.items) ? D.items : [];

  // Parents whose epic is excluded -> their key list
  const parentsKeysFromExclEpic = new Set(parents.filter(p => epicasExcl.has(p.ek)).map(p => p.k));

  // === Items filter ===
  const filteredItems = items.filter(it => {
    if (excl.has(it.a)) return false;
    if (it.s === "CANCELADOS") return false;
    if (!it.sp || !Array.isArray(it.sp) || !it.sp.includes(sprintNum)) return false;
    // Exclude items whose parent belongs to an excluded epic
    if (it.pk && parentsKeysFromExclEpic.has(it.pk)) return false;
    // Exclude TERMINADOS done before sprint start
    if (it.s === "TERMINADO" && it.fd && it.fd < sprintStart) return false;
    // Exclude TERMINADOS done after sprint end
    if (it.s === "TERMINADO" && it.fd && it.fd > sprintEnd) return false;
    return true;
  });

  // === Parents filter ===
  const referencedParentKeys = new Set(filteredItems.map(i => i.pk).filter(Boolean));
  const filteredParents = parents.filter(p => {
    if (excl.has(p.a)) return false;
    if (p.s === "CANCELADOS") return false;
    // Exclude parents from excluded epics
    if (epicasExcl.has(p.ek)) return false;
    if (p.s === "TERMINADO" && p.fd && p.fd < sprintStart) return false;
    const tagged = p.sp && Array.isArray(p.sp) && p.sp.includes(sprintNum);
    return tagged || referencedParentKeys.has(p.k);
  });

  // Add isDone derivation
  filteredParents.forEach(p => {
    p._subs = filteredItems.filter(i => i.pk === p.k);
    const subsTotal = p._subs.length;
    const subsDone = p._subs.filter(i => i.s === "TERMINADO").length;
    p._count = subsTotal;
    p._done = subsDone;
    p._isDone = (p.s === "TERMINADO") || (subsTotal > 0 && subsDone === subsTotal);
  });

  // === Sprint timing ===
  const today = todayISO();
  let diasTranscurridos, pctEsperado;
  if (today < sprintStart) {
    diasTranscurridos = 0;
    pctEsperado = 0;
  } else if (today > sprintEnd) {
    diasTranscurridos = sp.efectivos || 10;
    pctEsperado = 100;
  } else {
    const bd = countBusinessDays(sprintStart, today);
    diasTranscurridos = Math.min(bd, sp.efectivos || 10);
    pctEsperado = Math.round((diasTranscurridos / (sp.efectivos || 10)) * 100);
  }

  // === Team capacity ===
  const peopleMap = new Map();
  filteredItems.forEach(it => {
    if (!it.a || excl.has(it.a)) return;
    if (!peopleMap.has(it.a)) peopleMap.set(it.a, []);
    peopleMap.get(it.a).push(it);
  });

  function vacImpactDays(personName) {
    const vacs = CFG.vacaciones?.[personName] || [];
    let impact = 0;
    vacs.forEach((v) => {
      const [vs, ve] = Array.isArray(v) ? v : [v, v];
      if (!vs || !ve) return;
      if (ve < sprintStart || vs > sprintEnd) return;
      const oStart = vs > sprintStart ? vs : sprintStart;
      const oEnd = ve < sprintEnd ? ve : sprintEnd;
      impact += countBusinessDays(oStart, oEnd);
    });
    return Math.min(impact, sp.capMaxDias || 8);
  }

  const team = [];
  peopleMap.forEach((pItems, name) => {
    const role = CFG.roles?.[name] || "dev";
    const vacImpact = vacImpactDays(name);
    const capDias = Math.max(0, (sp.capMaxDias || 8) - vacImpact);
    const capHoras = capDias * HOURS_PER_DAY;

    const estTotalSec = pItems.reduce((s, i) => s + (i.e || 0), 0);
    const doneSec = pItems.filter(i => i.s === "TERMINADO").reduce((s, i) => s + (i.e || 0), 0);
    const pendingSec = estTotalSec - doneSec;

    const pctReal = estTotalSec > 0 ? (doneSec / estTotalSec) * 100 : 0;
    const pctCap = capHoras > 0 ? (estTotalSec / 3600) / capHoras * 100 : 0;
    const sinEst = pItems.filter(i => !i.e || i.e === 0).length;

    let alertaLevel, alertaTitle;
    const desv = pctReal - pctEsperado;
    if (role === "soporte") { alertaLevel = "soporte"; alertaTitle = "SOPORTE"; }
    else if (desv <= -30) { alertaLevel = "critico"; alertaTitle = "CRÍTICO"; }
    else if (desv <= -15) { alertaLevel = "atraso"; alertaTitle = "ATRASO"; }
    else if (desv <= -5) { alertaLevel = "revisar"; alertaTitle = "REVISAR"; }
    else { alertaLevel = "linea"; alertaTitle = "EN LÍNEA"; }

    let capLevel;
    if (pctCap >= 90) capLevel = "alta";
    else if (pctCap >= 60) capLevel = "media";
    else if (pctCap >= 30) capLevel = "baja";
    else capLevel = "muybaja";

    team.push({
      name, short: shortName(name), initials: initials(name), role,
      nota: CFG.notas?.[name] || null,
      vacImpact, capDias, capHoras,
      items: pItems,
      itemCount: pItems.length,
      subs: pItems.filter(i => i.t === "Sub").length,
      bugs: pItems.filter(i => i.t === "Bug").length,
      estTotalSec, doneSec, pendingSec, sinEst,
      pctReal, pctCap, desv,
      alertaLevel, alertaTitle, capLevel,
    });
  });

  // Sort team
  const alertaOrder = { critico: 0, atraso: 1, revisar: 2, linea: 3, soporte: 4 };
  const roleOrder = { dev: 0, qa: 0, ux: 0, soporte: 1, lt: 2, po: 3 };
  team.sort((a, b) => {
    const ra = roleOrder[a.role] ?? 0;
    const rb = roleOrder[b.role] ?? 0;
    if (ra !== rb) return ra - rb;
    const la = alertaOrder[a.alertaLevel] ?? 99;
    const lb = alertaOrder[b.alertaLevel] ?? 99;
    if (la !== lb) return la - lb;
    return b.itemCount - a.itemCount;
  });

  // === Avance Real ===
  const padresDone = filteredParents.filter(p => p._isDone).length;
  const padresTotal = filteredParents.length;
  const avancePadres = padresTotal > 0 ? (padresDone / padresTotal) * 100 : 0;

  const hTotalSec = filteredItems.reduce((s, i) => s + (i.e || 0), 0);
  const hDoneSec = filteredItems.filter(i => i.s === "TERMINADO").reduce((s, i) => s + (i.e || 0), 0);
  const avanceHoras = hTotalSec > 0 ? (hDoneSec / hTotalSec) * 100 : 0;

  // === Alertas ===
  const alertas = team.map(t => {
    let text;
    if (t.role === "soporte") {
      text = `Avance ${t.pctReal.toFixed(0)}%. ${shortName(t.name)} · Soporte Digital — esfuerzo principal en tablero distinto.`;
    } else {
      const desvStr = (t.desv >= 0 ? "+" : "") + t.desv.toFixed(1) + "pp";
      const items = `${t.itemCount} items · ${fmtHours(t.estTotalSec)}`;
      const sinEstStr = t.sinEst ? ` · ${t.sinEst} s/est` : "";
      text = `Avance ${t.pctReal.toFixed(1)}% vs ${pctEsperado}% esp. (${desvStr}). ${items}${sinEstStr}.`;
    }
    return { name: t.name, level: t.alertaLevel, title: t.alertaTitle, text };
  });

  const alertOrder = { critico: 0, atraso: 1, revisar: 2, linea: 3, soporte: 4 };
  alertas.sort((a, b) => alertOrder[a.level] - alertOrder[b.level]);

  return {
    sp, today, diasTranscurridos, pctEsperado,
    items: filteredItems, parents: filteredParents, team,
    avancePadres, avanceHoras,
    hTotalSec, hDoneSec, padresDone, padresTotal,
    alertas,
  };
}
