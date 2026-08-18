'use client'

import { motion } from 'framer-motion'
import { GeoRushIcon } from './game-icon'

export function GeoRushLogo({ className }: { className?: string }) {
  return (
    <motion.div className={className} initial={{ scale: .86, rotate: -3 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 15 }}>
      <div className="flex items-center justify-center gap-2">
        <motion.span animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 1 }}>
          <GeoRushIcon className="h-16 w-16" />
        </motion.span>
        <span className="toy-title text-5xl leading-none text-blue sm:text-6xl">Geo<span className="text-green">Rush</span></span>
      </div>
    </motion.div>
  )
}
