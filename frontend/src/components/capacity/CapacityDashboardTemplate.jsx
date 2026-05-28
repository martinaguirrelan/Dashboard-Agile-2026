/* SPI Capacity Dashboard — multi-sprint dynamic version */
const { useState, useEffect, useMemo, useRef } = React;

const D = window.DATA;
const CFG = D.config;

// ============ Utilities ============
const HOURS_PER_DAY = 8;

function secToH(sec) { return (sec || 0) / 3600; }
function fmtHours(sec) {
  if (!sec) return "—";
  const h = sec / 3600;
  const wholeH = Math.floor(h);
  const m = Math.round((h - wholeH) * 60);
  if (m === 0) return `${wholeH}h`;
  if (wholeH === 0) return `${m}m`;
  return `${wholeH}h ${m}m`;
}
function fmtDate(iso) {
  if (!iso) return "—";
  const p = iso.split("-");
  if (p.length !== 3) return iso;
  return `${p[2]}/${p[1]}`;
}
function dateRangeOverlapDays(rangeStart, rangeEnd, vacStart, vacEnd) {
  // Inclusive overlap in calendar days
  const s = rangeStart > vacStart ? rangeStart : vacStart;
  const e = rangeEnd < vacEnd ? rangeEnd : vacEnd;
  if (s > e) return 0;
  // Diff in days
  const ms = new Date(e).getTime() - new Date(s).getTime();
  return Math.round(ms / 86400000) + 1;
}
function countBusinessDays(startISO, endISO) {
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
function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function shortName(full) {
  if (!full) return "—";
  const p = full.split(" ");
  if (p.length <= 2) return full;
  return p[0] + " " + p[p.length - 1];
}
function initials(full) {
  if (!full) return "—";
  const p = full.split(" ").filter(Boolean);
  return ((p[0]?.[0] || "") + (p[p.length - 1]?.[0] || "")).toUpperCase();
}

// ============ Per-sprint computation ============
function computeSprint(sprintNum, includeLT) {
  const sp = CFG.sprints[sprintNum];
  const sprintStart = sp.start;
  const sprintEnd = sp.end;
  const excl = new Set(CFG.excluidos);
  if (!includeLT && CFG.ltPersona) excl.add(CFG.ltPersona);
  const epicasExcl = new Set(CFG.epicasExcluidas || []);

  // Parents whose epic is excluded -> their key list
  const parentsKeysFromExclEpic = new Set(D.parents.filter(p => epicasExcl.has(p.ek)).map(p => p.k));

  // === Items carry-over filter ===
  const items = D.items.filter(it => {
    if (excl.has(it.a)) return false;
    if (it.s === "CANCELADOS") return false;
    if (!it.sp || !it.sp.includes(sprintNum)) return false;
    // Exclude items whose parent belongs to an excluded epic
    if (it.pk && parentsKeysFromExclEpic.has(it.pk)) return false;
    // Exclude TERMINADOS done before sprint start
    if (it.s === "TERMINADO" && it.fd && it.fd < sprintStart) return false;
    // Exclude TERMINADOS done after sprint end (will reappear in later sprint)
    if (it.s === "TERMINADO" && it.fd && it.fd > sprintEnd) return false;
    return true;
  });

  // === Parents filter ===
  const referencedParentKeys = new Set(items.map(i => i.pk).filter(Boolean));
  const parents = D.parents.filter(p => {
    if (excl.has(p.a)) return false;
    if (p.s === "CANCELADOS") return false;
    // Exclude parents from excluded epics
    if (epicasExcl.has(p.ek)) return false;
    if (p.s === "TERMINADO" && p.fd && p.fd < sprintStart) return false;
    const tagged = p.sp && p.sp.includes(sprintNum);
    return tagged || referencedParentKeys.has(p.k);
  });

  // Add isDone derivation: parent done if status TERMINADO OR all subs TERMINADO
  parents.forEach(p => {
    p._subs = items.filter(i => i.pk === p.k);
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
    diasTranscurridos = sp.efectivos;
    pctEsperado = 100;
  } else {
    // Count business days from sprint start to today (capped)
    const bd = countBusinessDays(sprintStart, today);
    diasTranscurridos = Math.min(bd, sp.efectivos);
    pctEsperado = Math.round((diasTranscurridos / sp.efectivos) * 100);
  }

  // === Team capacity per person ===
  // Build set of people from items
  const peopleMap = new Map();
  items.forEach(it => {
    if (!it.a || excl.has(it.a)) return;
    if (!peopleMap.has(it.a)) peopleMap.set(it.a, []);
    peopleMap.get(it.a).push(it);
  });

  // Capacity adjustment from vacations
  function vacImpactDays(personName) {
    const vacs = CFG.vacaciones[personName] || [];
    let impact = 0;
    vacs.forEach(([vs, ve]) => {
      if (ve < sprintStart || vs > sprintEnd) return;
      // Count business days overlap
      const oStart = vs > sprintStart ? vs : sprintStart;
      const oEnd = ve < sprintEnd ? ve : sprintEnd;
      impact += countBusinessDays(oStart, oEnd);
    });
    return Math.min(impact, sp.capMaxDias);
  }

  const team = [];
  peopleMap.forEach((pItems, name) => {
    const role = CFG.roles[name] || "dev";
    const vacImpact = vacImpactDays(name);
    const capDias = Math.max(0, sp.capMaxDias - vacImpact);
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
      nota: CFG.notas[name] || null,
      vacImpact, capDias, capHoras,
      items: pItems,
      itemCount: pItems.length,
      subs: pItems.filter(i => i.t === "Sub").length,
      bugs: pItems.filter(i => i.t === "Bug").length,
      estTotalSec, doneSec, pendingSec, sinEst,
      pctReal, pctCap, desv,
      alertaLevel, alertaTitle, capLevel,
      parentsAssigned: parents.filter(pp => pp.a === name),
    });
  });

  // Sort team by semáforo: crítico → atraso → revisar → línea → soporte → LT → PO; empate por items desc
  const alertaOrder = { critico: 0, atraso: 1, revisar: 2, linea: 3, soporte: 4 };
  const roleOrder = { dev: 0, qa: 0, ux: 0, soporte: 1, lt: 2, po: 3 };
  team.sort((a, b) => {
    // Primero LT/PO al final
    const ra = roleOrder[a.role] ?? 0;
    const rb = roleOrder[b.role] ?? 0;
    if (ra !== rb) return ra - rb;
    // Dentro del grupo, ordenar por severidad de alerta
    const la = alertaOrder[a.alertaLevel] ?? 99;
    const lb = alertaOrder[b.alertaLevel] ?? 99;
    if (la !== lb) return la - lb;
    return b.itemCount - a.itemCount;
  });

  // === Iniciativas distribution (over parents) ===
  const iniBuckets = {
    "Nuevas": 0, "Pedidos No Planificados": 0,
    "Habilitadores Estrategicos": 0, "Ongoing": 0, "Sin clasificar": 0,
  };
  parents.forEach(p => {
    const k = iniBuckets.hasOwnProperty(p.ini || "") ? p.ini : "Sin clasificar";
    iniBuckets[k] = (iniBuckets[k] || 0) + 1;
  });
  const totalP = parents.length || 1;
  const iniciativas = Object.entries(iniBuckets)
    .filter(([k, v]) => v > 0)
    .map(([tipo, count]) => ({
      tipo, count, pct: count / totalP * 100,
      desc: descIniciativa(tipo),
    }));

  // === Parent type distribution ===
  const tipoBuckets = {};
  parents.forEach(p => { tipoBuckets[p.t] = (tipoBuckets[p.t] || 0) + 1; });
  const universoPadre = Object.entries(tipoBuckets)
    .map(([tipo, count]) => ({ tipo, count, pct: count / totalP * 100 }))
    .sort((a, b) => b.count - a.count);

  // === Items status ===
  function statusSummary(arr) {
    return {
      total: arr.length,
      done: arr.filter(i => i.s === "TERMINADO").length,
      proc: arr.filter(i => i.s === "EN PROCESO" || i.s === "CERTIFICACION" || i.s === "GESTION DEL PASE" || i.s === "ANALISIS").length,
      init: arr.filter(i => i.s === "POR INICIAR").length,
      block: arr.filter(i => i.s === "BLOQUEADOS").length,
      conEst: arr.filter(i => i.e && i.e > 0).length,
      sinEst: arr.filter(i => !i.e || i.e === 0).length,
    };
  }
  const universoItems = {
    subtareas: statusSummary(items.filter(i => i.t === "Sub")),
    bugs: statusSummary(items.filter(i => i.t === "Bug")),
    total: statusSummary(items),
  };

  // === Avance Real Sprint (two metrics) ===
  const padresDone = parents.filter(p => p._isDone).length;
  const padresTotal = parents.length;
  const avancePadres = padresTotal > 0 ? (padresDone / padresTotal) * 100 : 0;

  const hTotalSec = items.reduce((s, i) => s + (i.e || 0), 0);
  const hDoneSec = items.filter(i => i.s === "TERMINADO").reduce((s, i) => s + (i.e || 0), 0);
  const avanceHoras = hTotalSec > 0 ? (hDoneSec / hTotalSec) * 100 : 0;

  // === Alertas (per team person) ===
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

  // Sort alerts by severity
  const alertOrder = { critico: 0, atraso: 1, revisar: 2, linea: 3, soporte: 4 };
  alertas.sort((a, b) => alertOrder[a.level] - alertOrder[b.level]);

  return {
    sp, today, diasTranscurridos, pctEsperado,
    items, parents, team,
    iniciativas, universoPadre, universoItems,
    avancePadres, avanceHoras,
    hTotalSec, hDoneSec, padresDone, padresTotal,
    alertas,
  };
}

function descIniciativa(tipo) {
  const m = {
    "Nuevas": "Funcionalidades nuevas planificadas para el trimestre",
    "Pedidos No Planificados": "Solicitudes operativas no planificadas que surgen en el sprint",
    "Habilitadores Estrategicos": "Habilitadores técnicos / sesiones estratégicas",
    "Ongoing": "Iniciativas en ejecución continua desde trimestres anteriores",
    "Sin clasificar": "Padres sin tipo de iniciativa asignado",
  };
  return m[tipo] || "";
}

// ============ Quarterly Initiatives (Epic → parents) ============
function computeQuarterly(includeLT) {
  const qStart = CFG.sprints[1].start;
  const qEnd = CFG.quarterEnd;
  const today = todayISO();
  const excl = new Set(CFG.excluidos);
  if (!includeLT && CFG.ltPersona) excl.add(CFG.ltPersona);
  const epicasExcl = new Set(CFG.epicasExcluidas || []);

  // Group all (non-cancelled) parents by epic
  const allParents = D.parents.filter(p => p.s !== "CANCELADOS");
  // Compute parent done = parent itself TERMINADO OR all its subtasks (across all sprints) done
  const parentDoneness = {};
  D.parents.forEach(p => {
    const allSubs = D.items.filter(i => i.pk === p.k && i.s !== "CANCELADOS");
    const totSubs = allSubs.length;
    const doneSubs = allSubs.filter(i => i.s === "TERMINADO").length;
    parentDoneness[p.k] = (p.s === "TERMINADO") || (totSubs > 0 && doneSubs === totSubs);
  });

  function daysBetween(aISO, bISO) {
    return Math.round((new Date(bISO) - new Date(aISO)) / 86400000);
  }

  const epicsList = D.epics
    .filter(e => !epicasExcl.has(e.k))
    .map(e => {
      const ePadres = allParents.filter(p => p.ek === e.k && !excl.has(p.a));
      const done = ePadres.filter(p => parentDoneness[p.k]).length;
      const total = ePadres.length;
      const pctReal = total > 0 ? (done / total) * 100 : 0;

      // Horas — sumadas de subs/bugs cuyo padre pertenece a esta épica (excluyendo cancelados y personas excluidas)
      const ePadresKeys = new Set(ePadres.map(p => p.k));
      const eItems = D.items.filter(i =>
        i.pk && ePadresKeys.has(i.pk) &&
        i.s !== "CANCELADOS" &&
        !excl.has(i.a)
      );
      const horasAcumSec = eItems.reduce((s, i) => s + (i.e || 0), 0);
      const horasInvSec = eItems.filter(i => i.s === "TERMINADO").reduce((s, i) => s + (i.e || 0), 0);

      // Per-epic timeline: from epic.sd → epic.due (fallback to qStart..qEnd)
      const eStart = e.sd || qStart;
      const eEnd = e.due || qEnd;
      const totalDays = Math.max(1, daysBetween(eStart, eEnd));
      let elapsedDays;
      if (today < eStart) elapsedDays = 0;
      else if (today >= eEnd) elapsedDays = totalDays;
      else elapsedDays = daysBetween(eStart, today);
      const pctEsperado = (elapsedDays / totalDays) * 100;

      const ratio = pctEsperado > 0 ? pctReal / pctEsperado : (pctReal > 0 ? 1 : 0);
      let level;
      if (total === 0) level = "vacio";
      else if (ratio >= 0.9) level = "linea";
      else if (ratio >= 0.7) level = "medio";
      else level = "critico";

      // Bucket por Estado de la épica (NO inferido)
      let bucket;
      if (e.s === "TERMINADO") bucket = "terminadas";
      else if (e.s === "POR INICIAR") bucket = "porIniciar";
      else bucket = "enProceso";

      return {
        key: e.k, nombre: e.r, estado: e.s, iniciativa: e.ini, asignado: e.a,
        sd: e.sd, due: e.due, fd: e.fd,
        total, done, pctReal, pctEsperado, desv: pctReal - pctEsperado, ratio,
        horasAcumSec, horasInvSec,
        level, bucket,
      };
    })
    .filter(e => e.total > 0)
    .sort((a, b) => {
      // Orden por semáforo: crítico → medio → línea → vacío. Empate por total desc.
      const levelOrder = { critico: 0, medio: 1, linea: 2, vacio: 3 };
      return (levelOrder[a.level] - levelOrder[b.level]) || (b.total - a.total);
    });

  // Aggregate counters by Estado de la épica
  const counters = { porIniciar: 0, enProceso: 0, terminadas: 0 };
  epicsList.forEach(e => { counters[e.bucket]++; });

  return { qStart, qEnd, today, epics: epicsList, counters };
}

// ============ SVG Primitives ============
function donutPath(cx, cy, r, startA, endA) {
  const a0 = (startA - 90) * Math.PI / 180;
  const a1 = (endA - 90) * Math.PI / 180;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = endA - startA > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

function Donut({ data, size = 130, hole = 0.62, colors }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const r = size / 2;
  let cum = 0;
  const segs = data.map((d, i) => {
    const start = (cum / total) * 360;
    cum += d.count;
    const end = (cum / total) * 360;
    return { start, end, color: colors[i % colors.length], d };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut">
      {segs.map((s, i) => (
        <path key={i} d={donutPath(r, r, r - 1, s.start, Math.min(s.end, s.start + 359.99))} fill={s.color} />
      ))}
      <circle cx={r} cy={r} r={r * hole} fill="var(--surface)" />
      <text x={r} y={r - 4} textAnchor="middle" fill="var(--text)" fontFamily="var(--font-mono)" fontSize="22" fontWeight="500">{total}</text>
      <text x={r} y={r + 12} textAnchor="middle" fill="var(--text-3)" fontFamily="var(--font-mono)" fontSize="9" letterSpacing="1.2">TOTAL</text>
    </svg>
  );
}

function GaugeRing({ value, max = 100, color, size = 44 }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const pct = Math.min(Math.max(value, 0) / max, 1);
  return (
    <svg width={size} height={size} className="gauge">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="3"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset 1s ease-out" }}/>
    </svg>
  );
}

// ============ Header + Sprint Selector ============
function Header({ sprintNum, setSprintNum, S, includeLT, setIncludeLT }) {
  const sp = S.sp;
  const pct = sp.efectivos ? (S.diasTranscurridos / sp.efectivos) * 100 : 0;
  return (
    <header className="hdr">
      <div className="hdr-titleblock">
        <div className="hdr-eyebrow">
          <span className="dot"></span>
          <span>SPRINT {sp.num} · {sp.rango} · {sp.efectivos} días efectivos</span>
        </div>
        <h1 className="hdr-title">{CFG.squad} · Capacity ejecutivo</h1>
        <div className="hdr-sub">
          <span>{S.team.filter(t=>t.role==="dev").length} devs</span>
          <span className="div">·</span>
          <span>{S.team.filter(t=>t.role==="qa").length} QA</span>
          <span className="div">·</span>
          <span>{S.team.filter(t=>t.role==="ux").length} UX</span>
          <span className="div">·</span>
          <span>{S.team.filter(t=>t.role==="soporte").length} soporte</span>
          <span className="div">·</span>
          <span>{S.items.length} items · {S.parents.length} padres</span>
        </div>
        <div className="sprint-bar">
          <span className="sprint-bar-label">SPRINT</span>
          <div className="sprint-bar-track">
            <div className="sprint-bar-fill" style={{ width: pct + "%" }}/>
          </div>
          <div className="sprint-bar-marks mono">
            <b>{S.diasTranscurridos}</b><span>/{sp.efectivos} días</span>
            <span style={{ color: "var(--border)", margin: "0 6px" }}>·</span>
            <b>{S.pctEsperado}%</b><span>esperado</span>
          </div>
          <label className="hdr-lt-toggle" title="Incluye o excluye el esfuerzo del Líder Técnico de todos los cálculos">
            <input type="checkbox" checked={includeLT} onChange={ev => setIncludeLT(ev.target.checked)} />
            <span>Incluir esfuerzo LT</span>
          </label>
        </div>
      </div>
      <div className="hdr-meta">
        <div className="sprint-selector">
          <span className="sprint-selector-label">SPRINT</span>
          <div className="sprint-selector-tabs">
            {[1,2,3,4,5,6].map(n => (
              <button
                key={n}
                className={`sprint-tab ${n === sprintNum ? "active" : ""} ${n === CFG.currentSprint ? "current" : ""}`}
                onClick={() => setSprintNum(n)}
              >
                S{n}
              </button>
            ))}
          </div>
        </div>
        <span className="hdr-pill">Cap. máx <b>{sp.capMaxDias}d · {sp.capMaxHoras}h</b></span>
      </div>
    </header>
  );
}

// ============ KPIs ============
function KPIs({ S }) {
  const hTotal = secToH(S.hTotalSec);
  const hDone = secToH(S.hDoneSec);
  const horasEsperadas = hTotal * S.pctEsperado / 100;
  const desvH = S.avanceHoras - S.pctEsperado;
  const desvP = S.avancePadres - S.pctEsperado;
  const criticas = S.alertas.filter(a => a.level === "critico").length;
  const atrasos = S.alertas.filter(a => a.level === "atraso").length;
  const enLinea = S.alertas.filter(a => a.level === "linea").length;
  const itemsDone = S.universoItems.total.done;
  const itemsTotal = S.universoItems.total.total;

  return (
    <div className="kpis">
      <div className={`kpi ${desvP < -5 ? "warn" : desvP > 5 ? "good" : "neutral"}`}>
        <div className="kpi-label"><span>AVANCE REAL · PADRES</span></div>
        <GaugeRing value={S.avancePadres} max={100} color={desvP < -5 ? "var(--danger)" : desvP > 5 ? "var(--success)" : "var(--accent)"} />
        <div className="kpi-value mono">{S.avancePadres.toFixed(1)}%</div>
        <div className="kpi-sub">
          <span className={`kpi-trend ${desvP < -5 ? "down" : desvP > 5 ? "up" : "flat"}`}>
            {desvP >= 0 ? "+" : ""}{desvP.toFixed(1)}pp
          </span>
          <span>vs {S.pctEsperado}% esperado</span>
        </div>
        <div className="kpi-foot mono">{S.padresDone} / {S.padresTotal} padres terminados</div>
      </div>
      <div className={`kpi ${desvH < -5 ? "warn" : desvH > 5 ? "good" : "neutral"}`}>
        <div className="kpi-label">AVANCE REAL · HORAS</div>
        <GaugeRing value={S.avanceHoras} max={100} color={desvH < -5 ? "var(--danger)" : desvH > 5 ? "var(--success)" : "var(--accent)"} />
        <div className="kpi-value mono">{S.avanceHoras.toFixed(1)}%</div>
        <div className="kpi-sub">
          <span className={`kpi-trend ${desvH < -5 ? "down" : desvH > 5 ? "up" : "flat"}`}>
            {desvH >= 0 ? "+" : ""}{desvH.toFixed(1)}pp
          </span>
          <span>vs {S.pctEsperado}% esperado</span>
        </div>
        <div className="kpi-foot mono">{hDone.toFixed(0)}h / {hTotal.toFixed(0)}h estimadas</div>
      </div>
      <div className="kpi neutral">
        <div className="kpi-label">HORAS ESPERADAS</div>
        <GaugeRing value={horasEsperadas > 0 ? (hDone/horasEsperadas)*100 : 0} max={100} color="var(--accent)"/>
        <div className="kpi-value mono">{hDone.toFixed(0)}<span style={{ fontSize: 16, color: "var(--text-3)" }}> / {horasEsperadas.toFixed(0)}h</span></div>
        <div className="kpi-sub mono">objetivo a la fecha · {S.pctEsperado}% del total ({hTotal.toFixed(0)}h)</div>
      </div>
      <div className="kpi neutral">
        <div className="kpi-label">ITEMS CERRADOS</div>
        <div className="kpi-value mono">{itemsDone}<span style={{ fontSize: 16, color: "var(--text-3)" }}> / {itemsTotal}</span></div>
        <div className="kpi-sub mono">
          {itemsTotal > 0 ? (itemsDone/itemsTotal*100).toFixed(1) : "0"}% · {S.universoItems.bugs.proc} bugs activos · {S.universoItems.total.block} bloqueados
        </div>
      </div>
      <div className="kpi warn">
        <div className="kpi-label">ALERTAS CRÍTICAS</div>
        <div className="kpi-value mono">{criticas}<span style={{ fontSize: 16, color: "var(--text-3)" }}> + {atrasos} atraso</span></div>
        <div className="kpi-sub">{enLinea} en línea · acción inmediata</div>
      </div>
    </div>
  );
}

// ============ Quarterly Initiatives Section (compact table) ============
function QuarterlySection({ Q }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="card quarterly-card">
      <div className="card-head">
        <h3>Iniciativas trimestrales · Q2 2026 → 30/06</h3>
        <div className="quarterly-counters">
          <span className="qc-pill qc-init mono"><b>{Q.counters.porIniciar}</b> por iniciar</span>
          <span className="qc-pill qc-proc mono"><b>{Q.counters.enProceso}</b> en proceso</span>
          <span className="qc-pill qc-done mono"><b>{Q.counters.terminadas}</b> terminadas</span>
        </div>
      </div>
      <div className="qtable">
        <div className="qtable-header">
          <span>KEY</span>
          <span>TIPO</span>
          <span>ESTADO</span>
          <span>NOMBRE</span>
          <span className="qth-bars">AVANCE REAL / ESPERADO</span>
          <span>SEMÁFORO</span>
        </div>
        {Q.epics.map(e => (
          <div
            key={e.key}
            className={`qrow lvl-${e.level}`}
            onClick={() => setOpen(e)}
          >
            <span className="qrow-key mono">{e.key}</span>
            <span className="qrow-ini">{e.iniciativa || "—"}</span>
            <span className={`qrow-state state-${e.estado.toLowerCase().replace(/\s+/g,'-')}`}>{e.estado}</span>
            <span className="qrow-name" title={e.nombre}>{e.nombre}</span>
            <span className="qrow-bars">
              <span className="qrow-bar-line">
                <span className="qrow-bar-lbl">REAL</span>
                <span className="qrow-bar-track">
                  <span className={`qrow-bar-fill ${e.level}`} style={{ width: e.pctReal + "%" }}/>
                </span>
                <span className="qrow-bar-val mono">{e.pctReal.toFixed(0)}%</span>
              </span>
              <span className="qrow-bar-line">
                <span className="qrow-bar-lbl">ESP</span>
                <span className="qrow-bar-track">
                  <span className="qrow-bar-fill exp" style={{ width: e.pctEsperado + "%" }}/>
                </span>
                <span className="qrow-bar-val mono">{e.pctEsperado.toFixed(0)}%</span>
              </span>
            </span>
            <span className={`qrow-badge ${e.level}`}>
              {e.level === "linea" && "ÓPTIMO"}
              {e.level === "medio" && "DESV. MEDIA"}
              {e.level === "critico" && "CRÍTICO"}
              {e.level === "vacio" && "—"}
            </span>
          </div>
        ))}
      </div>
      {open && <EpicDetailModal e={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function EpicDetailModal({ e, onClose }) {
  const horasAcumH = (e.horasAcumSec || 0) / 3600;
  const horasInvH = (e.horasInvSec || 0) / 3600;
  const horasPct = horasAcumH > 0 ? (horasInvH / horasAcumH) * 100 : 0;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-narrow" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">
              <span className="mono" style={{ color: "var(--text-3)", marginRight: 8 }}>{e.key}</span>
              {e.nombre}
            </div>
            <div className="modal-sub">
              {e.iniciativa && <span>{e.iniciativa}</span>}
              {e.iniciativa && <span style={{ margin: "0 6px", color: "var(--border)" }}>·</span>}
              <span className={`qrow-state state-${e.estado.toLowerCase().replace(/\s+/g,'-')}`} style={{ display: "inline-block" }}>{e.estado}</span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: 20 }}>
          <div className="qdetail-grid">
            <div className="qdetail-stat">
              <div className="qdetail-label">FECHA INICIO</div>
              <div className="qdetail-value mono">{e.sd ? fmtDate(e.sd) : "—"}</div>
            </div>
            <div className="qdetail-stat">
              <div className="qdetail-label">FECHA VENCIMIENTO</div>
              <div className="qdetail-value mono">{e.due ? fmtDate(e.due) : "—"}</div>
            </div>
            <div className="qdetail-stat">
              <div className="qdetail-label">FECHA DONE</div>
              <div className="qdetail-value mono" style={{ color: e.fd ? "var(--success)" : "var(--text-3)" }}>
                {e.fd ? fmtDate(e.fd) : "—"}
              </div>
            </div>
            <div className="qdetail-stat">
              <div className="qdetail-label">RESPONSABLE</div>
              <div className="qdetail-value">{shortName(e.asignado)}</div>
            </div>
            <div className="qdetail-stat">
              <div className="qdetail-label">PADRES AVANZADOS / TOTAL</div>
              <div className="qdetail-value mono"><b>{e.done}</b> / {e.total}</div>
            </div>
            <div className="qdetail-stat">
              <div className="qdetail-label">DESVIACIÓN</div>
              <div className={`qdetail-value mono qr-desv ${e.level}`}>
                {e.desv >= 0 ? "+" : ""}{e.desv.toFixed(1)}pp
              </div>
            </div>
            <div className="qdetail-stat">
              <div className="qdetail-label">RATIO REAL/ESP</div>
              <div className={`qdetail-value mono qr-desv ${e.level}`}>{(e.ratio * 100).toFixed(0)}%</div>
            </div>
            <div className="qdetail-stat">
              <div className="qdetail-label">% AVANCE REAL</div>
              <div className="qdetail-value mono">{e.pctReal.toFixed(1)}%</div>
            </div>
          </div>

          <div className="qdetail-section">
            <div className="qdetail-section-title">Progreso vs línea de tiempo</div>
            <div className="qdetail-bars">
              <div className="qrow-bar-line lg">
                <span className="qrow-bar-lbl">REAL</span>
                <span className="qrow-bar-track">
                  <span className={`qrow-bar-fill ${e.level}`} style={{ width: e.pctReal + "%" }}/>
                </span>
                <span className="qrow-bar-val mono">{e.pctReal.toFixed(0)}%</span>
              </div>
              <div className="qrow-bar-line lg">
                <span className="qrow-bar-lbl">ESPERADO</span>
                <span className="qrow-bar-track">
                  <span className="qrow-bar-fill exp" style={{ width: e.pctEsperado + "%" }}/>
                </span>
                <span className="qrow-bar-val mono">{e.pctEsperado.toFixed(0)}%</span>
              </div>
            </div>
          </div>

          <div className="qdetail-section">
            <div className="qdetail-section-title">Horas — subtareas + bugs asociados</div>
            <div className="qdetail-hours">
              <div className="qhour-card">
                <div className="qhour-label">ACUMULADAS (TOTAL ESTIMADAS)</div>
                <div className="qhour-value mono">{horasAcumH.toFixed(1)}<span>h</span></div>
              </div>
              <div className="qhour-card">
                <div className="qhour-label">INVERTIDAS (EN TERMINADAS)</div>
                <div className="qhour-value mono" style={{ color: "var(--success)" }}>{horasInvH.toFixed(1)}<span>h</span></div>
              </div>
              <div className="qhour-card">
                <div className="qhour-label">% INVERSIÓN</div>
                <div className="qhour-value mono">{horasPct.toFixed(1)}<span>%</span></div>
              </div>
            </div>
            <div className="qhour-bar-track">
              <div className={`qhour-bar-fill ${e.level}`} style={{ width: horasPct + "%" }}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Capacity table ============
function CapacityRow({ p, active, onClick, S, onOpenParents }) {
  const stats = p.items;
  const done = stats.filter(it => it.s === "TERMINADO").length;
  const proc = stats.filter(it => /PROCESO|CERTIFIC|GESTION|ANALIS|VALIDA|PRUEBAS/i.test(it.s)).length;
  const block = stats.filter(it => it.s === "BLOQUEADOS").length;
  const init = stats.filter(it => it.s === "POR INICIAR").length;
  const tot = stats.length;
  const seg = (n) => tot ? (n/tot*100) : 0;
  const roleBadge = { dev: "DEV", qa: "QA", ux: "UX", soporte: "SOPORTE", lt: "LT", po: "PO" }[p.role] || p.role.toUpperCase();
  const parentsCount = p.parentsAssigned ? p.parentsAssigned.length : 0;

  return (
    <div className={`cap-row lvl-${p.alertaLevel} ${active ? "active" : ""} ${p.role === "soporte" ? "soporte" : ""} ${p.role === "lt" ? "is-lt" : ""}`} onClick={onClick}>
      <div className="avatar">{p.initials}</div>
      <div className="cap-person">
        <div className="cap-name">
          {p.short}
          <span className={`role-chip role-${p.role}`}>{roleBadge}</span>
        </div>
        {p.nota && <div className="cap-note">{p.nota}</div>}
        {!p.nota && <div className="cap-note">{p.itemCount} items · {fmtHours(p.estTotalSec)}</div>}
      </div>
      <div className="cap-days">
        <small>CAP</small>
        {(p.estTotalSec/3600/HOURS_PER_DAY).toFixed(1)}d/{p.capDias}d
        {p.vacImpact > 0 && <div className="cap-vac mono">vac −{p.vacImpact}d</div>}
      </div>
      <div className="cap-progress">
        <div className="cap-progress-row">
          <span className="cap-progress-label">ESP</span>
          <div className="cap-progress-track">
            <div className="cap-progress-fill exp" style={{ width: S.pctEsperado + "%" }}/>
          </div>
          <span className="cap-progress-val">{S.pctEsperado}%</span>
        </div>
        <div className="cap-progress-row">
          <span className="cap-progress-label">REAL</span>
          <div className="cap-progress-track">
            <div className={`cap-progress-fill real ${p.alertaLevel}`} style={{ width: p.pctReal + "%" }}/>
          </div>
          <span className="cap-progress-val">{p.pctReal.toFixed(1)}%</span>
        </div>
      </div>
      <div className="cap-items">
        <div className="cap-items-numbers">
          <span><b>{done}</b> done</span>
          <span><b>{proc}</b> proc</span>
          <span><b>{init}</b> pend</span>
          {block > 0 && <span style={{ color: "var(--danger)" }}><b>{block}</b> bloq</span>}
        </div>
        <div className="cap-items-bar">
          {done > 0 && <div className="seg done" style={{ width: seg(done) + "%" }}/>}
          {proc > 0 && <div className="seg proc" style={{ width: seg(proc) + "%" }}/>}
          {init > 0 && <div className="seg init" style={{ width: seg(init) + "%" }}/>}
          {block > 0 && <div className="seg block" style={{ width: seg(block) + "%" }}/>}
        </div>
      </div>
      <button
        type="button"
        className={`cap-parents ${parentsCount === 0 ? "is-empty" : ""}`}
        onClick={(ev) => { ev.stopPropagation(); if (parentsCount > 0) onOpenParents(p); }}
        title={parentsCount > 0 ? "Ver tarjetas padre asignadas" : "Sin tarjetas padre asignadas"}
      >
        <span className="cap-parents-num mono">{parentsCount}</span>
        <span className="cap-parents-lbl">padres</span>
      </button>
      <div className="cap-status">
        <span className={`cap-badge ${p.alertaLevel}`}>{p.alertaTitle}</span>
        <span className={`cap-desv ${p.alertaLevel}`}>
          {p.role === "soporte" ? "—" : (p.desv >= 0 ? "+" : "") + p.desv.toFixed(1) + "pp"}
        </span>
      </div>
    </div>
  );
}

function CapacityDetail({ p, S }) {
  const items = p.items;
  const stateOrder = { "TERMINADO": 0, "EN PROCESO": 1, "CERTIFICACION": 1, "GESTION DEL PASE": 1, "ANALISIS": 1, "BLOQUEADOS": 2, "POR INICIAR": 3 };
  const sorted = [...items].sort((a,b) => (stateOrder[a.s]??99) - (stateOrder[b.s]??99));
  function stateCls(s) {
    if (s === "TERMINADO") return "done";
    if (s === "BLOQUEADOS") return "block";
    if (s === "POR INICIAR") return "init";
    return "proc";
  }
  function stateLabel(s) {
    if (s === "TERMINADO") return "DONE";
    if (s === "BLOQUEADOS") return "BLOQ";
    if (s === "POR INICIAR") return "POR INIC";
    if (s === "CERTIFICACION") return "CERT";
    if (s === "GESTION DEL PASE") return "PASE";
    if (s === "ANALISIS") return "ANÁLISIS";
    return "EN PROC";
  }
  const pendingSec = p.pendingSec;
  return (
    <div className="cap-detail">
      <div className="cap-detail-section">
        <h4>Resumen</h4>
        <div className="cap-detail-stats">
          <div className="cap-detail-stat">
            <div className="cap-detail-stat-label">Estimación total</div>
            <div className="cap-detail-stat-value">{fmtHours(p.estTotalSec)}</div>
          </div>
          <div className="cap-detail-stat">
            <div className="cap-detail-stat-label">Capacity ajustada</div>
            <div className="cap-detail-stat-value">{p.capDias}d / {p.capHoras}h</div>
          </div>
          <div className="cap-detail-stat">
            <div className="cap-detail-stat-label">Completado</div>
            <div className="cap-detail-stat-value" style={{ color: "var(--success)" }}>{fmtHours(p.doneSec)}</div>
          </div>
          <div className="cap-detail-stat">
            <div className="cap-detail-stat-label">Pendiente</div>
            <div className="cap-detail-stat-value">{fmtHours(pendingSec)}</div>
          </div>
          <div className="cap-detail-stat">
            <div className="cap-detail-stat-label">Vacaciones</div>
            <div className="cap-detail-stat-value">{p.vacImpact > 0 ? `−${p.vacImpact}d` : "—"}</div>
          </div>
          <div className="cap-detail-stat">
            <div className="cap-detail-stat-label">% Capacity</div>
            <div className="cap-detail-stat-value">{p.role === "soporte" ? "Ver Soporte Digital" : p.pctCap.toFixed(1) + "%"}</div>
          </div>
          <div className="cap-detail-stat">
            <div className="cap-detail-stat-label">% Avance Real</div>
            <div className="cap-detail-stat-value">{p.pctReal.toFixed(1)}%</div>
          </div>
          <div className="cap-detail-stat">
            <div className="cap-detail-stat-label">Sin estimación</div>
            <div className="cap-detail-stat-value">{p.sinEst || "—"}</div>
          </div>
        </div>
      </div>
      <div className="cap-detail-section">
        <h4>Items asignados ({items.length})</h4>
        <div className="detail-items">
          {sorted.map((it, i) => (
            <div key={i} className="detail-item">
              <span className="ticket">{it.k}</span>
              <span className="summary" title={it.r}>{it.r}</span>
              <span className="est">{it.e ? fmtHours(it.e) : "—"}</span>
              <span className={`state-tag ${stateCls(it.s)}`}>{stateLabel(it.s)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CapacitySection({ S }) {
  const [selected, setSelected] = useState(null);
  const [parentsFor, setParentsFor] = useState(null);
  return (
    <div className="card">
      <div className="card-head">
        <h3>Capacity por persona</h3>
        <span className="hint">{S.team.length} integrantes · click para detalle</span>
      </div>
      <div className="cap-table">
        {S.team.map(p => (
          <React.Fragment key={p.name}>
            <CapacityRow
              p={p}
              S={S}
              active={selected === p.name}
              onClick={() => setSelected(selected === p.name ? null : p.name)}
              onOpenParents={(pp) => setParentsFor(pp)}
            />
            {selected === p.name && <CapacityDetail p={p} S={S} />}
          </React.Fragment>
        ))}
      </div>
      {parentsFor && (
        <ParentsAssignedModal person={parentsFor} onClose={() => setParentsFor(null)} />
      )}
    </div>
  );
}

function ParentsAssignedModal({ person, onClose }) {
  const parents = person.parentsAssigned || [];
  const stateOrder = { "EN PROCESO": 0, "CERTIFICACION": 0, "ANALISIS": 0, "VALIDACION": 0, "PRUEBAS DE USUARIO": 0, "BLOQUEADOS": 1, "POR INICIAR": 2, "TERMINADO": 3 };
  const sorted = [...parents].sort((a, b) => (stateOrder[a.s]??99) - (stateOrder[b.s]??99));

  // Resumen superior
  const cntInit = parents.filter(p => p.s === "POR INICIAR").length;
  const cntProc = parents.filter(p => /PROCESO|CERTIFIC|GESTION|ANALIS|VALIDA|PRUEBAS/i.test(p.s)).length;
  const cntBlock = parents.filter(p => p.s === "BLOQUEADOS").length;
  const cntDone = parents.filter(p => p.s === "TERMINADO").length;

  function stateCls(s) {
    if (s === "TERMINADO") return "done";
    if (s === "BLOQUEADOS") return "block";
    if (s === "POR INICIAR") return "init";
    return "proc";
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{person.short}</div>
            <div className="modal-sub">{parents.length} tarjetas padre asignadas</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-summary">
          <span className="psb-pill psb-init mono"><b>{cntInit}</b> por iniciar</span>
          <span className="psb-pill psb-proc mono"><b>{cntProc}</b> en proceso</span>
          {cntBlock > 0 && <span className="psb-pill psb-block mono"><b>{cntBlock}</b> bloqueados</span>}
          <span className="psb-pill psb-done mono"><b>{cntDone}</b> terminados</span>
        </div>
        <div className="modal-body">
          <div className="modal-parents">
            <div className="modal-parents-header">
              <span>KEY</span>
              <span>TIPO</span>
              <span>NOMBRE</span>
              <span>START</span>
              <span>DONE</span>
              <span>ESTADO</span>
            </div>
            {sorted.length === 0 && <div className="modal-empty">Sin tarjetas padre asignadas.</div>}
            {sorted.map((p, i) => (
              <div key={i} className={`modal-parent-row state-${stateCls(p.s)}`}>
                <span className="mono modal-parent-key">{p.k}</span>
                <span className="modal-parent-tipo">{p.t}</span>
                <span className="modal-parent-name" title={p.r}>{p.r}</span>
                <span className="mono">{p.sd ? fmtDate(p.sd) : "—"}</span>
                <span className="mono" style={{ color: p.fd ? "var(--success)" : "var(--text-3)" }}>{p.fd ? fmtDate(p.fd) : "—"}</span>
                <span className={`state-tag ${stateCls(p.s)}`}>{p.s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Charts ============
const initColors = ["var(--accent)", "var(--warning)", "var(--info)", "var(--success)", "var(--text-3)"];
const parentTypeColors = ["var(--accent)", "var(--info)", "var(--success)", "var(--warning)", "var(--danger)", "var(--text-3)"];

function IniciativasCard({ S }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>Distribución por iniciativa</h3>
        <span className="hint mono">{S.parents.length} padres del sprint</span>
      </div>
      <div className="donut-row">
        <Donut data={S.iniciativas.map(i => ({ count: i.count, name: i.tipo }))} colors={initColors} />
        <div className="donut-legend">
          {S.iniciativas.map((i, idx) => (
            <div key={i.tipo} className="legend-row" title={i.desc}>
              <span className="swatch" style={{ background: initColors[idx] }}></span>
              <span className="name">{i.tipo}</span>
              <span className="count">{i.count}</span>
              <span className="pct">{i.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ParentTypeCard({ S }) {
  // Contadores por estado (basado en _isDone derivado y _done<count)
  const ini = S.parents.filter(p => !p._isDone && p._done === 0).length;
  const proc = S.parents.filter(p => !p._isDone && p._done > 0).length;
  const done = S.parents.filter(p => p._isDone).length;
  return (
    <div className="card">
      <div className="card-head">
        <h3>Tarjetas padre por tipo</h3>
        <span className="hint mono">{S.parents.length} padres del sprint</span>
      </div>
      <div className="parent-status-summary">
        <span className="pss-pill pss-init mono"><b>{ini}</b> por iniciar</span>
        <span className="pss-pill pss-proc mono"><b>{proc}</b> en proceso</span>
        <span className="pss-pill pss-done mono"><b>{done}</b> terminadas</span>
      </div>
      <div className="donut-row">
        <Donut data={S.universoPadre.map(i => ({ count: i.count, name: i.tipo }))} colors={parentTypeColors} />
        <div className="donut-legend">
          {S.universoPadre.map((i, idx) => (
            <div key={i.tipo} className="legend-row">
              <span className="swatch" style={{ background: parentTypeColors[idx] }}></span>
              <span className="name">{i.tipo}</span>
              <span className="count">{i.count}</span>
              <span className="pct">{i.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ItemsStatusCard({ S }) {
  const t = S.universoItems.total;
  const sub = S.universoItems.subtareas;
  const bug = S.universoItems.bugs;
  const safePct = (n, d) => d > 0 ? (n/d*100) : 0;
  return (
    <div className="card">
      <div className="card-head">
        <h3>Estado de items</h3>
        <span className="hint mono">{t.total} items · {sub.total} subs + {bug.total} bugs</span>
      </div>
      <div className="items-grid">
        <div className="items-stat done">
          <div className="items-stat-label">Terminados</div>
          <div className="items-stat-value">{t.done}</div>
          <div className="items-stat-sub">{safePct(t.done,t.total).toFixed(1)}% · {sub.done} sub · {bug.done} bug</div>
        </div>
        <div className="items-stat proc">
          <div className="items-stat-label">En proceso</div>
          <div className="items-stat-value">{t.proc}</div>
          <div className="items-stat-sub">{sub.proc} sub · {bug.proc} bug</div>
        </div>
        <div className="items-stat init">
          <div className="items-stat-label">Por iniciar</div>
          <div className="items-stat-value">{t.init}</div>
          <div className="items-stat-sub">{safePct(t.init,t.total).toFixed(1)}% del total</div>
        </div>
        <div className="items-stat block">
          <div className="items-stat-label">Bloqueados</div>
          <div className="items-stat-value">{t.block}</div>
          <div className="items-stat-sub">{t.block > 0 ? "requieren escalar" : "sin bloqueos"}</div>
        </div>
      </div>
      <div className="items-bar">
        {t.done > 0 && <div className="seg done" style={{ width: safePct(t.done,t.total) + "%" }}/>}
        {t.proc > 0 && <div className="seg proc" style={{ width: safePct(t.proc,t.total) + "%" }}/>}
        {t.init > 0 && <div className="seg init" style={{ width: safePct(t.init,t.total) + "%" }}/>}
        {t.block > 0 && <div className="seg block" style={{ width: safePct(t.block,t.total) + "%" }}/>}
      </div>
      <div className="items-split">
        <div className="items-split-row">
          <span>Subtareas</span>
          <div className="items-split-bar">
            {sub.done > 0 && <div className="seg done" style={{ width: safePct(sub.done,sub.total) + "%" }}/>}
            {sub.proc > 0 && <div className="seg proc" style={{ width: safePct(sub.proc,sub.total) + "%" }}/>}
            {sub.init > 0 && <div className="seg init" style={{ width: safePct(sub.init,sub.total) + "%" }}/>}
            {sub.block > 0 && <div className="seg block" style={{ width: safePct(sub.block,sub.total) + "%" }}/>}
          </div>
          <span><b>{sub.total}</b></span>
          <span style={{ color: "var(--text-3)" }}>{sub.sinEst} s/est</span>
        </div>
        <div className="items-split-row">
          <span>Bugs</span>
          <div className="items-split-bar">
            {bug.done > 0 && <div className="seg done" style={{ width: safePct(bug.done,bug.total) + "%" }}/>}
            {bug.proc > 0 && <div className="seg proc" style={{ width: safePct(bug.proc,bug.total) + "%" }}/>}
            {bug.init > 0 && <div className="seg init" style={{ width: safePct(bug.init,bug.total) + "%" }}/>}
            {bug.block > 0 && <div className="seg block" style={{ width: safePct(bug.block,bug.total) + "%" }}/>}
          </div>
          <span><b>{bug.total}</b></span>
          <span style={{ color: bug.sinEst > 0 ? "var(--danger)" : "var(--text-3)" }}>{bug.sinEst} s/est</span>
        </div>
      </div>
    </div>
  );
}

// ============ Alerts ============
function AlertCard({ a }) {
  return (
    <div className={`alert ${a.level}`}>
      <div className="alert-head">
        <div className="alert-name">
          <span className={`avatar`}>{initials(a.name)}</span>
          <span>{shortName(a.name)}</span>
        </div>
        <span className={`alert-title-badge ${a.level}`}>{a.title}</span>
      </div>
      <div className="alert-text">{a.text}</div>
    </div>
  );
}

function AlertsSection({ S }) {
  return (
    <>
      <div className="section-title">
        <h2>Alertas · acción recomendada</h2>
        <span className="line"></span>
        <span className="hint mono" style={{ fontSize: 11, color: "var(--text-3)" }}>{S.alertas.length} personas</span>
      </div>
      <div className="alerts-grid">
        {S.alertas.map(a => <AlertCard key={a.name} a={a} />)}
      </div>
    </>
  );
}

// ============ Parents Section ============
function ParentsSection({ S }) {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState(null); // "init" | "curso" | "block" | "done" | null

  function bucketOf(p) {
    if (p._isDone) return "done";
    if (p.s === "BLOQUEADOS") return "block";
    if (p._done > 0) return "curso";
    return "init";
  }

  const ordered = useMemo(() => {
    const arr = S.parents.map(p => ({
      ...p,
      pct: p._count > 0 ? p._done / p._count : (p._isDone ? 1 : 0),
      _bucket: bucketOf(p),
    }));
    arr.sort((a, b) => {
      const aDone = a._isDone, bDone = b._isDone;
      if (aDone !== bDone) return aDone ? -1 : 1;
      if (b.pct !== a.pct) return b.pct - a.pct;
      return b._count - a._count;
    });
    return arr;
  }, [S.parents]);

  function stateCls(s) {
    if (s === "TERMINADO") return "done";
    if (s === "BLOQUEADOS") return "block";
    if (s === "POR INICIAR") return "init";
    return "proc";
  }
  function stateLabel(s) {
    if (s === "TERMINADO") return "DONE";
    if (s === "BLOQUEADOS") return "BLOQ";
    if (s === "POR INICIAR") return "POR INIC";
    if (s === "CERTIFICACION") return "CERT";
    if (s === "GESTION DEL PASE") return "PASE";
    if (s === "ANALISIS") return "ANÁLISIS";
    if (s === "VALIDACION") return "VALIDA";
    if (s === "PRUEBAS DE USUARIO") return "PRUEBAS";
    return "EN PROC";
  }

  // Compute responsible per parent
  function responsableOf(p) {
    if (!p._subs.length) return p.a || "—";
    const counts = {};
    p._subs.forEach(s => { if (s.a) counts[s.a] = (counts[s.a]||0) + 1; });
    const list = Object.entries(counts).sort((a,b) => b[1]-a[1]);
    return list.length ? list[0][0] : (p.a || "—");
  }
  function othersOf(p) {
    if (!p._subs.length) return 0;
    const set = new Set(p._subs.map(s => s.a).filter(Boolean));
    return Math.max(0, set.size - 1);
  }

  // Status summary counts
  const ini = ordered.filter(p => p._bucket === "init").length;
  const curso = ordered.filter(p => p._bucket === "curso").length;
  const block = ordered.filter(p => p._bucket === "block").length;
  const done = ordered.filter(p => p._bucket === "done").length;

  const filtered = filter ? ordered.filter(p => p._bucket === filter) : ordered;
  const filterLabels = { init: "por iniciar", curso: "en curso", block: "bloqueados", done: "terminados" };

  return (
    <>
      <div className="section-title">
        <h2>Iniciativas padre — Progreso por subtareas</h2>
        <span className="line"></span>
        <span className="hint mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
          {filtered.length}{filter ? ` / ${ordered.length}` : ""} padres
          {filter ? ` · filtrado: ${filterLabels[filter]}` : " · click para ver subtareas"}
        </span>
      </div>
      <div className="card" style={{ padding: "8px 16px 16px" }}>
        <div className="parents-status-bar">
          <button
            type="button"
            className={`psb-pill psb-init mono ${filter === "init" ? "is-active" : ""}`}
            onClick={() => setFilter(filter === "init" ? null : "init")}
          ><b>{ini}</b> por iniciar</button>
          <button
            type="button"
            className={`psb-pill psb-proc mono ${filter === "curso" ? "is-active" : ""}`}
            onClick={() => setFilter(filter === "curso" ? null : "curso")}
          ><b>{curso}</b> en curso</button>
          {block > 0 && (
            <button
              type="button"
              className={`psb-pill psb-block mono ${filter === "block" ? "is-active" : ""}`}
              onClick={() => setFilter(filter === "block" ? null : "block")}
            ><b>{block}</b> bloqueados</button>
          )}
          <button
            type="button"
            className={`psb-pill psb-done mono ${filter === "done" ? "is-active" : ""}`}
            onClick={() => setFilter(filter === "done" ? null : "done")}
          ><b>{done}</b> terminados</button>
          {filter && (
            <button type="button" className="psb-clear" onClick={() => setFilter(null)}>
              ✕ Quitar filtro
            </button>
          )}
        </div>
        <div className="parents-table">
          <div className="parents-header">
            <span>KEY</span>
            <span>NOMBRE</span>
            <span style={{ textAlign: "right" }}>SUBS</span>
            <span>PROGRESO</span>
            <span>ESTADO</span>
            <span>RESPONSABLE</span>
          </div>
          {filtered.length === 0 && (
            <div className="parents-empty">No hay tarjetas padre en este filtro.</div>
          )}
          {filtered.map(p => {
            const resp = responsableOf(p);
            const others = othersOf(p);
            const isSel = selected === p.k;
            return (
              <React.Fragment key={p.k}>
                <div
                  className={`parent-row ${p._isDone ? "is-done" : "is-progress"} ${isSel ? "is-selected" : ""}`}
                  onClick={() => setSelected(isSel ? null : p.k)}
                >
                  <span className="parent-key">
                    <span className="parent-chevron">{isSel ? "▾" : "▸"}</span>
                    {p.k}
                  </span>
                  <span className="parent-name" title={p.r}>
                    {p._isDone && <span className="parent-check">✓</span>}
                    {p.r}
                  </span>
                  <span className="parent-count">{p._done}/{p._count}</span>
                  <span className="parent-progress">
                    <span className="parent-progress-track">
                      <span className={`parent-progress-fill ${p._isDone ? "done" : ""}`} style={{ width: (p._count > 0 ? p._done/p._count*100 : (p._isDone ? 100 : 0)) + "%" }}/>
                    </span>
                    <span className="parent-progress-val">{p._count > 0 ? Math.round(p._done/p._count*100) : (p._isDone ? 100 : 0)}%</span>
                  </span>
                  <span className={`parent-state state-tag ${stateCls(p.s)}`}>{stateLabel(p.s)}</span>
                  <span className="parent-resp">
                    <span className="parent-resp-avatar">{initials(resp)}</span>
                    <span className="parent-resp-text">
                      <span className="parent-resp-name">{shortName(resp)}</span>
                      {others > 0 && <span className="parent-resp-others">+{others}</span>}
                    </span>
                  </span>
                </div>
                {isSel && (
                  <div className="parent-detail">
                    <ParentDetail subs={p._subs} stateCls={stateCls} stateLabel={stateLabel} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </>
  );
}

function ParentDetail({ subs, stateCls, stateLabel }) {
  const stateOrder = { "EN PROCESO": 0, "CERTIFICACION": 0, "GESTION DEL PASE": 0, "ANALISIS": 0, "BLOQUEADOS": 1, "POR INICIAR": 2, "TERMINADO": 3 };
  const sorted = [...subs].sort((a, b) => (stateOrder[a.s]??99) - (stateOrder[b.s]??99));

  const total = subs.length;
  const done = subs.filter(s => s.s === "TERMINADO").length;
  const proc = subs.filter(s => /PROCESO|CERTIFIC|GESTION|ANALIS/i.test(s.s)).length;
  const block = subs.filter(s => s.s === "BLOQUEADOS").length;
  const init = subs.filter(s => s.s === "POR INICIAR").length;

  const totalSec = subs.reduce((s, x) => s + (x.e || 0), 0);
  const doneSec = subs.filter(s => s.s === "TERMINADO").reduce((s, x) => s + (x.e || 0), 0);

  const byAssignee = {};
  subs.forEach(it => { const a = it.a || "Sin asignar"; byAssignee[a] = (byAssignee[a] || 0) + 1; });
  const assignees = Object.entries(byAssignee).sort((a, b) => b[1] - a[1]);

  return (
    <div className="parent-detail-inner">
      <div className="parent-detail-summary">
        <div className="pds-stat"><span className="pds-label">SUBTAREAS</span><span className="pds-value">{total}</span></div>
        <div className="pds-stat"><span className="pds-label">TERMINADAS</span><span className="pds-value" style={{ color: "var(--success)" }}>{done}</span></div>
        <div className="pds-stat"><span className="pds-label">EN PROCESO</span><span className="pds-value" style={{ color: "var(--info)" }}>{proc}</span></div>
        <div className="pds-stat"><span className="pds-label">POR INICIAR</span><span className="pds-value">{init}</span></div>
        {block > 0 && <div className="pds-stat"><span className="pds-label">BLOQUEADAS</span><span className="pds-value" style={{ color: "var(--danger)" }}>{block}</span></div>}
        <div className="pds-stat"><span className="pds-label">ESFUERZO</span><span className="pds-value mono">{fmtHours(doneSec)} <span style={{ color: "var(--text-3)", fontSize: 11 }}>/ {fmtHours(totalSec)}</span></span></div>
        <div className="pds-stat pds-stat-team">
          <span className="pds-label">EQUIPO ASIGNADO</span>
          <span className="pds-team">
            {assignees.map(([name, count]) => (
              <span key={name} className="pds-chip" title={name}>
                <span className="pds-chip-init">{initials(name)}</span>
                <span className="pds-chip-count">{count}</span>
              </span>
            ))}
          </span>
        </div>
      </div>

      <div className="subs-table-wrap">
        <div className="subs-table">
          <div className="subs-header">
            <span>TICKET</span>
            <span>RESUMEN</span>
            <span>ASIGNADO</span>
            <span style={{ textAlign: "right" }}>EST.</span>
            <span>INICIO</span>
            <span>FIN</span>
            <span>ESTADO</span>
          </div>
          {sorted.map((s, i) => {
            const isDone = s.s === "TERMINADO";
            return (
              <div key={i} className={`subs-row state-${stateCls(s.s)}`}>
                <span className="subs-ticket mono">{s.k}</span>
                <span className="subs-summary" title={s.r}>{s.r}</span>
                <span className="subs-assignee">
                  <span className="subs-assignee-init">{initials(s.a)}</span>
                  <span className="subs-assignee-name">{shortName(s.a)}</span>
                </span>
                <span className="subs-est mono">{s.e ? fmtHours(s.e) : "—"}</span>
                <span className="subs-date mono">{fmtDate(s.sd)}</span>
                <span className="subs-date mono" style={{ color: isDone ? "var(--success)" : "var(--text-3)" }}>{fmtDate(s.fd)}</span>
                <span className={`subs-state state-tag ${stateCls(s.s)}`}>{stateLabel(s.s)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ Tweaks ============
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "accent": "blue",
  "compact": false
}/*EDITMODE-END*/;

function App() {
  const [sprintNum, setSprintNum] = useState(CFG.currentSprint || 3);
  const [includeLT, setIncludeLT] = useState(false);
  const [t, setTweak] = window.useTweaks ? window.useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];

  useEffect(() => {
    document.body.classList.toggle("light", t.theme === "light");
    const root = document.documentElement;
    const map = {
      blue: "oklch(0.78 0.13 220)",
      teal: "oklch(0.78 0.13 180)",
      violet: "oklch(0.78 0.13 280)",
      amber: "oklch(0.82 0.15 70)",
      green: "oklch(0.78 0.16 150)",
    };
    if (map[t.accent]) {
      root.style.setProperty("--accent", map[t.accent]);
      root.style.setProperty("--accent-dim", map[t.accent].replace("0.78", "0.62"));
    }
    document.body.classList.toggle("compact", !!t.compact);
  }, [t.theme, t.accent, t.compact]);

  const S = useMemo(() => computeSprint(sprintNum, includeLT), [sprintNum, includeLT]);
  const Q = useMemo(() => computeQuarterly(includeLT), [includeLT]);

  const TweaksPanel = window.TweaksPanel;
  const TweakSection = window.TweakSection;
  const TweakRadio = window.TweakRadio;
  const TweakToggle = window.TweakToggle;

  return (
    <>
      <Header sprintNum={sprintNum} setSprintNum={setSprintNum} S={S} includeLT={includeLT} setIncludeLT={setIncludeLT} />
      <KPIs S={S} />
      <QuarterlySection Q={Q} />
      <div className="grid">
        <CapacitySection S={S} />
        <div className="right-col">
          <IniciativasCard S={S} />
          <ParentTypeCard S={S} />
          <ItemsStatusCard S={S} />
        </div>
      </div>
      <AlertsSection S={S} />
      <ParentsSection S={S} />

      {TweaksPanel && (
        <TweaksPanel title="Tweaks">
          <TweakSection title="Apariencia">
            <TweakRadio label="Tema" value={t.theme} options={[{label:"Oscuro",value:"dark"},{label:"Claro",value:"light"}]} onChange={v => setTweak("theme", v)} />
            <TweakRadio label="Acento" value={t.accent} options={[{label:"Azul",value:"blue"},{label:"Teal",value:"teal"},{label:"Violeta",value:"violet"}]} onChange={v => setTweak("accent", v)} />
          </TweakSection>
        </TweaksPanel>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
