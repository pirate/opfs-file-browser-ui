"use client"

import { useEffect, useRef, useState } from "react"

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  alpha: number
  gravity: number
  life: number
  maxLife: number
}

interface FireworksProps {
  duration?: number
  onComplete?: () => void
}

export function Fireworks({ duration = 2000, onComplete }: FireworksProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isActive, setIsActive] = useState(true)
  const particlesRef = useRef<Particle[]>([])
  const animationRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)

  // Create a firework burst
  const createFirework = (x: number, y: number, particleCount = 80) => {
    const colors = ["#FF5252", "#FFD740", "#64FFDA", "#448AFF", "#E040FB", "#69F0AE"]

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 1 + Math.random() * 5

      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 3,
        alpha: 1,
        gravity: 0.05 + Math.random() * 0.05,
        life: 0,
        maxLife: 50 + Math.random() * 50,
      })
    }
  }

  // Animation loop
  const animate = (time: number) => {
    if (!canvasRef.current || !isActive) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Create random fireworks
    if (Math.random() < 0.05) {
      const x = Math.random() * canvas.width
      const y = canvas.height - (Math.random() * canvas.height) / 3
      createFirework(x, y)
    }

    // Update and draw particles
    particlesRef.current.forEach((particle, index) => {
      // Update position
      particle.x += particle.vx
      particle.y += particle.vy

      // Apply gravity
      particle.vy += particle.gravity

      // Update life
      particle.life++

      // Fade out
      particle.alpha = 1 - particle.life / particle.maxLife

      // Draw particle
      ctx.globalAlpha = particle.alpha
      ctx.fillStyle = particle.color
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
      ctx.fill()

      // Remove dead particles
      if (particle.life >= particle.maxLife) {
        particlesRef.current.splice(index, 1)
      }
    })

    ctx.globalAlpha = 1

    // Continue animation
    animationRef.current = requestAnimationFrame(animate)
  }

  useEffect(() => {
    if (!canvasRef.current) return

    // Set canvas size
    const canvas = canvasRef.current
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Start animation
    animationRef.current = requestAnimationFrame(animate)

    // Create initial fireworks
    for (let i = 0; i < 3; i++) {
      const x = Math.random() * canvas.width
      const y = canvas.height - (Math.random() * canvas.height) / 3
      createFirework(x, y)
    }

    // Set timeout to stop animation
    const timer = setTimeout(() => {
      setIsActive(false)
      if (onComplete) onComplete()
    }, duration)

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      clearTimeout(timer)
    }
  }, [duration, onComplete])

  return <canvas ref={canvasRef} className="fixed inset-0 z-50 pointer-events-none" />
}

