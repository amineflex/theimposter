import type { Metadata } from 'next'
import { RoomScreen } from '@/features/online-game/room-screen'
import { normalizeRoomCode } from '@/lib/room-code'

export const metadata: Metadata = {
  title: 'Salon',
  description: 'Partie en ligne de The Imposter.',
  robots: { index: false },
}

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <RoomScreen code={normalizeRoomCode(code)} />
}
