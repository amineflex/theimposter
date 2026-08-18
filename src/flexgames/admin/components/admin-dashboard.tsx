'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getSupabaseBrowserClient } from '@/flexgames/core/supabase/client'
import { AdminOverview } from './admin-overview'
import { AdminRooms } from './admin-rooms'
import { AdminReports } from './admin-reports'
import { AdminSettings } from './admin-settings'
import { t } from '@/i18n'
import { getCatalogGames } from '@/flexgames/game-registry'
import type { AdminStats } from '@/flexgames/core/db'

/**
 * Dashboard admin : vue d'ensemble, parties, signalements, réglages  ·  plus un
 * onglet par jeu qui déclare des données à administrer. Ajouter un jeu ajoute
 * son onglet, sans toucher ce fichier.
 */
export function AdminDashboard({ email, stats }: { email: string; stats: AdminStats | null }) {
  const router = useRouter()
  const gamePanels = getCatalogGames().filter((game) => game.admin != null)

  const signOut = async () => {
    await getSupabaseBrowserClient().auth.signOut()
    router.refresh()
  }

  return (
    <main className="w-full">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('admin.title')}</h1>
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4" aria-hidden />
          {t('admin.signOut')}
        </Button>
      </header>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t('admin.overview')}</TabsTrigger>
          {gamePanels.map((game) => (
            <TabsTrigger key={game.manifest.id} value={`game:${game.manifest.id}`}>
              {game.manifest.name} · {game.admin?.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="rooms">{t('admin.rooms')}</TabsTrigger>
          <TabsTrigger value="reports">{t('admin.reports')}</TabsTrigger>
          <TabsTrigger value="settings">{t('admin.settings')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AdminOverview stats={stats} />
        </TabsContent>
        {gamePanels.map((game) => {
          const Panel = game.admin!.Panel
          return (
            <TabsContent key={game.manifest.id} value={`game:${game.manifest.id}`}>
              <Panel />
            </TabsContent>
          )
        })}
        <TabsContent value="rooms">
          <AdminRooms />
        </TabsContent>
        <TabsContent value="reports">
          <AdminReports />
        </TabsContent>
        <TabsContent value="settings">
          <AdminSettings />
        </TabsContent>
      </Tabs>
    </main>
  )
}
