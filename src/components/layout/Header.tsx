import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Sun, Moon, MessageSquare, LayoutGrid, Settings, Menu, X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { ConnectWallet } from '@/components/auth/ConnectWallet'
import { cn } from '@/lib/utils'

const navLinks = [
  { to: '/', label: 'Shoutbox', icon: MessageSquare },
  { to: '/rooms', label: 'Rooms', icon: LayoutGrid },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

function isActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/'
  return pathname.startsWith(to)
}

export function Header() {
  const { pathname } = useLocation()
  const { theme, setTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="border-b border-gray-800 bg-gray-950 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        {/* Logo + desktop nav */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 text-white">
            <MessageSquare className="h-5 w-5" />
            <span className="text-lg font-bold">Web3 Shoutbox</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-4">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  'focus-ring flex items-center gap-1.5 rounded px-1 text-sm transition-colors hover:text-white',
                  isActive(pathname, to) ? 'text-white font-medium' : 'text-gray-400'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Desktop right side */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="focus-ring rounded-lg p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <ConnectWallet />
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="focus-ring rounded-lg p-2 text-gray-400 hover:text-white sm:hidden"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="animate-fade-in mt-3 border-t border-gray-800 pt-3 sm:hidden">
          <nav className="flex flex-col gap-2">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'focus-ring flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive(pathname, to)
                    ? 'bg-gray-800 text-white font-medium'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="focus-ring rounded-lg p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <ConnectWallet />
          </div>
        </div>
      )}
    </header>
  )
}
