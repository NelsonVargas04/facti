import { RequiereSesion } from '@/components/RequiereSesion';
import { Movimiento } from '@/components/Movimiento';
import { Sidebar } from '@/components/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequiereSesion>
      <Movimiento>
      <div className="flex min-h-screen flex-wrap">
        <Sidebar />
        <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-[26px] px-4 pb-12 pt-4 sm:px-6 md:pt-8 lg:px-10">{children}</main>
      </div>
      </Movimiento>
    </RequiereSesion>
  );
}
