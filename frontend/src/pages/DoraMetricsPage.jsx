export default function DoraMetricsPage() {
  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="bg-white p-12 rounded border border-outline-variant shadow-card flex flex-col items-center justify-center gap-4 min-h-[400px]">
        <span className="material-symbols-outlined text-6xl text-primary-container">speed</span>
        <h2 className="text-headline-lg text-primary">Métricas DORA</h2>
        <p className="text-body-base text-on-surface-variant text-center max-w-md">
          Deployment Frequency, Lead Time for Changes, Change Failure Rate y
          Time to Restore Service. Próximamente conectado con tu pipeline de CI/CD.
        </p>
        <span className="px-3 py-1 bg-secondary-container text-on-secondary-container text-label-caps rounded-full">
          En construcción
        </span>
      </div>
    </div>
  )
}
