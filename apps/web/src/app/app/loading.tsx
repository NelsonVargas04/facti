import { TablaSkeleton } from '@/components/TablaFacturas';

export default function Loading() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="skeleton h-9 w-48" />
        <div className="skeleton h-4 w-56" />
      </div>
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-[112px] rounded-tarjeta" />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-12 w-44 rounded-[16px]" />
        ))}
      </div>
      <section className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        <div className="skeleton mb-4 h-6 w-44" />
        <TablaSkeleton filas={5} />
      </section>
    </>
  );
}
