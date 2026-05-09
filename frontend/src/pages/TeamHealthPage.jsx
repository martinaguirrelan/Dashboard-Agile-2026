export default function TeamHealthPage() {
  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="bg-white p-12 rounded border border-outline-variant shadow-card flex flex-col items-center justify-center gap-4 min-h-[400px]">
        <span className="material-symbols-outlined text-6xl text-primary-container">groups</span>
        <h2 className="text-headline-lg text-primary">Salud del Equipo</h2>
        <p className="text-body-base text-on-surface-variant text-center max-w-md">
          Índice de satisfacción, carga por squad, índice de rotación y NPS interno.
          Se conectará con encuestas y datos de HRIS. Próximamente.
        </p>
        <span className="px-3 py-1 bg-secondary-container text-on-secondary-container text-label-caps rounded-full">
          En construcción
        </span>
      </div>
    </div>
  )
}
