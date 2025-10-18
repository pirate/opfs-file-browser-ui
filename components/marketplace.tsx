"use client"

import { useState, useEffect } from "react"
import { Search, ShoppingCart, Tag, Download, ArrowLeft, Plus, Minus, RefreshCw, Megaphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { webTorrentService, type MarketplaceListing } from "@/lib/webtorrent-service"
import { formatFileSize } from "@/lib/utils"
import { Fireworks } from "@/components/fireworks"

type MarketplaceProps = {
  onClose: () => void
  initialFile?: File | null
  currentPath?: string[]
  onFileDownloaded?: (file: File) => void
}

export function Marketplace({ onClose, initialFile = null, currentPath = [], onFileDownloaded }: MarketplaceProps) {
  const [activeTab, setActiveTab] = useState<string>("browse")
  const [searchQuery, setSearchQuery] = useState("")
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [myListings, setMyListings] = useState<MarketplaceListing[]>([])
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [purchaseComplete, setPurchaseComplete] = useState(false)
  const [purchaseProgress, setPurchaseProgress] = useState(0)
  const [isCreatingListing, setIsCreatingListing] = useState(false)
  const [newListingPrice, setNewListingPrice] = useState(1)
  const [editingListing, setEditingListing] = useState<MarketplaceListing | null>(null)
  const [showFireworks, setShowFireworks] = useState(false)
  const [downloadedFile, setDownloadedFile] = useState<File | null>(null)

  // Load listings
  useEffect(() => {
    const unsubscribe = webTorrentService.subscribe((updatedListings) => {
      setListings(updatedListings)
      setMyListings(webTorrentService.getMyListings())
    })

    // If we have an initial file, create a listing for it
    if (initialFile) {
      setIsCreatingListing(true)
    }

    return unsubscribe
  }, [initialFile])

  // Handle search
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setListings(webTorrentService.getListings())
    } else {
      setListings(webTorrentService.searchListings(searchQuery))
    }
  }

  // Create a new listing
  const createListing = async () => {
    if (!initialFile) return

    try {
      await webTorrentService.createListing(initialFile, newListingPrice)
      setIsCreatingListing(false)
      setActiveTab("my-listings")
      // Show fireworks for successful listing creation
      setShowFireworks(true)
    } catch (error) {
      console.error("Error creating listing:", error)
    }
  }

  // Update listing price
  const updateListingPrice = (listingId: string, priceChange: number) => {
    const listing = myListings.find((l) => l.id === listingId)
    if (!listing) return

    const newPrice = Math.max(0.5, listing.price + priceChange)
    webTorrentService.updateListingPrice(listingId, newPrice)
  }

  // Purchase a file
  const purchaseFile = async () => {
    if (!selectedListing) return

    setIsPurchasing(true)
    setPurchaseProgress(0)

    // Simulate download progress
    const interval = setInterval(() => {
      setPurchaseProgress((prev) => {
        const newProgress = prev + Math.random() * 10
        if (newProgress >= 100) {
          clearInterval(interval)
          setTimeout(() => {
            setPurchaseComplete(true)
          }, 500)
          return 100
        }
        return newProgress
      })
    }, 300)

    try {
      // In a real implementation, this would download the actual file
      // For now, we'll create a mock file with the listing name
      const success = await webTorrentService.purchaseFile(selectedListing.id)

      if (success) {
        // Create a mock file for demonstration
        const mockContent = `This is the content of ${selectedListing.fileName} that you purchased for $${selectedListing.price}.`
        const blob = new Blob([mockContent], { type: "text/plain" })
        const file = new File([blob], selectedListing.fileName, { type: "text/plain" })
        setDownloadedFile(file)
      }
    } catch (error) {
      console.error("Error purchasing file:", error)
      clearInterval(interval)
      setIsPurchasing(false)
    }
  }

  // Save the downloaded file to the file system
  const saveDownloadedFile = async () => {
    if (!downloadedFile) return

    try {
      // Show fireworks for successful purchase
      setShowFireworks(true)

      // If onFileDownloaded callback is provided, use it
      if (onFileDownloaded) {
        onFileDownloaded(downloadedFile)
      }

      // Close the dialog
      setSelectedListing(null)
      setPurchaseComplete(false)
      setPurchaseProgress(0)
      setIsPurchasing(false)
    } catch (error) {
      console.error("Error saving file:", error)
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  return (
    <div className="flex flex-col h-full">
      {showFireworks && <Fireworks duration={2000} onComplete={() => setShowFireworks(false)} />}

      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold">File Marketplace</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setListings(webTorrentService.getListings())
              setMyListings(webTorrentService.getMyListings())
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b px-4">
          <TabsList className="mt-2">
            <TabsTrigger value="browse">Browse Listings</TabsTrigger>
            <TabsTrigger value="my-listings">My Listings</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="browse" className="flex-1 flex flex-col p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                className="pl-8"
              />
            </div>
            <Button onClick={handleSearch}>Search</Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((listing) => (
                <Card key={listing.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base truncate">{listing.fileName}</CardTitle>
                        <CardDescription>
                          {formatFileSize(listing.fileSize)} • {formatDate(listing.createdAt)}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="ml-2 whitespace-nowrap">
                        ${listing.price.toFixed(2)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span>Seller: {listing.seller || `User-${listing.nodeId.substring(0, 8)}`}</span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="default" className="w-full" onClick={() => setSelectedListing(listing)}>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Purchase
                    </Button>
                  </CardFooter>
                </Card>
              ))}

              {listings.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                  <Tag className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No listings found</h3>
                  <p className="text-sm text-muted-foreground max-w-md mt-2">
                    There are no files currently listed in the marketplace.
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="my-listings" className="flex-1 flex flex-col p-4">
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myListings.map((listing) => (
                <Card key={listing.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base truncate">{listing.fileName}</CardTitle>
                        <CardDescription>
                          {formatFileSize(listing.fileSize)} • {formatDate(listing.createdAt)}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-red-500"
                          onClick={() => updateListingPrice(listing.id, -1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="font-medium">${listing.price.toFixed(2)}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-green-500"
                          onClick={() => updateListingPrice(listing.id, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <Badge variant="outline">
                        {listing.nodeId === webTorrentService.getNodeId() ? "Your Listing" : "External"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {myListings.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                  <Tag className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No listings yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md mt-2">
                    You haven't listed any files for sale yet. Select a file and click "Advertise" to create a listing.
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Purchase Dialog */}
      <Dialog
        open={!!selectedListing}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedListing(null)
            setIsPurchasing(false)
            setPurchaseComplete(false)
            setPurchaseProgress(0)
            setDownloadedFile(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purchase File</DialogTitle>
            <DialogDescription>You are about to purchase the following file:</DialogDescription>
          </DialogHeader>

          {selectedListing && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-[100px_1fr] gap-2">
                <div className="font-medium">File:</div>
                <div>{selectedListing.fileName}</div>

                <div className="font-medium">Size:</div>
                <div>{formatFileSize(selectedListing.fileSize)}</div>

                <div className="font-medium">Price:</div>
                <div className="font-semibold">${selectedListing.price.toFixed(2)}</div>

                <div className="font-medium">Seller:</div>
                <div>{selectedListing.seller || `User-${selectedListing.nodeId.substring(0, 8)}`}</div>
              </div>

              {isPurchasing && (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">
                      {purchaseComplete ? "Download complete!" : "Downloading file..."}
                    </span>
                    <span className="text-sm text-muted-foreground">{Math.round(purchaseProgress)}%</span>
                  </div>
                  <Progress value={purchaseProgress} className="h-2" />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {!isPurchasing ? (
              <>
                <Button variant="outline" onClick={() => setSelectedListing(null)}>
                  Cancel
                </Button>
                <Button onClick={purchaseFile}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Pay ${selectedListing?.price.toFixed(2)}
                </Button>
              </>
            ) : purchaseComplete ? (
              <Button onClick={saveDownloadedFile}>
                <Download className="h-4 w-4 mr-2" />
                Save File
              </Button>
            ) : (
              <Button disabled>
                <span className="animate-pulse">Processing...</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Listing Dialog */}
      <Dialog open={isCreatingListing} onOpenChange={setIsCreatingListing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Listing</DialogTitle>
            <DialogDescription>List your file on the marketplace for others to purchase.</DialogDescription>
          </DialogHeader>

          {initialFile && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-[100px_1fr] gap-2">
                <div className="font-medium">File:</div>
                <div>{initialFile.name}</div>

                <div className="font-medium">Size:</div>
                <div>{formatFileSize(initialFile.size)}</div>

                <div className="font-medium">Price:</div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-red-500"
                    onClick={() => setNewListingPrice(Math.max(0.5, newListingPrice - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="font-medium">${newListingPrice.toFixed(2)}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-green-500"
                    onClick={() => setNewListingPrice(newListingPrice + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingListing(false)}>
              Cancel
            </Button>
            <Button onClick={createListing}>
              <Megaphone className="h-4 w-4 mr-2" />
              Create Listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

