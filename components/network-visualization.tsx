"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, RefreshCw, Wifi, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { webTorrentService } from "@/lib/webtorrent-service"

type Node = {
  id: string
  name: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  connected: boolean
  lastSeen: number
  files: number
  uploads: number
  downloads: number
  speed: number
}

type Connection = {
  source: string
  target: string
  strength: number
  active: boolean
  color: string
}

type NetworkVisualizationProps = {
  onClose: () => void
}

export function NetworkVisualization({ onClose }: NetworkVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [nodes, setNodes] = useState<Node[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalNodes: 0,
    activeNodes: 0,
    totalFiles: 0,
    totalConnections: 0,
    activeConnections: 0,
    networkHealth: 0,
  })

  // Use refs for animation data to avoid state updates in the animation loop
  const animationRef = useRef<number>(0)
  const lastUpdateRef = useRef<number>(Date.now())
  const nodesRef = useRef<Node[]>([])
  const connectionsRef = useRef<Connection[]>([])

  // Initialize network data
  useEffect(() => {
    fetchNetworkData()

    // Set up periodic refresh
    const intervalId = setInterval(() => {
      fetchNetworkData()
    }, 15000)

    return () => {
      clearInterval(intervalId)
      cancelAnimationFrame(animationRef.current)
    }
  }, [])

  // Update refs when state changes
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    connectionsRef.current = connections
  }, [connections])

  // Animation loop
  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas dimensions
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    // Animation function
    const animate = () => {
      const now = Date.now()
      const deltaTime = (now - lastUpdateRef.current) / 1000 // Convert to seconds
      lastUpdateRef.current = now

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Get current nodes and connections from refs
      const currentNodes = [...nodesRef.current]
      const currentConnections = connectionsRef.current

      // Draw connections
      currentConnections.forEach((connection) => {
        const source = currentNodes.find((n) => n.id === connection.source)
        const target = currentNodes.find((n) => n.id === connection.target)

        if (source && target) {
          ctx.beginPath()
          ctx.moveTo(source.x, source.y)
          ctx.lineTo(target.x, target.y)

          // Animated dash effect for active connections
          if (connection.active) {
            ctx.setLineDash([5, 5])
            ctx.lineDashOffset = -now / 100 // Animate dash
            ctx.strokeStyle = connection.color
            ctx.lineWidth = 2
          } else {
            ctx.setLineDash([])
            ctx.strokeStyle = "rgba(150, 150, 150, 0.2)"
            ctx.lineWidth = 1
          }

          ctx.stroke()
          ctx.setLineDash([])
        }
      })

      // Update node positions (without updating React state)
      const updatedNodes = currentNodes.map((node) => {
        // Apply forces
        // 1. Repulsion between nodes
        let fx = 0,
          fy = 0
        currentNodes.forEach((other) => {
          if (node.id !== other.id) {
            const dx = node.x - other.x
            const dy = node.y - other.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            if (distance > 0 && distance < 150) {
              const force = 150 / (distance * distance)
              fx += dx * force
              fy += dy * force
            }
          }
        })

        // 2. Attraction to center
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2
        fx += (centerX - node.x) * 0.01
        fy += (centerY - node.y) * 0.01

        // 3. Connection forces
        currentConnections.forEach((conn) => {
          if (conn.source === node.id || conn.target === node.id) {
            const other = currentNodes.find((n) => n.id === (conn.source === node.id ? conn.target : conn.source))
            if (other) {
              const dx = other.x - node.x
              const dy = other.y - node.y
              const distance = Math.sqrt(dx * dx + dy * dy)
              if (distance > 0) {
                const force = conn.strength * 0.01
                fx += dx * force
                fy += dy * force
              }
            }
          }
        })

        // Update velocity with damping
        const vx = (node.vx + fx * deltaTime) * 0.95
        const vy = (node.vy + fy * deltaTime) * 0.95

        // Update position
        let x = node.x + vx * deltaTime
        let y = node.y + vy * deltaTime

        // Boundary constraints
        const padding = node.radius
        if (x < padding) {
          x = padding
        }
        if (x > canvas.width - padding) {
          x = canvas.width - padding
        }
        if (y < padding) {
          y = padding
        }
        if (y > canvas.height - padding) {
          y = canvas.height - padding
        }

        // Draw node
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
        ctx.fillStyle = node.connected ? node.color : "rgba(150, 150, 150, 0.5)"
        ctx.fill()

        // Draw node border
        ctx.strokeStyle = node.connected ? "white" : "rgba(150, 150, 150, 0.8)"
        ctx.lineWidth = 2
        ctx.stroke()

        // Draw node label
        ctx.font = "10px Arial"
        ctx.fillStyle = "white"
        ctx.textAlign = "center"
        ctx.fillText(node.name, node.x, node.y + node.radius + 15)

        // Draw connection status icon
        if (node.connected) {
          ctx.fillStyle = "#4ade80"
          ctx.beginPath()
          ctx.arc(node.x + node.radius - 3, node.y - node.radius + 3, 4, 0, Math.PI * 2)
          ctx.fill()
        }

        return { ...node, x, y, vx, vy }
      })

      // Update the ref without triggering a re-render
      nodesRef.current = updatedNodes

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      cancelAnimationFrame(animationRef.current)
    }
  }, [nodes, connections]) // Only re-run when nodes or connections arrays change

  // Fetch network data
  const fetchNetworkData = async () => {
    setIsLoading(true)

    try {
      // In a real implementation, this would come from WebTorrent's DHT
      // For now, we'll generate mock data
      const mockNodes = generateMockNodes()
      const mockConnections = generateMockConnections(mockNodes)

      setNodes(mockNodes)
      setConnections(mockConnections)

      // Calculate network stats
      const activeNodes = mockNodes.filter((n) => n.connected).length
      const activeConns = mockConnections.filter((c) => c.active).length

      setStats({
        totalNodes: mockNodes.length,
        activeNodes,
        totalFiles: mockNodes.reduce((sum, node) => sum + node.files, 0),
        totalConnections: mockConnections.length,
        activeConnections: activeConns,
        networkHealth: Math.min(100, Math.round((activeNodes / mockNodes.length) * 100)),
      })
    } catch (error) {
      console.error("Error fetching network data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Generate mock nodes
  const generateMockNodes = (): Node[] => {
    const canvas = canvasRef.current
    if (!canvas) return []

    const width = canvas.width || 800
    const height = canvas.height || 600
    const centerX = width / 2
    const centerY = height / 2

    // Include our own node
    const ownNodeId = webTorrentService.getNodeId()

    // Generate random nodes
    const nodeCount = 15 + Math.floor(Math.random() * 10)
    const nodes: Node[] = []

    // Add our own node at the center
    nodes.push({
      id: ownNodeId,
      name: "You",
      x: centerX,
      y: centerY,
      vx: 0,
      vy: 0,
      radius: 15,
      color: "#3b82f6", // Blue
      connected: true,
      lastSeen: Date.now(),
      files: webTorrentService.getMyListings().length,
      uploads: Math.floor(Math.random() * 5),
      downloads: Math.floor(Math.random() * 3),
      speed: Math.random() * 1024 * 10,
    })

    // Generate other nodes
    const colors = ["#ef4444", "#f97316", "#84cc16", "#06b6d4", "#8b5cf6", "#ec4899"]

    for (let i = 1; i < nodeCount; i++) {
      // Random position in a circle around the center
      const angle = Math.random() * Math.PI * 2
      const distance = 50 + Math.random() * 200
      const x = centerX + Math.cos(angle) * distance
      const y = centerY + Math.sin(angle) * distance

      nodes.push({
        id: `node-${i}`,
        name: `Peer ${i}`,
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        radius: 8 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        connected: Math.random() > 0.2, // 80% chance of being connected
        lastSeen: Date.now() - Math.floor(Math.random() * 3600000),
        files: Math.floor(Math.random() * 20),
        uploads: Math.floor(Math.random() * 10),
        downloads: Math.floor(Math.random() * 5),
        speed: Math.random() * 1024 * 50,
      })
    }

    return nodes
  }

  // Generate mock connections
  const generateMockConnections = (nodes: Node[]): Connection[] => {
    const connections: Connection[] = []
    const ownNodeId = webTorrentService.getNodeId()

    // Connect our node to some others
    const connectedNodes = nodes.filter((n) => n.id !== ownNodeId && n.connected)
    const connectionCount = Math.min(connectedNodes.length, 5 + Math.floor(Math.random() * 5))

    for (let i = 0; i < connectionCount; i++) {
      connections.push({
        source: ownNodeId,
        target: connectedNodes[i].id,
        strength: 0.5 + Math.random() * 0.5,
        active: Math.random() > 0.3,
        color: Math.random() > 0.5 ? "#4ade80" : "#f97316", // Green or orange
      })
    }

    // Add some connections between other nodes
    for (let i = 0; i < nodes.length; i++) {
      if (!nodes[i].connected || nodes[i].id === ownNodeId) continue

      const connectionCount = Math.floor(Math.random() * 3)
      for (let j = 0; j < connectionCount; j++) {
        const targetIndex = Math.floor(Math.random() * nodes.length)
        if (targetIndex !== i && nodes[targetIndex].connected && nodes[targetIndex].id !== ownNodeId) {
          // Check if this connection already exists
          const exists = connections.some(
            (c) =>
              (c.source === nodes[i].id && c.target === nodes[targetIndex].id) ||
              (c.source === nodes[targetIndex].id && c.target === nodes[i].id),
          )

          if (!exists) {
            connections.push({
              source: nodes[i].id,
              target: nodes[targetIndex].id,
              strength: 0.2 + Math.random() * 0.3,
              active: Math.random() > 0.5,
              color: "#a3a3a3", // Gray
            })
          }
        }
      }
    }

    return connections
  }

  // Format speed
  const formatSpeed = (bytesPerSec: number): string => {
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(1)} B/s`
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold">Network Visualization</h2>
        </div>
        <Button variant="outline" size="sm" onClick={fetchNetworkData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Network visualization canvas */}
        <div className="flex-1 relative">
          <canvas ref={canvasRef} className="w-full h-full bg-gray-900" />

          {/* Network stats overlay */}
          <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm p-4 rounded-lg border shadow-md">
            <h3 className="font-medium mb-2">Network Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Nodes:</span>
                <span>
                  {stats.activeNodes} active / {stats.totalNodes} total
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Connections:</span>
                <span>
                  {stats.activeConnections} active / {stats.totalConnections} total
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Shared Files:</span>
                <span>{stats.totalFiles}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network Health:</span>
                  <span>{stats.networkHealth}%</span>
                </div>
                <Progress value={stats.networkHealth} className="h-2" />
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm p-3 rounded-lg border shadow-md">
            <div className="text-xs space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>You</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Active Peer</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                <span>Inactive Peer</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-8 bg-green-500"></div>
                <span>Active Connection</span>
              </div>
            </div>
          </div>
        </div>

        {/* Node details sidebar */}
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l overflow-auto">
          <div className="p-4">
            <h3 className="font-medium mb-3">Connected Peers</h3>
            <div className="space-y-3">
              {nodes
                .filter((node) => node.id !== webTorrentService.getNodeId())
                .sort((a, b) => {
                  // Sort by connection status first, then by last seen
                  if (a.connected !== b.connected) {
                    return a.connected ? -1 : 1
                  }
                  return b.lastSeen - a.lastSeen
                })
                .map((node) => (
                  <div key={node.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted">
                    <div className={`mt-1 p-1 rounded-full ${node.connected ? "bg-green-100" : "bg-gray-100"}`}>
                      {node.connected ? (
                        <Wifi className="h-4 w-4 text-green-600" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="font-medium truncate">{node.name}</div>
                        <Badge variant={node.connected ? "default" : "outline"} className="ml-2">
                          {node.connected ? "Online" : "Offline"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        <div className="flex justify-between">
                          <span>Files: {node.files}</span>
                          <span>Speed: {formatSpeed(node.speed)}</span>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span>↑ {node.uploads}</span>
                          <span>↓ {node.downloads}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

