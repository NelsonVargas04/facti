import { TablaSkeleton } from '@/components/TablaFacturas';

export default function Loading() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-8 w-40" />
          <div className="skeleton h-4 w-64" />
        </div>
        <div className="skeleton h-12 w-40 rounded-full" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="skeleton h-12 min-w-[260px] flex-1 rounded-input" />
        <div className="skeleton h-12 w-64 rounded-input" />
      </div>
      <section className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        <TablaSkeleton filas={6} />
      </section>
    </>
  );
}
