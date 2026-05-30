"""
Capacity Sync Service — Parse Jira data and compute squad metrics

Transforms raw Jira issues → normalized capacity dashboard structure
Computes per-sprint metrics: team capacity, progress, alerts
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Set, Tuple
import math

# ============ DATA STRUCTURES ============

class CapacityConfig:
    """Squad configuration: sprints, roles, vacations, exclusions"""
    def __init__(self, project_key: str, squad_name: str):
        self.squad = squad_name
        self.project_key = project_key
        self.current_sprint = 4
        self.corte = datetime.now().strftime("%Y-%m-%d")
        self.quarter_end = "2026-06-30"
        self.sprints = {}
        self.roles = {}
        self.vacaciones = {}
        self.excluidos = set()
        self.notas = {}

class JiraIssue:
    """Normalized Jira issue"""
    def __init__(self):
        self.t = None  # tipo: Spike, Sub, Bug, Historia de Usuario, Epic
        self.k = None  # key: SPI-398
        self.r = None  # resumen
        self.e = None  # esfuerzo en segundos
        self.s = None  # estado: TERMINADO, EN PROCESO, BLOQUEADOS, POR INICIAR
        self.a = None  # asignado (person name)
        self.pk = None  # parent key (for items)
        self.ek = None  # epic key
        self.ini = None  # tipo iniciativa: Nuevas, Pedidos No Planificados, etc
        self.sp = []  # sprints: [2, 3, 4]
        self.sd = None  # start date
        self.due = None  # due date
        self.fd = None  # finish date (Fecha Done)

# ============ PARSING ============

def parse_csv_row(row: Dict[str, str], project_key: str) -> Optional[JiraIssue]:
    """
    Parse single CSV row to JiraIssue

    CSV format: tipo;clave;id;resumen;estimación;estado;sp;sp;asignado;...
    """
    if not row.get("Tipo de Incidencia"):
        return None

    issue = JiraIssue()
    issue.t = row.get("Tipo de Incidencia", "").strip()
    issue.k = row.get("Clave de incidencia", "").strip()
    issue.r = row.get("Resumen", "").strip()
    issue.s = row.get("Estado", "").strip()
    issue.a = row.get("Persona asignada", "").strip() or None

    # Parse effort (in seconds)
    estim_str = row.get("Estimación original", "").strip()
    if estim_str and estim_str.isdigit():
        issue.e = int(estim_str)

    # Parse parent key
    issue.pk = row.get("Clave principal", "").strip() or None
    issue.ek = issue.pk if issue.t == "Epic" or issue.t.lower() in ["historia de usuario", "spike"] else None

    # Parse initiative type
    issue.ini = row.get("Campo personalizado (Tipo de Iniciativa)", "").strip() or None

    # Parse sprints (multiple Sprint columns)
    sprints = []
    for sprint_col in ["Sprint", "Sprint_1", "Sprint_2", "Sprint_3"]:
        sprint_val = row.get(sprint_col, "").strip()
        if sprint_val:
            # Extract sprint number from "Sprint 2" → 2
            parts = sprint_val.split()
            if len(parts) >= 2 and parts[1].isdigit():
                sprints.append(int(parts[1]))
            elif sprint_val.isdigit():
                sprints.append(int(sprint_val))
    issue.sp = list(set(sprints))  # Remove duplicates

    # Parse dates
    issue.sd = parse_date(row.get("Campo personalizado (Start date)", ""))
    issue.due = parse_date(row.get("Fecha de vencimiento", ""))
    issue.fd = parse_date(row.get("Campo personalizado (Fecha Done)", ""))

    return issue

def parse_date(date_str: str) -> Optional[str]:
    """Parse date string (DD/MM/YY HH:MM) to ISO format (YYYY-MM-DD)"""
    if not date_str or not date_str.strip():
        return None

    try:
        # Format: "15/04/26 10:30"
        parts = date_str.strip().split()
        date_part = parts[0] if parts else ""

        if not date_part:
            return None

        day, month, year = date_part.split("/")
        year = f"20{year}"
        return f"{year}-{month}-{day}"
    except:
        return None

# ============ SPRINT CONFIGURATION ============

def build_sprint_config() -> Dict[int, Dict[str, Any]]:
    """
    Hardcoded sprint configuration for SPI/SVI squads
    (In production, load from Jira board config)
    """
    return {
        1: {"num": 1, "nombre": "Sprint 1", "rango": "08/04 – 21/04", "start": "2026-04-08", "end": "2026-04-21", "diasHabiles": 10, "feriados": 0, "efectivos": 10, "capMaxDias": 8, "capMaxHoras": 64},
        2: {"num": 2, "nombre": "Sprint 2", "rango": "22/04 – 05/05", "start": "2026-04-22", "end": "2026-05-05", "diasHabiles": 10, "feriados": 1, "efectivos": 9, "capMaxDias": 8, "capMaxHoras": 64},
        3: {"num": 3, "nombre": "Sprint 3", "rango": "06/05 – 19/05", "start": "2026-05-06", "end": "2026-05-19", "diasHabiles": 10, "feriados": 0, "efectivos": 10, "capMaxDias": 9, "capMaxHoras": 72},
        4: {"num": 4, "nombre": "Sprint 4", "rango": "20/05 – 02/06", "start": "2026-05-20", "end": "2026-06-02", "diasHabiles": 10, "feriados": 0, "efectivos": 10, "capMaxDias": 9, "capMaxHoras": 72},
        5: {"num": 5, "nombre": "Sprint 5", "rango": "03/06 – 16/06", "start": "2026-06-03", "end": "2026-06-16", "diasHabiles": 10, "feriados": 0, "efectivos": 10, "capMaxDias": 9, "capMaxHoras": 72},
        6: {"num": 6, "nombre": "Sprint 6", "rango": "17/06 – 30/06", "start": "2026-06-17", "end": "2026-06-30", "diasHabiles": 10, "feriados": 1, "efectivos": 9, "capMaxDias": 8, "capMaxHoras": 64},
    }

# ============ UTILITIES ============

HOURS_PER_DAY = 8

def sec_to_hours(sec: int) -> float:
    """Convert seconds to hours"""
    return (sec or 0) / 3600

def count_business_days(start_iso: str, end_iso: str) -> int:
    """Count Mon-Fri between two dates (inclusive)"""
    try:
        s = datetime.fromisoformat(start_iso)
        e = datetime.fromisoformat(end_iso)
        n = 0
        current = s
        while current <= e:
            dow = current.weekday()  # 0=Mon, 6=Sun
            if dow < 5:  # Mon-Fri
                n += 1
            current += timedelta(days=1)
        return n
    except:
        return 0

def today_iso() -> str:
    """Get today as ISO string"""
    return datetime.now().strftime("%Y-%m-%d")

def short_name(full: str) -> str:
    """Extract short name"""
    if not full:
        return "—"
    parts = full.split()
    if len(parts) <= 2:
        return full
    return f"{parts[0]} {parts[-1]}"

def initials(full: str) -> str:
    """Extract initials"""
    if not full:
        return "—"
    parts = [p for p in full.split() if p]
    if not parts:
        return "—"
    return f"{parts[0][0]}{parts[-1][0]}".upper()

# ============ SPRINT COMPUTATION ============

def compute_sprint(sprint_num: int, items: List[JiraIssue], parents: List[JiraIssue], config: Dict[str, Any]) -> Dict[str, Any]:
    """Compute all metrics for a given sprint"""
    sp_config = config["sprints"].get(sprint_num, {})
    sprint_start = sp_config.get("start")
    sprint_end = sp_config.get("end")

    excluidos = set(config.get("excluidos", []))
    epicas_excluidas = set(config.get("epicasExcluidas", []))

    # Filter items for this sprint
    filtered_items = []
    for item in items:
        if item.a and item.a in excluidos:
            continue
        if item.s == "CANCELADOS":
            continue
        if sprint_num not in item.sp:
            continue
        if item.s == "TERMINADO" and item.fd and item.fd < sprint_start:
            continue
        if item.s == "TERMINADO" and item.fd and item.fd > sprint_end:
            continue
        filtered_items.append(item)

    # Filter parents for this sprint
    referenced_parent_keys = set(i.pk for i in filtered_items if i.pk)
    filtered_parents = []
    for parent in parents:
        if parent.a and parent.a in excluidos:
            continue
        if parent.s == "CANCELADOS":
            continue
        if parent.ek and parent.ek in epicas_excluidas:
            continue
        if parent.s == "TERMINADO" and parent.fd and parent.fd < sprint_start:
            continue
        tagged = sprint_num in parent.sp
        is_referenced = parent.k in referenced_parent_keys
        if tagged or is_referenced:
            filtered_parents.append(parent)

    # Add computed fields to parents
    for p in filtered_parents:
        p._subs = [i for i in filtered_items if i.pk == p.k]
        p._count = len(p._subs)
        p._done = len([i for i in p._subs if i.s == "TERMINADO"])
        p._isDone = p.s == "TERMINADO" or (p._count > 0 and p._done == p._count)

    # Sprint timing
    today = today_iso()
    if today < sprint_start:
        dias_transcurridos = 0
        pct_esperado = 0
    elif today > sprint_end:
        dias_transcurridos = sp_config.get("efectivos", 10)
        pct_esperado = 100
    else:
        bd = count_business_days(sprint_start, today)
        dias_transcurridos = min(bd, sp_config.get("efectivos", 10))
        pct_esperado = round((dias_transcurridos / sp_config.get("efectivos", 10)) * 100)

    # Team capacity metrics
    people_map = {}
    for item in filtered_items:
        if not item.a or item.a in excluidos:
            continue
        if item.a not in people_map:
            people_map[item.a] = []
        people_map[item.a].append(item)

    def vac_impact_days(person_name: str) -> int:
        vacs = config.get("vacaciones", {}).get(person_name, [])
        impact = 0
        for [vs, ve] in vacs:
            if ve < sprint_start or vs > sprint_end:
                continue
            o_start = max(vs, sprint_start)
            o_end = min(ve, sprint_end)
            impact += count_business_days(o_start, o_end)
        cap_max = sp_config.get("capMaxDias", 8)
        return min(impact, cap_max)

    team = []
    for person_name, p_items in people_map.items():
        role = config.get("roles", {}).get(person_name, "dev")
        vac_impact = vac_impact_days(person_name)
        cap_dias = max(0, sp_config.get("capMaxDias", 8) - vac_impact)
        cap_horas = cap_dias * HOURS_PER_DAY

        est_total_sec = sum(i.e or 0 for i in p_items)
        done_sec = sum(i.e or 0 for i in p_items if i.s == "TERMINADO")
        pending_sec = est_total_sec - done_sec

        pct_real = (done_sec / est_total_sec * 100) if est_total_sec > 0 else 0
        pct_cap = (est_total_sec / 3600) / cap_horas * 100 if cap_horas > 0 else 0
        sin_est = len([i for i in p_items if not i.e or i.e == 0])

        desv = pct_real - pct_esperado

        # Alert level
        if role == "soporte":
            alerta_level = "soporte"
            alerta_title = "SOPORTE"
        elif desv <= -30:
            alerta_level = "critico"
            alerta_title = "CRÍTICO"
        elif desv <= -15:
            alerta_level = "atraso"
            alerta_title = "ATRASO"
        elif desv <= -5:
            alerta_level = "revisar"
            alerta_title = "REVISAR"
        else:
            alerta_level = "linea"
            alerta_title = "EN LÍNEA"

        # Capacity level
        if pct_cap >= 90:
            cap_level = "alta"
        elif pct_cap >= 60:
            cap_level = "media"
        elif pct_cap >= 30:
            cap_level = "baja"
        else:
            cap_level = "muybaja"

        team.append({
            "name": person_name,
            "short": short_name(person_name),
            "initials": initials(person_name),
            "role": role,
            "nota": config.get("notas", {}).get(person_name),
            "vacImpact": vac_impact,
            "capDias": cap_dias,
            "capHoras": cap_horas,
            "itemCount": len(p_items),
            "subs": len([i for i in p_items if i.t == "Sub"]),
            "bugs": len([i for i in p_items if i.t == "Bug"]),
            "estTotalSec": est_total_sec,
            "doneSec": done_sec,
            "pendingSec": pending_sec,
            "sinEst": sin_est,
            "pctReal": round(pct_real, 1),
            "pctCap": round(pct_cap, 1),
            "desv": round(desv, 1),
            "alertaLevel": alerta_level,
            "alertaTitle": alerta_title,
            "capLevel": cap_level,
        })

    # Sort team
    alerta_order = {"critico": 0, "atraso": 1, "revisar": 2, "linea": 3, "soporte": 4}
    role_order = {"dev": 0, "qa": 0, "ux": 0, "soporte": 1, "lt": 2, "po": 3}
    team.sort(key=lambda t: (role_order.get(t["role"], 99), alerta_order.get(t["alertaLevel"], 99), -t["itemCount"]))

    # Avance metrics
    padres_done = len([p for p in filtered_parents if p._isDone])
    padres_total = len(filtered_parents)
    avance_padres = (padres_done / padres_total * 100) if padres_total > 0 else 0

    h_total_sec = sum(i.e or 0 for i in filtered_items)
    h_done_sec = sum(i.e or 0 for i in filtered_items if i.s == "TERMINADO")
    avance_horas = (h_done_sec / h_total_sec * 100) if h_total_sec > 0 else 0

    # Alertas
    alertas = []
    for t in team:
        if t["role"] == "soporte":
            text = f"Avance {t['pctReal']:.0f}%. {short_name(t['name'])} · Soporte Digital — esfuerzo en tablero distinto."
        else:
            desv_str = f"+{t['desv']:.1f}" if t['desv'] >= 0 else f"{t['desv']:.1f}"
            hours_total = sec_to_hours(t['estTotalSec'])
            sin_est_str = f" · {t['sinEst']} s/est" if t['sinEst'] else ""
            text = f"Avance {t['pctReal']:.1f}% vs {pct_esperado}% esp. ({desv_str}pp). {t['itemCount']} items · {hours_total:.1f}h{sin_est_str}."

        alertas.append({
            "name": t["name"],
            "level": t["alertaLevel"],
            "title": t["alertaTitle"],
            "text": text,
        })

    alertas.sort(key=lambda a: alerta_order.get(a["level"], 99))

    return {
        "sp": sp_config,
        "today": today,
        "diasTranscurridos": dias_transcurridos,
        "pctEsperado": pct_esperado,
        "items": [vars(i) for i in filtered_items],
        "parents": [vars(p) for p in filtered_parents],
        "team": team,
        "avancePadres": round(avance_padres, 1),
        "avanceHoras": round(avance_horas, 1),
        "hTotalSec": h_total_sec,
        "hDoneSec": h_done_sec,
        "padresDone": padres_done,
        "padresTotal": padres_total,
        "alertas": alertas,
    }

# ============ MAIN EXPORT ============

def build_capacity_dashboard(project_key: str, sprint_num: int, issues_data: List[Dict[str, str]], config_overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Main function: Build complete capacity dashboard from raw Jira data"""
    # Parse issues
    all_issues = []
    for row in issues_data:
        issue = parse_csv_row(row, project_key)
        if issue:
            all_issues.append(issue)

    # Separate parents and items
    parents = [i for i in all_issues if i.t in ["Spike", "Historia de Usuario", "Epic", "Task"]]
    items = [i for i in all_issues if i.t in ["Sub", "Subtarea", "Bug"]]

    # Build config
    base_config = {
        "sprint": sprint_num,
        "sprints": build_sprint_config(),
        "roles": {},
        "vacaciones": {},
        "excluidos": [],
        "notas": {},
    }
    if config_overrides:
        base_config.update(config_overrides)

    # Compute sprint metrics
    computed = compute_sprint(sprint_num, items, parents, base_config)

    return {
        "config": base_config,
        "parents": [vars(p) for p in parents],
        "items": [vars(i) for i in items],
        "computed": computed,
    }


def build_capacity_dashboard_from_issues(
    project_key: str,
    sprint_num: int,
    issues: List["JiraIssue"],
    config_overrides: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Build capacity dashboard from pre-parsed JiraIssue objects (e.g. from Supabase).
    Skips CSV parsing — issues are already in JiraIssue format.

    Clasificación:
    - Parents: Story / Historia de Usuario / Epic / Feature
    - Items: Task / Bug / Sub-task / Subtarea / demás tipos
    """
    PARENT_TYPES = {"Story", "Historia de Usuario", "Epic", "Feature"}

    parents = [i for i in issues if i.t in PARENT_TYPES]
    items   = [i for i in issues if i.t not in PARENT_TYPES]

    # Si no hay ninguno en ninguna categoría, poner todo como items
    if not items and not parents:
        items = issues

    base_config = {
        "sprint": sprint_num,
        "sprints": build_sprint_config(),
        "roles": {},
        "vacaciones": {},
        "excluidos": [],
        "notas": {},
    }
    if config_overrides:
        base_config.update(config_overrides)

    computed = compute_sprint(sprint_num, items, parents, base_config)

    return {
        "config": base_config,
        "parents": [vars(p) for p in parents],
        "items": [vars(i) for i in items],
        "computed": computed,
    }
