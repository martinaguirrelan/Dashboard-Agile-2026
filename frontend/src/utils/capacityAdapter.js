import { ALERT_RULES } from "../constants/capacityConstants";

export const buildKPIMetrics = (issues) => {
  if (!issues || issues.length === 0) {
    return {
      parentsPercent: 0,
      hoursPercent: 0,
      estimado: 0,
      items: issues.length,
      alertas: 0,
      deltaPercent: 0,
    };
  }

  const parentIssues = issues.filter((i) => !i.parent_issue_key);
  const childIssues = issues.filter((i) => i.parent_issue_key);

  const totalStoryPoints = issues.reduce((sum, i) => sum + (i.story_points || 0), 0);
  const doneStoryPoints = issues
    .filter((i) => i.estado && i.estado.toLowerCase().includes("hecho"))
    .reduce((sum, i) => sum + (i.story_points || 0), 0);

  const alertas = issues.filter(
    (i) => ALERT_RULES.isBlocker(i) || ALERT_RULES.isOverdue(i) || ALERT_RULES.isStuck(i)
  ).length;

  return {
    parentsPercent: parentIssues.length > 0 ? Math.round((parentIssues.length / issues.length) * 100) : 0,
    hoursPercent: totalStoryPoints > 0 ? Math.round((doneStoryPoints / totalStoryPoints) * 100) : 0,
    estimado: totalStoryPoints,
    items: issues.length,
    alertas,
    deltaPercent: totalStoryPoints > 0 ? Math.round((doneStoryPoints / totalStoryPoints) * 100) : 0,
  };
};

export const buildParentIssuesWithChildren = (issues) => {
  const parentMap = new Map();
  const rootParents = [];

  issues.forEach((issue) => {
    if (!issue.parent_issue_key) {
      const parent = { ...issue, children: [] };
      parentMap.set(issue.jira_issue_id, parent);
      rootParents.push(parent);
    }
  });

  issues.forEach((issue) => {
    if (issue.parent_issue_key) {
      const parent = parentMap.get(issue.parent_issue_key);
      if (parent) {
        parent.children.push(issue);
      }
    }
  });

  return rootParents;
};

export const buildCapacityByPerson = (issues) => {
  const personMap = new Map();

  issues.forEach((issue) => {
    const assignee = issue.assignee || "Unassigned";
    if (!personMap.has(assignee)) {
      personMap.set(assignee, {
        name: assignee,
        totalStoryPoints: 0,
        doneStoryPoints: 0,
        inProgressStoryPoints: 0,
        todoStoryPoints: 0,
        items: 0,
        sprints: new Set(),
        issues: [],
        blockers: 0,
      });
    }

    const person = personMap.get(assignee);
    person.items += 1;
    person.totalStoryPoints += issue.story_points || 0;
    person.issues.push(issue);
    if (issue.sprint_key) {
      person.sprints.add(issue.sprint_key);
    }

    const estado = issue.estado?.toLowerCase() || "";
    if (estado.includes("hecho")) {
      person.doneStoryPoints += issue.story_points || 0;
    } else if (estado.includes("proceso")) {
      person.inProgressStoryPoints += issue.story_points || 0;
    } else {
      person.todoStoryPoints += issue.story_points || 0;
    }

    if (ALERT_RULES.isBlocker(issue)) {
      person.blockers += 1;
    }
  });

  return Array.from(personMap.values()).map((p) => ({
    ...p,
    sprints: Array.from(p.sprints),
    donePercent: p.totalStoryPoints > 0 ? Math.round((p.doneStoryPoints / p.totalStoryPoints) * 100) : 0,
  }));
};

export const buildChartData = (issues) => {
  // Status distribution
  const statusCounts = {
    done: 0,
    inProgress: 0,
    todo: 0,
  };

  issues.forEach((issue) => {
    const estado = issue.estado?.toLowerCase() || "";
    if (estado.includes("hecho")) {
      statusCounts.done += 1;
    } else if (estado.includes("proceso")) {
      statusCounts.inProgress += 1;
    } else {
      statusCounts.todo += 1;
    }
  });

  // Sprint progress
  const sprintMap = new Map();
  issues.forEach((issue) => {
    const sprint = issue.sprint_key || "No Sprint";
    if (!sprintMap.has(sprint)) {
      sprintMap.set(sprint, { total: 0, done: 0 });
    }
    const s = sprintMap.get(sprint);
    s.total += 1;
    if (issue.estado?.toLowerCase().includes("hecho")) {
      s.done += 1;
    }
  });

  // Team load (story points by person and status)
  const teamLoad = new Map();
  issues.forEach((issue) => {
    const assignee = issue.assignee || "Unassigned";
    if (!teamLoad.has(assignee)) {
      teamLoad.set(assignee, { done: 0, inProgress: 0, todo: 0 });
    }
    const load = teamLoad.get(assignee);
    const sp = issue.story_points || 0;
    const estado = issue.estado?.toLowerCase() || "";
    if (estado.includes("hecho")) {
      load.done += sp;
    } else if (estado.includes("proceso")) {
      load.inProgress += sp;
    } else {
      load.todo += sp;
    }
  });

  return {
    statusCounts,
    sprintProgress: Object.fromEntries(sprintMap),
    teamLoad: Object.fromEntries(teamLoad),
  };
};

export const buildIssueTypeDistribution = (issues) => {
  const typeMap = new Map();
  issues.forEach((issue) => {
    const type = issue.issue_type || "Other";
    typeMap.set(type, (typeMap.get(type) || 0) + 1);
  });
  return Object.fromEntries(typeMap);
};
