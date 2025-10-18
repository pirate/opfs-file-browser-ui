import { v4 as uuidv4 } from "uuid"

// This would normally be imported from the WebTorrent library
// For this demo, we'll create a simplified mock implementation
export type TorrentInfo = {
  infoHash: string
  magnetURI: string
  name: string
  size: number
}

export type MarketplaceListing = {
  id: string
  fileName: string
  fileSize: number
  price: number
  createdAt: string
  nodeId: string
  infoHash?: string
  magnetURI?: string
  description?: string
  seller?: string
}

// Mock node ID for the current user
const NODE_ID = uuidv4()

class WebTorrentService {
  private client: any
  private nodeId: string
  private listings: MarketplaceListing[] = []
  private activeTorrents: Map<string, any> = new Map()
  private listeners: Set<(listings: MarketplaceListing[]) => void> = new Set()

  constructor() {
    this.nodeId = NODE_ID

    // In a real implementation, we would initialize the WebTorrent client
    // this.client = new WebTorrent();

    // Load mock data for demonstration
    this.loadMockListings()
  }

  // Get the node ID for the current user
  getNodeId(): string {
    return this.nodeId
  }

  // Create a torrent from a file
  async createTorrent(file: File): Promise<TorrentInfo> {
    // In a real implementation, we would create a torrent using WebTorrent
    // For now, we'll create a mock torrent info
    const infoHash = uuidv4().replace(/-/g, "")
    const magnetURI = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(file.name)}`

    return {
      infoHash,
      magnetURI,
      name: file.name,
      size: file.size,
    }
  }

  // Create a marketplace listing
  async createListing(file: File, price: number): Promise<MarketplaceListing> {
    const torrentInfo = await this.createTorrent(file)

    const listing: MarketplaceListing = {
      id: uuidv4(),
      fileName: file.name,
      fileSize: file.size,
      price,
      createdAt: new Date().toISOString(),
      nodeId: this.nodeId,
      infoHash: torrentInfo.infoHash,
      magnetURI: torrentInfo.magnetURI,
      seller: `User-${this.nodeId.substring(0, 8)}`,
    }

    // Add to our listings
    this.listings.push(listing)

    // Notify listeners
    this.notifyListeners()

    // In a real implementation, we would announce this to the DHT
    this.announceToDHT(listing)

    return listing
  }

  // Update a listing's price
  updateListingPrice(listingId: string, newPrice: number): MarketplaceListing | null {
    const listing = this.listings.find((l) => l.id === listingId)
    if (!listing) return null

    listing.price = newPrice

    // In a real implementation, we would update the DHT
    this.announceToDHT(listing)

    // Notify listeners
    this.notifyListeners()

    return listing
  }

  // Get all listings
  getListings(): MarketplaceListing[] {
    return [...this.listings]
  }

  // Get my listings
  getMyListings(): MarketplaceListing[] {
    return this.listings.filter((l) => l.nodeId === this.nodeId)
  }

  // Search listings
  searchListings(query: string): MarketplaceListing[] {
    const lowerQuery = query.toLowerCase()
    return this.listings.filter(
      (l) =>
        l.fileName.toLowerCase().includes(lowerQuery) ||
        (l.description && l.description.toLowerCase().includes(lowerQuery)),
    )
  }

  // Purchase a file
  async purchaseFile(listingId: string): Promise<boolean> {
    const listing = this.listings.find((l) => l.id === listingId)
    if (!listing) return false

    // In a real implementation, we would handle payment and download the file
    // For now, we'll just simulate a successful purchase

    console.log(`Purchased file: ${listing.fileName} for $${listing.price}`)

    return true
  }

  // Announce a listing to the DHT
  private announceToDHT(listing: MarketplaceListing): void {
    // In a real implementation, we would announce this to the DHT
    console.log(`Announcing listing to DHT: ${listing.fileName} for $${listing.price}`)
  }

  // Subscribe to listings changes
  subscribe(callback: (listings: MarketplaceListing[]) => void): () => void {
    this.listeners.add(callback)
    callback(this.getListings())

    return () => {
      this.listeners.delete(callback)
    }
  }

  // Notify all listeners of changes
  private notifyListeners(): void {
    const listings = this.getListings()
    this.listeners.forEach((listener) => listener(listings))
  }

  // Load mock listings for demonstration
  private loadMockListings(): void {
    const mockListings: MarketplaceListing[] = [
      {
        id: uuidv4(),
        fileName: "project-report.pdf",
        fileSize: 2500000,
        price: 5,
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        nodeId: "external-node-1",
        infoHash: uuidv4().replace(/-/g, ""),
        seller: "Alice",
      },
      {
        id: uuidv4(),
        fileName: "vacation-photos.zip",
        fileSize: 15000000,
        price: 10,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        nodeId: "external-node-2",
        infoHash: uuidv4().replace(/-/g, ""),
        seller: "Bob",
      },
      {
        id: uuidv4(),
        fileName: "design-templates.sketch",
        fileSize: 8000000,
        price: 15,
        createdAt: new Date().toISOString(),
        nodeId: "external-node-3",
        infoHash: uuidv4().replace(/-/g, ""),
        seller: "Charlie",
      },
    ]

    this.listings = mockListings
  }
}

// Create and export a singleton instance
export const webTorrentService = new WebTorrentService()

