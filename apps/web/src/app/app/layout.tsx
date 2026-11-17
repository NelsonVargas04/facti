import { RequiereSesion } from '@/components/RequiereSesion';
import { Movimiento } from '@/components/Movimiento';
import { Sidebar } from '@/components/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequiereSesion>
      <Movimiento>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col gap-[26px] px-4 pb-36 pt-2 sm:px-6 md:pb-12 md:pt-8 lg:px-10">{children}</main>
      </div>
      </Movimiento>
    </RequiereSesion>
  );
}
