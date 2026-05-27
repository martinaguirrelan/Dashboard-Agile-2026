import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export const fetchCapacityByQuarter = async (quarter, projectKey) => {
  try {
    const response = await axios.get(`${API_BASE}/api/issues/capacity/${quarter}`);
    const data = response.data;

    if (projectKey) {
      return {
        ...data,
        issues: Array.isArray(data.issues) ? data.issues.filter((i) => i.project_key === projectKey) : [],
      };
    }
    return data;
  } catch (error) {
    console.error(`Error fetching capacity for ${quarter}:`, error);
    return {
      quarter,
      total_issues: 0,
      total_story_points: 0,
      done: 0,
      in_progress: 0,
      todo: 0,
      issues: [],
    };
  }
};

export const fetchIssuesByQuarter = async (quarter, projectKey) => {
  try {
    const response = await axios.get(`${API_BASE}/api/issues/quarter/${quarter}`);
    let issues = response.data;

    if (projectKey) {
      issues = issues.filter((i) => i.project_key === projectKey);
    }

    return issues;
  } catch (error) {
    console.error(`Error fetching issues for ${quarter}:`, error);
    return [];
  }
};

export const fetchSprintIssues = async (sprintKey, projectKey) => {
  try {
    const response = await axios.get(`${API_BASE}/api/issues/sprint/${sprintKey}`);
    let issues = response.data;

    if (projectKey) {
      issues = issues.filter((i) => i.project_key === projectKey);
    }

    return issues;
  } catch (error) {
    console.error(`Error fetching issues for sprint ${sprintKey}:`, error);
    return [];
  }
};

export const fetchIssuesByProject = async (projectKey) => {
  try {
    const response = await axios.get(`${API_BASE}/api/issues/project/${projectKey}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching issues for project ${projectKey}:`, error);
    return [];
  }
};

export const syncIssuesNow = async () => {
  try {
    const response = await axios.get(`${API_BASE}/api/issues/sync`);
    return response.data;
  } catch (error) {
    console.error("Error triggering sync:", error);
    return { status: "error" };
  }
};
