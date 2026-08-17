'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { t } from '@/i18n'

/** Connexion administrateur (Supabase Auth email + mot de passe). */
export function AdminLogin({ error }: { error?: string }) {
  const router = useRouter()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      const supabase = getSupabaseBrowserClient()
      // Une session anonyme éventuelle est remplacée par la session admin.
      await supabase.auth.signOut()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        toast.error('Identifiants invalides.')
        return
      }
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" aria-hidden />
            {t('admin.login')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">
              {error}
            </p>
          )}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="admin-email">{t('admin.email')}</Label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="admin-password">{t('admin.password')}</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="mt-2"
              />
            </div>
            <Button type="submit" size="lg" block loading={submitting}>
              {t('admin.signIn')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
