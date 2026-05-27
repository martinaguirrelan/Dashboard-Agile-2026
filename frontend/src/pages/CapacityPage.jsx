import { useEffect, useState, useMemo } from "react";
import { fetchIssuesByQuarter } from "../api/capacity";
import {
  buildKPIMetrics,
  buildParentIssuesWithChildren,
  buildCapacityByPerson,
  buildChartData,
} from "../utils/capacityAdapter";
import CapacityHeader from "../components/capacity/CapacityHeader";
import KPICards from "../components/capacity/KPICards";
import QuarterlyInitiativesTable from "../components/capacity/QuarterlyInitiativesTable";
import CapacityPerPersonTable from "../components/capacity/CapacityPerPersonTable";
import CapacityCharts from "../components/capacity/CapacityCharts";
import "../components/capacity/capacity.css";

export default function CapacityPage() {
  const [selectedQuarter, setSelectedQuarter] = useState("Q2");
  const [selectedProject, setSelectedProject] = useState(null);
  const [issues, setIssues] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchIssuesByQuarter(selectedQuarter, selectedProject);
        setIssues(data);

        // Infer projects from data
        if (data.length > 0) {
          const uniqueProjects = [...new Map(data.map((i) => [i.project_key, i])).values()];
          setProjects(uniqueProjects);

          // Set first project as default if not set
          if (!selectedProject && uniqueProjects.length > 0) {
            setSelectedProject(uniqueProjects[0].project_key);
          }
        }
      } catch (error) {
        console.error("Error loading capacity data:", error);
        setIssues([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedQuarter, selectedProject]);

  // Filter issues by selected project
  const filteredIssues = useMemo(() => {
    if (selectedProject) {
      return issues.filter((i) => i.project_key === selectedProject);
    }
    return issues;
  }, [issues, selectedProject]);

  // Derived data
  const kpiMetrics = useMemo(() => buildKPIMetrics(filteredIssues), [filteredIssues]);
  const parentIssuesWithChildren = useMemo(() => buildParentIssuesWithChildren(filteredIssues), [filteredIssues]);
  const capacityByPerson = useMemo(() => buildCapacityByPerson(filteredIssues), [filteredIssues]);
  const chartData = useMemo(() => buildChartData(filteredIssues), [filteredIssues]);

  const handleQuarterChange = (quarter) => {
    setSelectedQuarter(quarter);
  };

  const handleProjectChange = (projectKey) => {
    setSelectedProject(projectKey);
  };

  return (
    <div className="capacity-page">
      <CapacityHeader
        selectedQuarter={selectedQuarter}
        selectedProject={selectedProject}
        projects={projects}
        onQuarterChange={handleQuarterChange}
        onProjectChange={handleProjectChange}
      />

      {loading ? (
        <div className="capacity-loading">Cargando datos de capacidad...</div>
      ) : filteredIssues.length === 0 ? (
        <div className="capacity-empty">
          Sin issues disponibles para {selectedQuarter}
          {selectedProject ? ` en ${selectedProject}` : ""}
        </div>
      ) : (
        <>
          <KPICards metrics={kpiMetrics} />
          <QuarterlyInitiativesTable issues={parentIssuesWithChildren} />
          <CapacityPerPersonTable capacity={capacityByPerson} />
          <CapacityCharts chartData={chartData} />
        </>
      )}
    </div>
  );
}
