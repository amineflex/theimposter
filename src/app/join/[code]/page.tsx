import type { Metadata } from 'next'
import { JoinRoomForm } from '@/flexgames/lobby/join-room-form'
import { normalizeRoomCode } from '@/flexgames/rooms/room-code'

export const metadata: Metadata = {
  title: 'Rejoindre une partie',
  description: 'Entrez votre pseudo pour rejoindre la partie.',
  robots: { index: false },
}

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return (
    <main className="flex flex-1 flex-col justify-center py-6">
      <JoinRoomForm code={normalizeRoomCode(code)} />
    </main>
  )
}
