export default function RoadmapPage() {
  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="bg-white p-12 rounded border border-outline-variant shadow-card flex flex-col items-center justify-center gap-4 min-h-[400px]">
        <span className="material-symbols-outlined text-6xl text-primary-container">account_tree</span>
        <h2 className="text-headline-lg text-primary">Roadmap &amp; Flujo</h2>
        <p className="text-body-base text-on-surface-variant text-center max-w-md">
          Vista de línea de tiempo de las épicas por trimestre, dependencias entre iniciativas
          y análisis de flujo (CFD, Throughput). Próximamente.
        </p>
        <span className="px-3 py-1 bg-secondary-container text-on-secondary-container text-label-caps rounded-full">
          En construcción
        </span>
      </div>
    </div>
  )
}
