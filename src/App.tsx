import { createBrowserRouter, RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { XmtpProvider } from '@/components/providers/XmtpProvider'
import { GunProvider } from '@/components/providers/GunProvider'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AppLayout } from '@/components/layout/AppLayout'
import { ShoutboxPage } from '@/pages/ShoutboxPage'
import { RoomBrowserPage } from '@/pages/RoomBrowserPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { EmbedShoutboxPage } from '@/pages/embed/EmbedShoutboxPage'

const isEmbed = typeof window !== 'undefined' && window.location.pathname.startsWith('/embed/')

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorBoundary context="Router"><NotFoundPage /></ErrorBoundary>,
    children: [
      { index: true, element: <ShoutboxPage /> },
      { path: 'rooms', element: <RoomBrowserPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/embed/shoutbox',
    element: <EmbedShoutboxPage />,
  },
])

export function App() {
  return (
    <ErrorBoundary context="App">
      <XmtpProvider>
          <GunProvider>
            <ThemeProvider>
              <RouterProvider router={router} />
              <Toaster
                position={isEmbed ? 'bottom-center' : 'bottom-right'}
                theme="dark"
                toastOptions={{
                  className: 'bg-void-container text-ink border-void-high text-xs sm:text-sm',
                }}
              />
            </ThemeProvider>
          </GunProvider>
      </XmtpProvider>
    </ErrorBoundary>
  )
}
