import { Outlet } from 'react-router'
import { Header } from '@/components/layout/Header'

export function AppLayout() {
  return (
    <div className="flex h-screen flex-col bg-gray-950 text-white dark:bg-gray-950 dark:text-white">
      <Header />
      <main className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
