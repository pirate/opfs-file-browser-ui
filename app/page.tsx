"use client"

import type React from "react"

import { useEffect, useState, useRef } from "react"
import {
  ChevronRight,
  Download,
  File,
  FileCode,
  FileImage,
  FileJson,
  FileText,
  FileVideo,
  Folder,
  FolderPlus,
  Home,
  Pencil,
  Trash,
  Upload,
  AlertCircle,
  FileAudio,
  Loader2,
  FileType,
  Search,
  X,
  Sparkles,
  Wifi,
  Megaphone,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

// Import the filesystem service
import { filesystemService, type FileSystemItem, getFileTypeFromName } from "@/lib/filesystem-service"

// Progress operation types
import { Marketplace } from "@/components/marketplace"

// First, import the debounce function and NetworkVisualization component
import { debounce } from "@/lib/debounce"
import { NetworkVisualization } from "@/components/network-visualization"

type ProgressOperation = {
  type: "upload" | "move" | "zip"
  progress: number
  message: string
}

export default function FileBrowser() {
  const [currentPath, setCurrentPath] = useState<string[]>([])
  const [items, setItems] = useState<FileSystemItem[]>([])
  const [selectedItem, setSelectedItem] = useState<FileSystemItem | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [directoryTree, setDirectoryTree] = useState<FileSystemItem[]>([])
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [newItemName, setNewItemName] = useState("")
  const [isCreatingFile, setIsCreatingFile] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [editedContent, setEditedContent] = useState<string | null>(null)
  const [hasContentChanged, setHasContentChanged] = useState(false)
  const [dropTargetItem, setDropTargetItem] = useState<FileSystemItem | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: keyof FileSystemItem; direction: "ascending" | "descending" }>({
    key: "name",
    direction: "ascending",
  })
  const renameInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [previewType, setPreviewType] = useState<"text" | "image" | "video" | "audio" | "other" | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Change the isDraggingOver state to track external files only
  const [isExternalDragOver, setIsExternalDragOver] = useState(false)

  // Progress tracking for operations
  const [operations, setOperations] = useState<ProgressOperation[]>([])

  // Search functionality
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<FileSystemItem[]>([])

  // Add these state variables inside the FileBrowser component, with the other state variables
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false)
  const [aiOrganizeStatus, setAiOrganizeStatus] = useState<"idle" | "processing" | "complete" | "error">("idle")
  const [aiOrganizeMessage, setAiOrganizeMessage] = useState("")
  const [aiSuggestions, setAiSuggestions] = useState<{ src: string; dst: string; applied: boolean }[]>([])
  const [aiOrganizeProgress, setAiOrganizeProgress] = useState(0)

  // Add a new state variable for showing the marketplace
  const [showMarketplace, setShowMarketplace] = useState(false)
  const [marketplaceFile, setMarketplaceFile] = useState<File | null>(null)

  // Add a new state variable for showing the network visualization
  const [showNetworkVisualization, setShowNetworkVisualization] = useState(false)

  // Add an operation to the operations list
  const addOperation = (operation: ProgressOperation) => {
    setOperations((prev) => [...prev, operation])
  }

  // Update an operation's progress
  const updateOperationProgress = (type: ProgressOperation["type"], progress: number, message?: string) => {
    setOperations((prev) =>
      prev.map((op) => (op.type === type ? { ...op, progress, message: message || op.message } : op)),
    )
  }

  // Remove an operation from the list
  const removeOperation = (type: ProgressOperation["type"]) => {
    setOperations((prev) => prev.filter((op) => op.type !== type))
  }

  // Request access to the file system
  const requestFileSystemAccess = async () => {
    try {
      const root = await filesystemService.getRoot()
      setRootHandle(root)
      await loadDirectory(root, [])
      await buildDirectoryTree(root)
    } catch (error) {
      console.error("Error accessing file system:", error)
    }
  }

  // Navigate to a directory
  const navigateToDirectory = async (path: string[]) => {
    if (!rootHandle) return

    try {
      const currentDir = await filesystemService.navigateToDirectory(rootHandle, path)
      await loadDirectory(currentDir, path)
    } catch (error) {
      console.error(`Error navigating to directory:`, error)
      // If the path is invalid, navigate to parent or root
      if (path.length > 0) {
        // Try to navigate to the parent directory instead
        const parentPath = path.slice(0, -1)
        console.log(`Attempting to navigate to parent directory: ${parentPath.join("/")}`)
        navigateToDirectory(parentPath)
      } else {
        // If we can't navigate to root either, refresh the root
        try {
          await loadDirectory(rootHandle, [])
        } catch (err) {
          console.error("Failed to load root directory:", err)
        }
      }
    }
  }

  // Load directory contents
  const loadDirectory = async (dirHandle: FileSystemDirectoryHandle, path: string[]) => {
    try {
      const entries = await filesystemService.loadDirectory(dirHandle, path)
      setCurrentPath(path)
      setItems(entries)
      setSelectedItem(null)
      setFileContent(null)
      setEditedContent(null)
    } catch (error) {
      console.error("Error loading directory:", error)
    }
  }

  // Build directory tree for sidebar
  const buildDirectoryTree = async (dirHandle: FileSystemDirectoryHandle, path: string[] = []) => {
    try {
      const entries = await filesystemService.buildDirectoryTree(dirHandle, path)
      setDirectoryTree(entries)
    } catch (error) {
      console.error("Error building directory tree:", error)
    }
  }

  // Handle item click
  const handleItemClick = async (item: FileSystemItem) => {
    setSelectedItem(item)
    setHasContentChanged(false)
    setIsRenaming(false)
    setPreviewType(null)
    setPreviewUrl(null)
    setPreviewError(null)
    setIsPreviewLoading(false)

    // For files, load the preview
    if (item.kind === "file" && item.handle) {
      setIsPreviewLoading(true)
      const fileHandle = item.handle as FileSystemFileHandle

      try {
        const file = await filesystemService.readFile(fileHandle)

        // Determine preview type based on file type
        const fileType = filesystemService.determineFileType(file)
        setPreviewType(fileType)

        if (fileType === "text") {
          try {
            const text = await file.text()
            setFileContent(text)
            setEditedContent(text)
          } catch (error) {
            console.error("Error reading file as text:", error)
            setFileContent("This file contains binary data that cannot be displayed as text.")
            setEditedContent(null)
            setPreviewError("Could not read file as text")
          }
        } else if (["image", "video", "audio"].includes(fileType)) {
          // Create object URL for media preview
          const url = URL.createObjectURL(file)
          setPreviewUrl(url)
        } else {
          setPreviewError("Preview not available for this file type")
        }
      } catch (error) {
        console.error("Error loading file preview:", error)
        setPreviewError("Error loading file preview")
      } finally {
        setIsPreviewLoading(false)
      }
    }
    // For directories, just select them but don't navigate
    // Navigation will happen on double click
  }

  // Add a new function for double-click handling
  const handleItemDoubleClick = async (item: FileSystemItem) => {
    if (item.kind === "directory" && item.handle) {
      const dirHandle = item.handle as FileSystemDirectoryHandle
      await loadDirectory(dirHandle, item.path)
    }
  }

  // Create a new file
  const createNewFile = async (e?: React.KeyboardEvent) => {
    if (e && e.key !== "Enter") return
    if (!rootHandle || !newItemName) return

    try {
      let currentDir = rootHandle

      for (const segment of currentPath) {
        currentDir = await currentDir.getDirectoryHandle(segment)
      }

      await filesystemService.createFile(currentDir, newItemName)
      await loadDirectory(currentDir, currentPath)
      setNewItemName("")
      setIsCreatingFile(false)
    } catch (error) {
      console.error("Error creating file:", error)
    }
  }

  // Create a new folder
  const createNewFolder = async (e?: React.KeyboardEvent) => {
    if (e && e.key !== "Enter") return
    if (!rootHandle || !newItemName) return

    try {
      let currentDir = rootHandle

      for (const segment of currentPath) {
        currentDir = await currentDir.getDirectoryHandle(segment)
      }

      await filesystemService.createFolder(currentDir, newItemName)
      await loadDirectory(currentDir, currentPath)
      await buildDirectoryTree(rootHandle)
      setNewItemName("")
      setIsCreatingFolder(false)
    } catch (error) {
      console.error("Error creating folder:", error)
    }
  }

  // Rename file or folder
  const renameItem = async (e?: React.KeyboardEvent) => {
    if (e && e.key !== "Enter") return
    if (!selectedItem || !rootHandle || !newItemName) return

    try {
      let parentDir = rootHandle
      const parentPath = selectedItem.path.slice(0, -1)

      for (const segment of parentPath) {
        parentDir = await parentDir.getDirectoryHandle(segment)
      }

      const { newHandle, newPath } = await filesystemService.renameItem(parentDir, selectedItem, newItemName)

      // If this was the selected item, update the preview
      // Clean up old preview URL if it exists
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }

      if (selectedItem.kind === "file") {
        // Get the new file handle and update the preview
        const fileHandle = newHandle as FileSystemFileHandle
        const updatedFile = await filesystemService.readFile(fileHandle)

        // Update the selected item
        setSelectedItem({
          ...selectedItem,
          name: newItemName,
          path: newPath,
          handle: fileHandle,
          size: updatedFile.size,
          lastModified: updatedFile.lastModified,
        })

        // Update the preview based on file type
        const fileType = filesystemService.determineFileType(updatedFile)

        if (fileType === "text") {
          const text = await updatedFile.text()
          setFileContent(text)
          setEditedContent(text)
          setPreviewType("text")
          setPreviewUrl(null)
        } else if (["image", "video", "audio"].includes(fileType)) {
          const newUrl = URL.createObjectURL(updatedFile)
          setPreviewUrl(newUrl)
          setPreviewType(fileType as "image" | "video" | "audio")
        }
      } else if (selectedItem.kind === "directory") {
        // Update the selected directory
        setSelectedItem({
          ...selectedItem,
          name: newItemName,
          path: newPath,
          handle: newHandle as FileSystemDirectoryHandle,
        })
      }

      // Refresh the current directory and tree
      await loadDirectory(parentDir, parentPath)
      await buildDirectoryTree(rootHandle)
      setNewItemName("")
      setIsRenaming(false)
    } catch (error) {
      console.error("Error renaming item:", error)
    }
  }

  // Delete file or folder
  const deleteItem = async () => {
    if (!selectedItem || !rootHandle) return

    try {
      let parentDir = rootHandle
      const parentPath = selectedItem.path.slice(0, -1)

      for (const segment of parentPath) {
        parentDir = await parentDir.getDirectoryHandle(segment)
      }

      // Delete the item
      await filesystemService.deleteItem(parentDir, selectedItem.name, selectedItem.kind === "directory")

      // Refresh the current directory and tree
      await loadDirectory(parentDir, parentPath)
      await buildDirectoryTree(rootHandle)
      setSelectedItem(null)
      setFileContent(null)
      setEditedContent(null)
    } catch (error) {
      console.error("Error deleting item:", error)
    }
  }

  // Download file
  const downloadFile = async () => {
    // If no item is selected, download the root directory
    if (!selectedItem) {
      if (rootHandle) {
        // Create a root item to pass to downloadDirectoryAsZip
        const rootItem: FileSystemItem = {
          name: "root",
          kind: "directory",
          path: [],
          handle: rootHandle,
        }
        await downloadDirectoryAsZip(rootItem)
      }
      return
    }

    try {
      if (selectedItem.kind === "file" && selectedItem.handle) {
        const fileHandle = selectedItem.handle as FileSystemFileHandle
        const file = await filesystemService.readFile(fileHandle)

        // Create a download link
        const url = URL.createObjectURL(file)
        const a = document.createElement("a")
        a.href = url
        a.download = selectedItem.name
        document.body.appendChild(a)
        a.click()

        // Clean up
        setTimeout(() => {
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }, 0)
      } else if (selectedItem.kind === "directory" && selectedItem.handle) {
        // Download directory as zip
        await downloadDirectoryAsZip(selectedItem)
      }
    } catch (error) {
      console.error("Error downloading:", error)
    }
  }

  // Download directory as zip
  const downloadDirectoryAsZip = async (item: FileSystemItem) => {
    if (!item.handle || item.kind !== "directory") return

    try {
      // Add zip operation to progress tracking
      addOperation({
        type: "zip",
        progress: 0,
        message: `Creating zip for ${item.name}...`,
      })

      // Dynamically import JSZip
      const JSZip = (await import("jszip")).default
      const zip = new JSZip()

      const dirHandle = item.handle as FileSystemDirectoryHandle

      // Count total files for progress tracking
      let totalFiles = 0
      let processedFiles = 0

      const countFiles = async (handle: FileSystemDirectoryHandle) => {
        for await (const entry of handle.values()) {
          if (entry.kind === "file") {
            totalFiles++
          } else if (entry.kind === "directory") {
            await countFiles(entry as FileSystemDirectoryHandle)
          }
        }
      }

      await countFiles(dirHandle)
      updateOperationProgress("zip", 0, `Counting files (${totalFiles} found)...`)

      // Recursively add files to zip
      const addFilesToZip = async (handle: FileSystemDirectoryHandle, path = "") => {
        for await (const entry of handle.values()) {
          if (entry.kind === "file") {
            const fileHandle = entry as FileSystemFileHandle
            const file = await filesystemService.readFile(fileHandle)
            const relativePath = path ? `${path}/${entry.name}` : entry.name
            zip.file(relativePath, file)

            processedFiles++
            const progress = Math.round((processedFiles / totalFiles) * 100)
            updateOperationProgress("zip", progress, `Adding files to zip (${processedFiles}/${totalFiles})...`)
          } else if (entry.kind === "directory") {
            const dirHandle = entry as FileSystemDirectoryHandle
            const newPath = path ? `${path}/${entry.name}` : entry.name
            await addFilesToZip(dirHandle, newPath)
          }
        }
      }

      await addFilesToZip(dirHandle)
      updateOperationProgress("zip", 100, "Compressing files (this may take a while for large files)...")
      const content = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
        // Add progress callback for zip generation
        streamFiles: true,
        onUpdate: (metadata) => {
          if (metadata.percent) {
            // Scale the compression phase from 0-100% to 70-100% of our overall progress
            // This gives a better visual indication that work is still happening
            const scaledProgress = 70 + Math.round(metadata.percent * 0.3)
            updateOperationProgress("zip", scaledProgress, `Compressing files: ${Math.round(metadata.percent)}%`)
          }
        },
      })

      // Download the zip
      const url = URL.createObjectURL(content)
      const a = document.createElement("a")
      a.href = url
      a.download = `${item.name}.zip`
      document.body.appendChild(a)
      a.click()

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        removeOperation("zip")
      }, 1000)
    } catch (error) {
      console.error("Error creating zip:", error)
      removeOperation("zip")
    }
  }

  // Save edited file content
  const saveFileContent = async () => {
    if (!selectedItem || !editedContent || selectedItem.kind !== "file" || !selectedItem.handle) return

    try {
      const fileHandle = selectedItem.handle as FileSystemFileHandle
      await filesystemService.writeFile(fileHandle, editedContent)

      setFileContent(editedContent)
      setHasContentChanged(false)

      // Refresh file metadata
      const file = await filesystemService.readFile(fileHandle)
      setSelectedItem({
        ...selectedItem,
        size: file.size,
        lastModified: file.lastModified,
      })

      // Update the item in the list
      setItems(
        items.map((item) =>
          item.path.join("/") === selectedItem.path.join("/")
            ? {
                ...item,
                size: file.size,
                lastModified: file.lastModified,
              }
            : item,
        ),
      )
    } catch (error) {
      console.error("Error saving file:", error)
    }
  }

  // Upload files
  const uploadFiles = async (files: FileList, targetPath: string[] = currentPath) => {
    if (!rootHandle) return

    // First check if an upload operation is already in progress
    const existingUploadOp = operations.find((op) => op.type === "upload")
    if (existingUploadOp) {
      // If there's already an upload operation, update it instead of adding a new one
      updateOperationProgress("upload", 0, `Uploading ${files.length} file${files.length > 1 ? "s" : ""}...`)
    } else {
      // Only add a new operation if one doesn't exist
      addOperation({
        type: "upload",
        progress: 0,
        message: `Uploading ${files.length} file${files.length > 1 ? "s" : ""}...`,
      })
    }

    try {
      let targetDir = rootHandle

      // Navigate to target directory
      for (const segment of targetPath) {
        targetDir = await targetDir.getDirectoryHandle(segment)
      }

      // Upload files with progress tracking
      await filesystemService.uploadFiles(targetDir, files, (uploadedBytes, totalBytes) => {
        const progress = Math.round((uploadedBytes / totalBytes) * 100)
        updateOperationProgress("upload", progress, `Uploading ${files.length} file${files.length > 1 ? "s" : ""}...`)
      })

      // Refresh the current directory
      await loadDirectory(targetDir, targetPath)

      // If we uploaded to a different directory than current, refresh the tree
      if (targetPath.join("/") !== currentPath.join("/")) {
        await buildDirectoryTree(rootHandle)
      }
    } catch (error) {
      console.error("Error uploading files:", error)
    } finally {
      // Remove upload operation after a short delay to show completion
      setTimeout(() => {
        removeOperation("upload")
      }, 1000)
      setDropTargetItem(null)
    }
  }

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files)
    }
  }

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, item: FileSystemItem) => {
    e.dataTransfer.setData("application/json", JSON.stringify(item))
  }

  // Handle drop for internal file movement
  const handleDrop = async (e: React.DragEvent, targetItem: FileSystemItem) => {
    e.preventDefault()
    setIsExternalDragOver(false)
    setDropTargetItem(null)

    // Check if this is an external file drop
    if (e.dataTransfer.files.length > 0) {
      if (targetItem.kind === "directory") {
        await uploadFiles(e.dataTransfer.files, targetItem.path)
      } else {
        await uploadFiles(e.dataTransfer.files)
      }
      return
    }

    // Handle internal file movement
    if (targetItem.kind !== "directory" || !rootHandle) return

    const sourceItemJson = e.dataTransfer.getData("application/json")
    if (!sourceItemJson) return

    try {
      const sourceItem: FileSystemItem = JSON.parse(sourceItemJson)

      // Don't move to the same location
      if (sourceItem.path.join("/") === targetItem.path.join("/")) return

      // Check if trying to move a folder into its own subfolder (which would create a cycle)
      if (sourceItem.kind === "directory") {
        const sourcePath = sourceItem.path.join("/")
        const targetPath = targetItem.path.join("/")

        // Only consider it a cycle if the target is actually a subfolder of the source
        // (not just if they share a common prefix)
        if (
          targetPath === sourcePath ||
          (targetPath.startsWith(sourcePath) &&
            (targetPath.length === sourcePath.length || targetPath[sourcePath.length] === "/"))
        ) {
          console.error("Cannot move a folder into itself or its subfolder")
          return
        }
      }

      // First, verify that both source parent directory and target directory exist
      let sourceParentDir = rootHandle
      const sourceParentPath = sourceItem.path.slice(0, -1)
      try {
        for (let i = 0; i < sourceParentPath.length; i++) {
          sourceParentDir = await sourceParentDir.getDirectoryHandle(sourceParentPath[i])
        }
      } catch (error) {
        console.error("Source parent directory no longer exists:", error)
        alert("The source directory no longer exists. Refreshing view...")
        await loadDirectory(rootHandle, currentPath)
        await buildDirectoryTree(rootHandle)
        return
      }

      let targetDir = rootHandle
      try {
        for (const segment of targetItem.path) {
          targetDir = await targetDir.getDirectoryHandle(segment)
        }
      } catch (error) {
        console.error("Target directory no longer exists:", error)
        alert("The target directory no longer exists. Refreshing view...")
        await loadDirectory(rootHandle, currentPath)
        await buildDirectoryTree(rootHandle)
        return
      }

      // Continue with the rest of the handleDrop function...
      if (sourceItem.kind === "file") {
        // Add move operation to progress tracking
        addOperation({
          type: "move",
          progress: 0,
          message: `Moving ${sourceItem.name}...`,
        })

        // Check if the source file exists before moving
        try {
          await sourceParentDir.getFileHandle(sourceItem.name)
        } catch (error) {
          console.error("Source file no longer exists:", error)
          removeOperation("move")
          alert(`The file "${sourceItem.name}" no longer exists.`)
          await loadDirectory(rootHandle, currentPath)
          return
        }

        // Move file
        await filesystemService.moveFile(sourceParentDir, targetDir, sourceItem.name, (progress) => {
          updateOperationProgress("move", progress, `Moving ${sourceItem.name}...`)
        })

        // Remove move operation after a short delay to show completion
        setTimeout(() => {
          removeOperation("move")
        }, 1000)
      } else if (sourceItem.kind === "directory") {
        // Check if the source directory exists before moving
        try {
          await sourceParentDir.getDirectoryHandle(sourceItem.name)
        } catch (error) {
          console.error("Source directory no longer exists:", error)
          alert(`The directory "${sourceItem.name}" no longer exists.`)
          await loadDirectory(rootHandle, currentPath)
          await buildDirectoryTree(rootHandle)
          return
        }

        // Get the source directory handle
        const sourceDirHandle = await sourceParentDir.getDirectoryHandle(sourceItem.name)

        // Create a new directory in the target location
        const targetSubDirHandle = await targetDir.getDirectoryHandle(sourceItem.name, { create: true })

        // Add move operation to progress tracking
        addOperation({
          type: "move",
          progress: 0,
          message: `Moving directory ${sourceItem.name}...`,
        })

        // Copy all contents from source to target
        await filesystemService.copyDirectoryContents(
          sourceDirHandle,
          targetSubDirHandle,
          (processed, total) => {
            const progress = Math.round((processed / total) * 100)
            updateOperationProgress("move", progress, `Moving ${sourceItem.name}...`)
          },
          (success) => {
            // Only remove the original directory if the copy was successful
            if (success) {
              try {
                sourceParentDir.removeEntry(sourceItem.name, { recursive: true })
              } catch (error) {
                console.error(`Error removing original directory ${sourceItem.name}:`, error)
                // Continue anyway since the directory was copied successfully
              }
            } else {
              console.error("Directory copy failed, not removing original directory")
            }

            // Remove move operation after a short delay to show completion
            setTimeout(() => {
              removeOperation("move")
            }, 1000)
          },
        )
      }

      // Refresh current directory and tree
      try {
        // First rebuild the directory tree to update the sidebar
        await buildDirectoryTree(rootHandle)

        // Then explicitly reload the current directory to update the main view
        if (currentPath.length === 0) {
          // If we're at root, load root directly
          await loadDirectory(rootHandle, [])
        } else {
          // Otherwise navigate to the current path to refresh it
          let currentDir = rootHandle
          try {
            for (const segment of currentPath) {
              currentDir = await currentDir.getDirectoryHandle(segment)
            }
            await loadDirectory(currentDir, currentPath)
          } catch (error) {
            console.error("Error refreshing current directory:", error)
            // If the current directory no longer exists, navigate to parent or root
            if (currentPath.length > 0) {
              await navigateToDirectory(currentPath.slice(0, -1))
            } else {
              await loadDirectory(rootHandle, [])
            }
          }
        }
      } catch (error) {
        console.error("Error refreshing view after drop:", error)
        // Fallback to loading root directory
        await loadDirectory(rootHandle, [])
        await buildDirectoryTree(rootHandle)
      }
    } catch (error) {
      console.error("Error in handleDrop:", error)
      alert(`Error moving item: ${error.message || "Unknown error"}`)
      // Refresh the view
      await loadDirectory(rootHandle, currentPath)
      await buildDirectoryTree(rootHandle)
    }
  }

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, item: FileSystemItem) => {
    if (item.kind === "directory") {
      e.preventDefault()
      setDropTargetItem(item)
    }
  }

  // Handle page-level drag events
  const handlePageDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    // Only set drag state for external files, not internal elements
    if (e.dataTransfer.types.includes("Files")) {
      setIsExternalDragOver(true)
    }
  }

  const handlePageDragLeave = (e: React.DragEvent) => {
    // Only set to false if we're leaving the page (not entering a child element)
    if (!e.currentTarget.contains(e.relatedTarget as Node) && e.dataTransfer.types.includes("Files")) {
      setIsExternalDragOver(false)
    }
  }

  const handlePageDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsExternalDragOver(false)

    // Only handle external file drops here
    if (e.dataTransfer.files.length > 0) {
      await uploadFiles(e.dataTransfer.files)
    }
  }

  // Replace the existing search functionality with a debounced live search
  // Find the handleSearch function and replace it with this:

  // Search functionality with debouncing
  const performSearch = async (query: string) => {
    if (!query.trim() || !rootHandle) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    setSearchResults([])

    try {
      const results: FileSystemItem[] = []

      // Search in current directory first
      let currentDir = rootHandle
      for (const segment of currentPath) {
        currentDir = await currentDir.getDirectoryHandle(segment)
      }

      // Recursive search function
      const searchDirectory = async (dirHandle: FileSystemDirectoryHandle, path: string[]) => {
        for await (const entry of dirHandle.values()) {
          const lowerQuery = query.toLowerCase()
          const lowerName = entry.name.toLowerCase()

          if (lowerName.includes(lowerQuery)) {
            const item: FileSystemItem = {
              name: entry.name,
              kind: entry.kind,
              path: [...path, entry.name],
              handle: entry,
            }

            if (entry.kind === "file") {
              const fileHandle = entry as FileSystemFileHandle
              const file = await filesystemService.readFile(fileHandle)
              item.size = file.size
              item.type = file.type || getFileTypeFromName(file.name)
              item.lastModified = file.lastModified
            } else if (entry.kind === "directory") {
              // Count entries in subdirectories
              const dirHandle = entry as FileSystemDirectoryHandle
              let count = 0
              for await (const _ of dirHandle.values()) {
                count++
              }
              item.size = count
            }

            results.push(item)
          }

          // If it's a directory, search inside it too
          if (entry.kind === "directory") {
            await searchDirectory(entry as FileSystemDirectoryHandle, [...path, entry.name])
          }
        }
      }

      await searchDirectory(currentDir, currentPath)
      setSearchResults(results)
    } catch (error) {
      console.error("Error searching:", error)
    } finally {
      setIsSearching(false)
    }
  }

  // Create a debounced version of the search function
  const debouncedSearch = debounce(performSearch, 300)

  // Update the search input handler
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    debouncedSearch(query)
  }

  // Clear search
  const clearSearch = () => {
    setSearchQuery("")
    setSearchResults([])
    setIsSearching(false)
  }

  // Get file icon based on file type
  const getFileIcon = (item: FileSystemItem) => {
    if (item.kind === "directory") {
      return <Folder className="h-4 w-4 text-blue-500" />
    }

    const extension = item.name.split(".").pop()?.toLowerCase() || ""

    switch (extension) {
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "svg":
      case "webp":
        return <FileImage className="h-4 w-4 text-purple-500" />
      case "mp4":
      case "webm":
      case "mov":
      case "avi":
        return <FileVideo className="h-4 w-4 text-red-500" />
      case "js":
      case "ts":
      case "jsx":
      case "tsx":
      case "html":
      case "css":
      case "php":
      case "py":
      case "java":
      case "c":
      case "cpp":
        return <FileCode className="h-4 w-4 text-green-500" />
      case "json":
        return <FileJson className="h-4 w-4 text-yellow-500" />
      case "txt":
      case "md":
      case "rtf":
        return <FileText className="h-4 w-4 text-gray-500" />
      default:
        return <File className="h-4 w-4 text-gray-500" />
    }
  }

  // Format file size
  const formatFileSize = (bytes?: number): string => {
    if (bytes === undefined) return "-"

    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  // Format date
  const formatDate = (timestamp?: number): string => {
    if (timestamp === undefined) return "-"
    return new Date(timestamp).toLocaleString()
  }

  // Sort items
  const sortedItems = [...items].sort((a, b) => {
    // Directories always come first
    if (a.kind !== b.kind) {
      return a.kind === "directory" ? -1 : 1
    }

    // Sort by the configured key
    const aValue = a[sortConfig.key]
    const bValue = b[sortConfig.key]

    if (aValue === undefined && bValue === undefined) return 0
    if (aValue === undefined) return 1
    if (bValue === undefined) return -1

    // String comparison for strings
    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortConfig.direction === "ascending" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }

    // Numeric comparison for numbers
    return sortConfig.direction === "ascending"
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number)
  })

  // Handle column header click for sorting
  const handleHeaderClick = (key: keyof FileSystemItem) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === "ascending" ? "descending" : "ascending",
    })
  }

  // Initialize file system access
  useEffect(() => {
    requestFileSystemAccess()
  }, [])

  // Focus rename input when renaming starts
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
    }
  }, [isRenaming])

  // Add a cleanup function for preview URLs
  useEffect(() => {
    return () => {
      // Clean up any object URLs when component unmounts
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  // Handle breadcrumb drag start
  const handleBreadcrumbDragStart = (e: React.DragEvent, path: string[]) => {
    // Create a temporary item representing the directory
    const tempItem: FileSystemItem = {
      name: path.length > 0 ? path[path.length - 1] : "root",
      kind: "directory",
      path: path,
      // We don't have the handle here, but it's not needed for the drag operation
      // The actual handle will be retrieved when needed for the drop operation
    }
    e.dataTransfer.setData("application/json", JSON.stringify(tempItem))
  }

  // Handle breadcrumb drop
  const handleBreadcrumbDrop = async (e: React.DragEvent, targetPath: string[]) => {
    e.preventDefault()
    // Check if this is an external file drop
    if (e.dataTransfer.files.length > 0) {
      await uploadFiles(e.dataTransfer.files, targetPath)
      return
    }

    // Handle internal file movement
    if (!rootHandle) return

    const sourceItemJson = e.dataTransfer.getData("application/json")
    if (!sourceItemJson) return

    try {
      const sourceItem: FileSystemItem = JSON.parse(sourceItemJson)

      // Don't move to the same location
      if (sourceItem.path.join("/") === targetPath.join("/")) return

      // Don't move a directory into itself or its subdirectory
      if (sourceItem.kind === "directory") {
        const sourcePath = sourceItem.path.join("/")
        const targetPathStr = targetPath.join("/")

        if (
          targetPathStr === sourcePath ||
          (targetPathStr.startsWith(sourcePath) &&
            (targetPathStr.length === sourcePath.length || targetPathStr[sourcePath.length] === "/"))
        ) {
          console.error("Cannot move a folder into itself or its subfolder")
          return
        }
      }

      // Verify source parent directory exists
      let sourceParentDir = rootHandle
      const parentPath = sourceItem.path.slice(0, -1)
      try {
        for (const segment of parentPath) {
          sourceParentDir = await sourceParentDir.getDirectoryHandle(segment)
        }
      } catch (error) {
        console.error("Source parent directory no longer exists:", error)
        alert("The source directory no longer exists. Refreshing view...")
        await loadDirectory(rootHandle, currentPath)
        await buildDirectoryTree(rootHandle)
        return
      }

      // Verify target directory exists
      let targetDir = rootHandle
      try {
        for (const segment of targetPath) {
          targetDir = await targetDir.getDirectoryHandle(segment)
        }
      } catch (error) {
        console.error("Target directory no longer exists:", error)
        alert("The target directory no longer exists. Refreshing view...")
        await loadDirectory(rootHandle, currentPath)
        await buildDirectoryTree(rootHandle)
        return
      }

      // The rest of the function remains the same...
      // (Keep the existing code for file/directory moving)
      if (sourceItem.kind === "file") {
        // Add move operation to progress tracking
        addOperation({
          type: "move",
          progress: 0,
          message: `Moving ${sourceItem.name}...`,
        })

        // Move file
        await filesystemService.moveFile(sourceParentDir, targetDir, sourceItem.name, (progress) => {
          updateOperationProgress("move", progress, `Moving ${sourceItem.name}...`)
        })

        // Remove move operation after a short delay to show completion
        setTimeout(() => {
          removeOperation("move")
        }, 1000)
      } else if (sourceItem.kind === "directory") {
        // Get the source directory handle
        const sourceDirHandle = await sourceParentDir.getDirectoryHandle(sourceItem.name)

        // Create a new directory in the target location
        const targetSubDirHandle = await targetDir.getDirectoryHandle(sourceItem.name, { create: true })

        // Add move operation to progress tracking
        addOperation({
          type: "move",
          progress: 0,
          message: `Moving directory ${sourceItem.name}...`,
        })

        // Copy all contents from source to target
        await filesystemService.copyDirectoryContents(
          sourceDirHandle,
          targetSubDirHandle,
          (processed, total) => {
            const progress = Math.round((processed / total) * 100)
            updateOperationProgress("move", progress, `Moving ${sourceItem.name}...`)
          },
          (success) => {
            // Only remove the original directory if the copy was successful
            if (success) {
              try {
                sourceParentDir.removeEntry(sourceItem.name, { recursive: true })
              } catch (error) {
                console.error(`Error removing original directory ${sourceItem.name}:`, error)
                // Continue anyway since the directory was copied successfully
              }
            } else {
              console.error("Directory copy failed, not removing original directory")
            }

            // Remove move operation after a short delay to show completion
            setTimeout(() => {
              removeOperation("move")
            }, 1000)
          },
        )
      }

      // Refresh current directory and tree
      try {
        // First rebuild the directory tree to update the sidebar
        await buildDirectoryTree(rootHandle)

        // Then explicitly reload the current directory to update the main view
        if (currentPath.length === 0) {
          // If we're at root, load root directly
          await loadDirectory(rootHandle, [])
        } else {
          // Otherwise navigate to the current path to refresh it
          let currentDir = rootHandle
          try {
            for (const segment of currentPath) {
              currentDir = await currentDir.getDirectoryHandle(segment)
            }
            await loadDirectory(currentDir, currentPath)
          } catch (error) {
            console.error("Error refreshing current directory:", error)
            // If the current directory no longer exists, navigate to parent or root
            if (currentPath.length > 0) {
              await navigateToDirectory(currentPath.slice(0, -1))
            } else {
              await loadDirectory(rootHandle, [])
            }
          }
        }
      } catch (error) {
        console.error("Error refreshing view after breadcrumb drop:", error)
        // Fallback to loading root directory
        await loadDirectory(rootHandle, [])
        await buildDirectoryTree(rootHandle)
      }
    } catch (error) {
      console.error("Error in handleBreadcrumbDrop:", error)
      alert(`Error moving item: ${error.message || "Unknown error"}`)
      // Refresh the view
      await loadDirectory(rootHandle, currentPath)
      await buildDirectoryTree(rootHandle)
    }
  }

  // Handle breadcrumb drag over
  const handleBreadcrumbDragOver = (e: React.DragEvent, path: string[]) => {
    e.preventDefault()

    // Create a temporary item representing the directory
    const tempItem: FileSystemItem = {
      name: path.length > 0 ? path[path.length - 1] : "root",
      kind: "directory",
      path: path,
    }

    setDropTargetItem(tempItem)
  }

  // Add these functions inside the FileBrowser component, before the return statement

  // Function to gather the file tree data
  const gatherFileTreeData = async (dirHandle: FileSystemDirectoryHandle, path: string[] = []): Promise<any> => {
    const entries: any[] = []

    try {
      for await (const entry of dirHandle.values()) {
        const entryPath = [...path, entry.name]

        if (entry.kind === "file") {
          entries.push({
            name: entry.name,
            kind: "file",
            path: entryPath.join("/"),
          })
        } else if (entry.kind === "directory") {
          const dirHandle = entry as FileSystemDirectoryHandle
          const children = await gatherFileTreeData(dirHandle, entryPath)
          entries.push({
            name: entry.name,
            kind: "directory",
            path: entryPath.join("/"),
            children,
          })
        }
      }

      return entries
    } catch (error) {
      console.error("Error gathering file tree data:", error)
      return entries
    }
  }

  // Function to analyze file types and suggest organization
  const analyzeAndOrganizeFiles = async (fileTree: any) => {
    // Create a map of file extensions to their suggested folders
    const extensionMap: Record<string, string> = {
      // Images
      jpg: "images",
      jpeg: "images",
      png: "images",
      gif: "images",
      svg: "images",
      webp: "images",

      // Documents
      pdf: "documents",
      doc: "documents",
      docx: "documents",
      txt: "documents",
      rtf: "documents",
      md: "documents",

      // Code
      js: "code/javascript",
      ts: "code/typescript",
      jsx: "code/react",
      tsx: "code/react",
      html: "code/web",
      css: "code/web",
      scss: "code/web",
      py: "code/python",
      java: "code/java",
      c: "code/c",
      cpp: "code/cpp",

      // Data
      json: "data",
      csv: "data",
      xml: "data",

      // Media
      mp4: "videos",
      webm: "videos",
      mov: "videos",
      avi: "videos",
      mp3: "audio",
      wav: "audio",
      ogg: "audio",
    }

    // Flatten the file tree to get all files
    const allFiles: { path: string; kind: string }[] = []

    const flattenTree = (items: any[], currentPath = "") => {
      for (const item of items) {
        if (item.kind === "file") {
          allFiles.push({
            path: item.path,
            kind: "file",
          })
        } else if (item.kind === "directory" && item.children) {
          // Don't add directories that match our organization structure
          const dirName = item.name.toLowerCase()
          const isOrganizationDir = Object.values(extensionMap).some(
            (folder) => dirName === folder || folder.startsWith(`${dirName}/`),
          )

          if (!isOrganizationDir) {
            allFiles.push({
              path: item.path,
              kind: "directory",
            })
          }

          flattenTree(item.children, item.path)
        }
      }
    }

    flattenTree(fileTree)

    // Generate move suggestions
    const suggestions: { src: string; dst: string }[] = []

    for (const file of allFiles) {
      if (file.kind === "file") {
        const extension = file.path.split(".").pop()?.toLowerCase() || ""
        const fileName = file.path.split("/").pop() || ""

        // Skip files without extensions or already in the correct folder
        if (!extension || !extensionMap[extension]) continue

        const targetFolder = extensionMap[extension]
        const currentFolder = file.path.split("/").slice(0, -1).join("/")

        // Skip if the file is already in the correct folder
        if (currentFolder.endsWith(targetFolder)) continue

        // Create the destination path
        const destination = `${targetFolder}/${fileName}`

        // Skip if source and destination are the same
        if (file.path === destination) continue

        suggestions.push({
          src: file.path,
          dst: destination,
        })
      }
    }

    return suggestions
  }

  // Function to send the file tree data to Anthropic API
  const sendToAnthropicApi = async (fileTree: any) => {
    try {
      setAiOrganizeStatus("processing")
      setAiOrganizeMessage("Analyzing your file structure...")
      setAiOrganizeProgress(10)

      setAiOrganizeProgress(30)
      setAiOrganizeMessage("Generating organization suggestions...")

      // Instead of calling an external API, we'll use our local analyzer
      const suggestions = await analyzeAndOrganizeFiles(fileTree)

      setAiOrganizeProgress(80)
      setAiOrganizeMessage("Processing suggestions...")

      // Transform the response into our format with an 'applied' flag
      const formattedSuggestions = suggestions.map((item) => ({
        src: item.src,
        dst: item.dst,
        applied: true, // Default to selected
      }))

      setAiSuggestions(formattedSuggestions)
      setAiOrganizeStatus("complete")
      setAiOrganizeMessage(
        formattedSuggestions.length > 0 ? "AI suggestions ready!" : "Your files are already well organized!",
      )
      setAiOrganizeProgress(100)
    } catch (error) {
      console.error("Error analyzing file structure:", error)
      setAiOrganizeStatus("error")
      setAiOrganizeMessage(`Error: ${error.message || "Unknown error occurred"}`)
      setAiOrganizeProgress(100)
    }
  }

  // Function to start the AI auto-organize process
  const startAiAutoOrganize = async () => {
    if (!rootHandle) return

    setIsAiDialogOpen(true)
    setAiOrganizeStatus("idle")
    setAiSuggestions([])
    setAiOrganizeProgress(0)
    setAiOrganizeMessage("Preparing to analyze file structure...")

    try {
      const fileTree = await gatherFileTreeData(rootHandle)
      await sendToAnthropicApi(fileTree)
    } catch (error) {
      console.error("Error in AI auto-organize:", error)
      setAiOrganizeStatus("error")
      setAiOrganizeMessage(`Error: ${error.message || "Unknown error occurred"}`)
      setAiOrganizeProgress(100)
    }
  }

  // Function to apply the selected AI suggestions
  const applyAiSuggestions = async () => {
    if (!rootHandle) return

    const selectedSuggestions = aiSuggestions.filter((s) => s.applied)
    if (selectedSuggestions.length === 0) {
      setAiOrganizeMessage("No suggestions selected to apply")
      return
    }

    setAiOrganizeStatus("processing")
    setAiOrganizeMessage("Applying selected suggestions...")
    setAiOrganizeProgress(0)

    // Process moves in batches to avoid overwhelming the file system
    const totalMoves = selectedSuggestions.length
    let completedMoves = 0

    for (const suggestion of selectedSuggestions) {
      try {
        setAiOrganizeMessage(`Moving ${suggestion.src} to ${suggestion.dst}...`)

        // Parse the paths
        const srcPath = suggestion.src.split("/").filter(Boolean)
        const dstPath = suggestion.dst.split("/").filter(Boolean)

        if (srcPath.length === 0 || dstPath.length === 0) {
          console.error(`Invalid path in suggestion: ${suggestion.src} -> ${suggestion.dst}`)
          continue
        }

        // Skip if source and destination are the same
        if (suggestion.src === suggestion.dst) {
          console.log(`Skipping move from ${suggestion.src} to ${suggestion.dst} (same path)`)
          completedMoves++
          setAiOrganizeProgress(Math.round((completedMoves / totalMoves) * 100))
          continue
        }

        // Get the source file/directory
        let sourceParentDir = rootHandle
        const srcName = srcPath[srcPath.length - 1]

        // Navigate to source parent directory
        if (srcPath.length > 1) {
          try {
            for (let i = 0; i < srcPath.length - 1; i++) {
              sourceParentDir = await sourceParentDir.getDirectoryHandle(srcPath[i])
            }
          } catch (error) {
            console.error(`Source parent directory not found: ${srcPath.slice(0, -1).join("/")}`)
            continue
          }
        }

        // Check if the source exists
        let isDirectory = false
        try {
          try {
            await sourceParentDir.getDirectoryHandle(srcName)
            isDirectory = true
          } catch {
            await sourceParentDir.getFileHandle(srcName)
            isDirectory = false
          }
        } catch (error) {
          console.error(`Source item not found: ${suggestion.src}`)
          continue
        }

        // Create all destination directories
        let destDir = rootHandle
        for (let i = 0; i < dstPath.length - 1; i++) {
          try {
            destDir = await destDir.getDirectoryHandle(dstPath[i])
          } catch {
            // Create the directory if it doesn't exist
            destDir = await destDir.getDirectoryHandle(dstPath[i], { create: true })
          }
        }

        const dstName = dstPath[dstPath.length - 1]

        // Move the file/directory
        if (isDirectory) {
          // For directories, we need to copy all contents and then delete the original
          try {
            const sourceDir = await sourceParentDir.getDirectoryHandle(srcName)
            const targetDir = await destDir.getDirectoryHandle(dstName, { create: true })

            await filesystemService.copyDirectoryContents(
              sourceDir,
              targetDir,
              (processed, total) => {
                const progress = Math.round((processed / total) * 100)
                setAiOrganizeProgress(
                  Math.round((completedMoves / totalMoves) * 100) + Math.round(progress / totalMoves),
                )
              },
              async (success) => {
                if (success) {
                  try {
                    await sourceParentDir.removeEntry(srcName, { recursive: true })
                    completedMoves++
                    setAiOrganizeProgress(Math.round((completedMoves / totalMoves) * 100))
                  } catch (error) {
                    console.error(`Error removing original directory ${srcName}:`, error)
                  }
                }
              },
            )
          } catch (error) {
            console.error(`Error moving directory ${srcName}:`, error)
            continue
          }
        } else {
          // For files, use the moveFile function
          try {
            const fileHandle = await sourceParentDir.getFileHandle(srcName)
            await filesystemService.moveFile(sourceParentDir, destDir, srcName, (progress) => {
              setAiOrganizeProgress(Math.round((completedMoves / totalMoves) * 100) + Math.round(progress / totalMoves))
            })
            completedMoves++
            setAiOrganizeProgress(Math.round((completedMoves / totalMoves) * 100))
          } catch (error) {
            console.error(`Error moving file ${srcName}:`, error)
            continue
          }
        }
      } catch (error) {
        console.error(`Error applying suggestion ${suggestion.src} -> ${suggestion.dst}:`, error)
        // Continue with the next suggestion instead of stopping
      }
    }

    // Refresh the file tree
    await buildDirectoryTree(rootHandle)
    await loadDirectory(rootHandle, currentPath)

    setAiOrganizeStatus("complete")
    setAiOrganizeMessage(`Applied ${completedMoves} of ${totalMoves} suggestions successfully!`)
    setAiOrganizeProgress(100)
  }

  // Helper function to check if an item is a directory
  const isItemDirectory = async (parentDir: FileSystemDirectoryHandle, name: string): Promise<boolean> => {
    try {
      // Try to get it as a directory first
      await parentDir.getDirectoryHandle(name)
      return true
    } catch {
      try {
        // If that fails, try to get it as a file
        await parentDir.getFileHandle(name)
        return false
      } catch {
        // If both fail, the item doesn't exist
        throw new Error(`Item "${name}" not found in directory`)
      }
    }
  }

  // Function to toggle a suggestion's applied status
  const toggleSuggestion = (index: number) => {
    setAiSuggestions((prev) =>
      prev.map((suggestion, i) => (i === index ? { ...suggestion, applied: !suggestion.applied } : suggestion)),
    )
  }

  // Function to toggle all suggestions
  const toggleAllSuggestions = (value: boolean) => {
    setAiSuggestions((prev) => prev.map((suggestion) => ({ ...suggestion, applied: value })))
  }

  // Add a function to handle the advertise button click
  const handleAdvertise = async () => {
    if (!selectedItem || selectedItem.kind !== "file" || !selectedItem.handle) return

    try {
      const fileHandle = selectedItem.handle as FileSystemFileHandle
      const file = await filesystemService.readFile(fileHandle)
      setMarketplaceFile(file)
      setShowMarketplace(true)
    } catch (error) {
      console.error("Error preparing file for marketplace:", error)
    }
  }

  // Update the handleSearch function to use our new search functionality
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    performSearch(searchQuery)
  }

  return (
    <div className="h-screen" onDragOver={handlePageDragOver} onDragLeave={handlePageDragLeave} onDrop={handlePageDrop}>
      {isExternalDragOver && (
        <div className="absolute bottom-4 right-4 bg-background p-4 rounded-lg shadow-lg border z-50">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium">Drop files to upload</p>
          </div>
        </div>
      )}

      {/* Operations progress */}
      {operations.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-background p-4 rounded-lg shadow-lg border z-50 w-64 space-y-4">
          {operations.map((op) => (
            <div key={op.type} className="space-y-2">
              <div className="flex justify-between">
                <h3 className="font-medium text-sm">{op.message}</h3>
                <span className="text-xs text-muted-foreground">{op.progress}%</span>
              </div>
              <Progress value={op.progress} className="h-2" />
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input for upload button */}
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileInputChange} multiple />

      <SidebarProvider>
        <div className="flex h-full w-full">
          {/* Sidebar with custom width */}
          <div className="relative h-full flex-none min-w-[200px]">
            <Sidebar>
              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupLabel>File System</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem
                        draggable
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (rootHandle) {
                            const rootItem: FileSystemItem = {
                              name: "root",
                              kind: "directory",
                              path: [],
                              handle: rootHandle,
                            }
                            handleDrop(e, rootItem)
                          }
                        }}
                      >
                        <SidebarMenuButton onClick={() => rootHandle && loadDirectory(rootHandle, [])}>
                          <Home className="h-4 w-4" />
                          <span>Root</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      {directoryTree.map((dir) => (
                        <SidebarMenuItem
                          key={dir.path.join("/")}
                          draggable
                          onDragStart={(e) => handleDragStart(e, dir)}
                          onDrop={(e) => handleDrop(e, dir)}
                          onDragOver={(e) => handleDragOver(e, dir)}
                          className={
                            dropTargetItem?.path.join("/") === dir.path.join("/") ? "bg-primary/10 rounded-md" : ""
                          }
                        >
                          <Collapsible className="w-full">
                            <CollapsibleTrigger className="flex w-full">
                              <SidebarMenuButton
                                onClick={() => navigateToDirectory(dir.path)}
                                className="flex items-center gap-2"
                              >
                                <ChevronRight className="h-4 w-4" />
                                <Folder className="h-4 w-4 text-blue-500" />
                                <span>{dir.name}</span>
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {/* This would recursively render subdirectories */}
                                {/* For simplicity, we're not implementing full recursion */}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </Collapsible>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
            </Sidebar>

            {/* Resizer for sidebar - wider hit area */}
          </div>

          <SidebarInset className="flex flex-col flex-1">
            <div className="flex items-center justify-between border-b p-2">
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setIsCreatingFile(true)
                          setIsCreatingFolder(false)
                          setIsRenaming(false)
                          setNewItemName("")
                          // Wait for the new item to be added to the DOM
                          setTimeout(() => {
                            const input = document.getElementById("new-item-input")
                            if (input) input.focus()
                          }, 10)
                        }}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>New File</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setIsCreatingFolder(true)
                          setIsCreatingFile(false)
                          setIsRenaming(false)
                          setNewItemName("")
                          // Wait for the new item to be added to the DOM
                          setTimeout(() => {
                            const input = document.getElementById("new-item-input")
                            if (input) input.focus()
                          }, 10)
                        }}
                      >
                        <FolderPlus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>New Folder</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={!selectedItem}
                        onClick={() => {
                          if (selectedItem) {
                            setIsRenaming(true)
                            setIsCreatingFile(false)
                            setIsCreatingFolder(false)
                            setNewItemName(selectedItem.name)
                          }
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Rename</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" onClick={downloadFile}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {selectedItem
                          ? selectedItem.kind === "file"
                            ? "Download File"
                            : "Download Folder as ZIP"
                          : "Download Root as ZIP"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" disabled={!selectedItem} onClick={deleteItem}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Delete</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Upload Files</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" onClick={startAiAutoOrganize}>
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>AI Auto-Organize</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleAdvertise}
                        disabled={!selectedItem || selectedItem.kind !== "file"}
                      >
                        <Megaphone className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Advertise File</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" onClick={() => setShowNetworkVisualization(true)}>
                        <Wifi className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Network Visualization</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Now update the search form in the JSX to use the new functionality
              // Find the search form and replace it with this: */}

              {/* Search form */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    placeholder="Search files..."
                    className="w-[200px] pl-8 h-8"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("")
                        setSearchResults([])
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden h-full">
              <div
                className="flex-1 overflow-auto relative"
                onClick={(e) => {
                  // Only clear selection if clicking directly on the container, not on its children
                  if (e.target === e.currentTarget) {
                    setSelectedItem(null)
                    setFileContent(null)
                    setEditedContent(null)
                    setPreviewType(null)
                    setPreviewUrl(null)
                  }
                }}
              >
                {/* Search results header */}
                {searchResults.length > 0 && (
                  <div className="bg-muted/50 p-2 border-b">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        Found {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{searchQuery}"
                      </p>
                      <Button variant="ghost" size="sm" onClick={clearSearch}>
                        Clear results
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-[auto_1fr_100px_100px_180px] border-b">
                  <div className="p-2 font-medium"></div>
                  <div
                    className="p-2 font-medium cursor-pointer hover:bg-muted"
                    onClick={() => handleHeaderClick("name")}
                  >
                    Name {sortConfig.key === "name" && (sortConfig.direction === "ascending" ? "↑" : "↓")}
                  </div>
                  <div
                    className="p-2 font-medium cursor-pointer hover:bg-muted"
                    onClick={() => handleHeaderClick("size")}
                  >
                    Size {sortConfig.key === "size" && (sortConfig.direction === "ascending" ? "↑" : "↓")}
                  </div>
                  <div
                    className="p-2 font-medium cursor-pointer hover:bg-muted"
                    onClick={() => handleHeaderClick("type")}
                  >
                    Type {sortConfig.key === "type" && (sortConfig.direction === "ascending" ? "↑" : "↓")}
                  </div>
                  <div
                    className="p-2 font-medium cursor-pointer hover:bg-muted"
                    onClick={() => handleHeaderClick("lastModified")}
                  >
                    Modified {sortConfig.key === "lastModified" && (sortConfig.direction === "ascending" ? "↑" : "↓")}
                  </div>
                </div>

                <div>
                  {/* Show search results if available, otherwise show current directory items */}
                  {(searchResults.length > 0 ? searchResults : sortedItems).map((item) => (
                    <div
                      key={item.path.join("/")}
                      className={`grid grid-cols-[auto_1fr_100px_100px_180px] hover:bg-muted cursor-pointer ${
                        selectedItem?.path.join("/") === item.path.join("/") ? "bg-muted" : ""
                      } ${dropTargetItem?.path.join("/") === item.path.join("/") ? "bg-primary/10" : ""}`}
                      onClick={(e) => {
                        // Don't trigger item selection when clicking on the rename input
                        if (isRenaming && selectedItem?.path.join("/") === item.path.join("/")) {
                          return
                        }
                        e.stopPropagation()
                        handleItemClick(item)
                      }}
                      onDoubleClick={() => handleItemDoubleClick(item)}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation()
                        handleDragStart(e, item)
                      }}
                      onDrop={(e) => {
                        e.stopPropagation()
                        handleDrop(e, item)
                      }}
                      onDragOver={(e) => {
                        e.stopPropagation()
                        handleDragOver(e, item)
                      }}
                    >
                      <div className="flex items-center p-2">{getFileIcon(item)}</div>
                      <div className="flex items-center p-2 overflow-hidden text-ellipsis whitespace-nowrap">
                        {isRenaming && selectedItem?.path.join("/") === item.path.join("/") ? (
                          <Input
                            ref={renameInputRef}
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                renameItem(e)
                              }
                              e.stopPropagation()
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={() => setIsRenaming(false)}
                            className="h-7 w-full"
                            autoFocus
                          />
                        ) : (
                          <>
                            {item.name}
                            {searchResults.length > 0 && (
                              <span className="text-xs text-muted-foreground ml-2">
                                {item.path.slice(0, -1).join("/")}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex items-center p-2">
                        {item.kind === "file"
                          ? formatFileSize(item.size)
                          : item.size !== undefined
                            ? `${item.size} ${item.size === 1 ? "item" : "items"}`
                            : "-"}
                      </div>
                      <div className="flex items-center p-2 overflow-hidden text-ellipsis whitespace-nowrap">
                        {item.kind === "file" ? item.type || "-" : "Folder"}
                      </div>
                      <div className="flex items-center p-2">
                        {item.kind === "file" ? formatDate(item.lastModified) : "-"}
                      </div>
                    </div>
                  ))}
                  {/* New file inline input */}
                  {isCreatingFile && (
                    <div className="grid grid-cols-[auto_1fr_100px_100px_180px] bg-muted">
                      <div className="flex items-center p-2">
                        <File className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="flex items-center p-2">
                        <Input
                          id="new-item-input"
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          onKeyDown={createNewFile}
                          onBlur={() => setIsCreatingFile(false)}
                          className="h-7 w-full"
                          placeholder="New file name"
                          autoFocus
                        />
                      </div>
                      <div className="flex items-center p-2">-</div>
                      <div className="flex items-center p-2">-</div>
                      <div className="flex items-center p-2">-</div>
                    </div>
                  )}

                  {/* New folder inline input */}
                  {isCreatingFolder && (
                    <div className="grid grid-cols-[auto_1fr_100px_100px_180px] bg-muted">
                      <div className="flex items-center p-2">
                        <Folder className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="flex items-center p-2">
                        <Input
                          id="new-item-input"
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          onKeyDown={createNewFolder}
                          onBlur={() => setIsCreatingFolder(false)}
                          className="h-7 w-full"
                          placeholder="New folder name"
                          autoFocus
                        />
                      </div>
                      <div className="flex items-center p-2">-</div>
                      <div className="flex items-center p-2">Folder</div>
                      <div className="flex items-center p-2">-</div>
                    </div>
                  )}
                </div>
              </div>

              {selectedItem && (
                <div className="flex h-full flex-none w-1/4 min-w-[300px] border-l">
                  <div className="w-full overflow-auto p-4">
                    <h3 className="text-lg font-semibold mb-2">{selectedItem.name}</h3>

                    <div className="grid grid-cols-[100px_1fr] gap-2 mb-4">
                      <div className="font-medium">Type:</div>
                      <div>{selectedItem.kind === "directory" ? "Folder" : selectedItem.type || "Unknown"}</div>

                      <div className="font-medium">Size:</div>
                      <div>
                        {selectedItem.kind === "directory"
                          ? selectedItem.size !== undefined
                            ? `${selectedItem.size} ${selectedItem.size === 1 ? "item" : "items"}`
                            : "-"
                          : formatFileSize(selectedItem.size)}
                      </div>

                      <div className="font-medium">Modified:</div>
                      <div>{selectedItem.kind === "file" ? formatDate(selectedItem.lastModified) : "-"}</div>

                      <div className="font-medium">Path:</div>
                      <div className="overflow-hidden text-ellipsis">{selectedItem.path.join("/")}</div>
                    </div>

                    {selectedItem.kind === "file" && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">Preview:</h4>
                          {previewType === "text" && hasContentChanged && (
                            <Button size="sm" onClick={saveFileContent}>
                              Save Changes
                            </Button>
                          )}
                        </div>

                        {isPreviewLoading ? (
                          <div className="flex items-center justify-center h-[400px] border rounded">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          </div>
                        ) : previewError ? (
                          <Alert variant="destructive" className="mb-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{previewError}</AlertDescription>
                          </Alert>
                        ) : (
                          <div className="border rounded overflow-hidden">
                            {previewType === "text" && (
                              <textarea
                                value={editedContent || ""}
                                onChange={(e) => {
                                  setEditedContent(e.target.value)
                                  setHasContentChanged(e.target.value !== fileContent)
                                }}
                                className="w-full h-[400px] p-2 text-xs font-mono resize-none focus:outline-none"
                              />
                            )}

                            {previewType === "image" && previewUrl && (
                              <div className="flex items-center justify-center h-[400px] bg-black/5 p-2">
                                <img
                                  src={previewUrl || "/placeholder.svg"}
                                  alt={selectedItem.name}
                                  className="max-w-full max-h-full object-contain"
                                />
                              </div>
                            )}

                            {previewType === "video" && previewUrl && (
                              <div className="h-[400px] flex items-center justify-center bg-black/5">
                                <video
                                  src={previewUrl}
                                  controls
                                  className="max-w-full max-h-full"
                                  onError={() => setPreviewError("Error loading video")}
                                />
                              </div>
                            )}

                            {previewType === "audio" && previewUrl && (
                              <div className="h-[400px] flex flex-col items-center justify-center p-4 gap-4">
                                <FileAudio className="h-24 w-24 text-primary/50" />
                                <audio
                                  src={previewUrl}
                                  controls
                                  className="w-full"
                                  onError={() => setPreviewError("Error loading audio")}
                                />
                                <p className="text-sm text-muted-foreground text-center">{selectedItem.name}</p>
                              </div>
                            )}

                            {previewType === "other" && (
                              <div className="h-[400px] flex flex-col items-center justify-center p-4 gap-4">
                                <FileType className="h-24 w-24 text-muted-foreground/50" />
                                <p className="text-sm text-muted-foreground text-center">
                                  Preview not available for this file type
                                </p>
                                <Button size="sm" variant="outline" onClick={downloadFile}>
                                  <Download className="h-4 w-4 mr-2" />
                                  Download File
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t p-2 flex items-center gap-1 text-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => rootHandle && loadDirectory(rootHandle, [])}
                draggable
                onDragStart={(e) => handleBreadcrumbDragStart(e, [])}
                onDragOver={(e) => {
                  e.preventDefault()
                  handleBreadcrumbDragOver(e, [])
                }}
                onDragLeave={() => setDropTargetItem(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  handleBreadcrumbDrop(e, [])
                }}
                className={dropTargetItem?.path.join("/") === "" ? "bg-primary/10" : ""}
              >
                <Home className="h-3 w-3 mr-1" />
                Root
              </Button>

              {currentPath.map((segment, index) => (
                <div key={index} className="flex items-center">
                  <ChevronRight className="h-3 w-3 mx-1 text-muted-foreground" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateToDirectory(currentPath.slice(0, index + 1))}
                    draggable
                    onDragStart={(e) => handleBreadcrumbDragStart(e, currentPath.slice(0, index + 1))}
                    onDragOver={(e) => {
                      e.preventDefault()
                      handleBreadcrumbDragOver(e, currentPath.slice(0, index + 1))
                    }}
                    onDragLeave={() => setDropTargetItem(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      handleBreadcrumbDrop(e, currentPath.slice(0, index + 1))
                    }}
                    className={
                      dropTargetItem?.path.join("/") === currentPath.slice(0, index + 1).join("/")
                        ? "bg-primary/10"
                        : ""
                    }
                  >
                    {segment}
                  </Button>
                </div>
              ))}

              {/* Add selected item to breadcrumb if it exists */}
              {selectedItem && (
                <div className="flex items-center">
                  <ChevronRight className="h-3 w-3 mx-1 text-muted-foreground" />
                  <Button
                    variant={selectedItem.kind === "file" ? "outline" : "ghost"}
                    size="sm"
                    onClick={() => {
                      if (selectedItem.kind === "directory" && selectedItem.handle) {
                        loadDirectory(selectedItem.handle as FileSystemDirectoryHandle, selectedItem.path)
                      }
                    }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, selectedItem)}
                    onDragOver={(e) => {
                      if (selectedItem.kind === "directory") {
                        e.preventDefault()
                        handleBreadcrumbDragOver(e, selectedItem.path)
                      }
                    }}
                    onDragLeave={() => setDropTargetItem(null)}
                    onDrop={(e) => {
                      if (selectedItem.kind === "directory") {
                        e.preventDefault()
                        handleDrop(e, selectedItem)
                      }
                    }}
                    className={`${selectedItem.kind === "file" ? "cursor-default" : ""} ${dropTargetItem?.path.join("/") === selectedItem.path.join("/") ? "bg-primary/10" : ""}`}
                    onDragLeave={() => setDropTargetItem(null)}
                  >
                    {selectedItem.kind === "file" ? (
                      <div className="flex items-center gap-1">
                        {getFileIcon(selectedItem)}
                        <span>{selectedItem.name}</span>
                      </div>
                    ) : (
                      selectedItem.name
                    )}
                  </Button>
                </div>
              )}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>

      {/* AI Organize Dialog */}
      <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Auto-Organize
            </DialogTitle>
            <DialogDescription>Let AI analyze your file structure and suggest a better organization</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
            {/* Status and progress */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium">{aiOrganizeMessage}</p>
                <span className="text-xs text-muted-foreground">{aiOrganizeProgress}%</span>
              </div>
              <Progress value={aiOrganizeProgress} className="h-2" />
            </div>

            {/* Suggestions list */}
            {aiOrganizeStatus === "complete" && aiSuggestions.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Suggested File Moves</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="select-all"
                        checked={aiSuggestions.every((s) => s.applied)}
                        onCheckedChange={(checked) => toggleAllSuggestions(!!checked)}
                      />
                      <Label htmlFor="select-all">Select All</Label>
                    </div>
                    <Button size="sm" onClick={applyAiSuggestions} disabled={!aiSuggestions.some((s) => s.applied)}>
                      Apply Selected
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[300px] border rounded-md p-4">
                  <div className="space-y-2">
                    {aiSuggestions.map((suggestion, index) => (
                      <div key={index} className="flex items-start gap-2 p-2 hover:bg-muted rounded-md">
                        <Checkbox
                          id={`suggestion-${index}`}
                          checked={suggestion.applied}
                          onCheckedChange={() => toggleSuggestion(index)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{suggestion.src}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              {suggestion.dst}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* No suggestions message */}
            {aiOrganizeStatus === "complete" && aiSuggestions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Changes Needed</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-2">
                  Your file structure already looks well organized! The AI didn't find any improvements to suggest.
                </p>
              </div>
            )}

            {/* Error message */}
            {aiOrganizeStatus === "error" && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <h3 className="text-lg font-medium text-destructive">Error</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-2">{aiOrganizeMessage}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAiDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {showMarketplace && (
        <div className="fixed inset-0 z-50 bg-background">
          <Marketplace
            onClose={() => {
              setShowMarketplace(false)
              setMarketplaceFile(null)
            }}
            initialFile={marketplaceFile}
            currentPath={currentPath}
            onFileDownloaded={async (file) => {
              if (!rootHandle) return

              try {
                // Navigate to the current directory
                let currentDir = rootHandle
                for (const segment of currentPath) {
                  currentDir = await currentDir.getDirectoryHandle(segment)
                }

                // Save the file to the current directory
                await filesystemService.saveFile(currentDir, file)

                // Refresh the directory view
                await loadDirectory(currentDir, currentPath)
              } catch (error) {
                console.error("Error saving downloaded file:", error)
              }
            }}
          />
        </div>
      )}
      {showNetworkVisualization && (
        <div className="fixed inset-0 z-50 bg-background">
          <NetworkVisualization onClose={() => setShowNetworkVisualization(false)} />
        </div>
      )}
    </div>
  )
}

