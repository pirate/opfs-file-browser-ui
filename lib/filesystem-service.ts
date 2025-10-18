// Types
export type FileSystemItem = {
  name: string
  kind: "file" | "directory"
  size?: number
  type?: string
  lastModified?: number
  path: string[]
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle
}

// Helper function to get file type from name
export const getFileTypeFromName = (name: string): string => {
  const extension = name.split(".").pop()?.toLowerCase() || ""

  const typeMap: Record<string, string> = {
    txt: "text/plain",
    html: "text/html",
    css: "text/css",
    js: "text/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    md: "text/markdown",
  }

  return typeMap[extension] || "application/octet-stream"
}

// Filesystem service class
export class FilesystemService {
  // Get root directory
  async getRoot(): Promise<FileSystemDirectoryHandle> {
    try {
      return await navigator.storage.getDirectory()
    } catch (error) {
      console.error("Error accessing file system:", error)
      throw error
    }
  }

  // Load directory contents
  async loadDirectory(dirHandle: FileSystemDirectoryHandle, path: string[]): Promise<FileSystemItem[]> {
    const entries: FileSystemItem[] = []

    try {
      // Now actually process the entries
      for await (const entry of dirHandle.values()) {
        const item: FileSystemItem = {
          name: entry.name,
          kind: entry.kind,
          path: [...path, entry.name],
          handle: entry,
        }

        if (entry.kind === "file") {
          const fileHandle = entry as FileSystemFileHandle
          const file = await fileHandle.getFile()
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
          item.size = count // Store the count in the size property
        }

        entries.push(item)
      }

      // Add a small delay to ensure filesystem operations complete
      await new Promise((resolve) => setTimeout(resolve, 50))

      return entries
    } catch (error) {
      // Check if the error is a "not found" error
      if (
        error instanceof DOMException &&
        (error.name === "NotFoundError" || error.message.includes("A requested file or directory could not be found"))
      ) {
        console.warn(`Directory not found at path: ${path.join("/")}. Returning empty array.`)
        return [] // Return empty array instead of throwing for "not found" errors
      }

      console.error("Error loading directory:", error)
      throw error
    }
  }

  // Build directory tree (only directories)
  async buildDirectoryTree(dirHandle: FileSystemDirectoryHandle, path: string[] = []): Promise<FileSystemItem[]> {
    const entries: FileSystemItem[] = []

    try {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === "directory") {
          const item: FileSystemItem = {
            name: entry.name,
            kind: entry.kind,
            path: [...path, entry.name],
            handle: entry,
          }
          entries.push(item)
        }
      }

      return entries
    } catch (error) {
      console.error("Error building directory tree:", error)
      throw error
    }
  }

  // Navigate to a directory
  async navigateToDirectory(rootHandle: FileSystemDirectoryHandle, path: string[]): Promise<FileSystemDirectoryHandle> {
    let currentDir = rootHandle

    for (const segment of path) {
      try {
        currentDir = await currentDir.getDirectoryHandle(segment)
      } catch (error) {
        if (
          error instanceof DOMException &&
          (error.name === "NotFoundError" || error.message.includes("A requested file or directory could not be found"))
        ) {
          console.warn(`Directory segment "${segment}" not found while navigating to ${path.join("/")}`)
          throw new Error(`Directory not found: ${path.join("/")}`)
        }
        console.error(`Error navigating to ${segment}:`, error)
        throw error
      }
    }

    return currentDir
  }

  // Create a new file
  async createFile(dirHandle: FileSystemDirectoryHandle, fileName: string, content = ""): Promise<void> {
    try {
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(content)
      await writable.close()
    } catch (error) {
      console.error("Error creating file:", error)
      throw error
    }
  }

  // Create a new folder
  async createFolder(dirHandle: FileSystemDirectoryHandle, folderName: string): Promise<void> {
    try {
      await dirHandle.getDirectoryHandle(folderName, { create: true })
    } catch (error) {
      console.error("Error creating folder:", error)
      throw error
    }
  }

  // Rename file or folder
  async renameItem(
    parentDir: FileSystemDirectoryHandle,
    item: FileSystemItem,
    newName: string,
  ): Promise<{ newHandle: FileSystemFileHandle | FileSystemDirectoryHandle; newPath: string[] }> {
    try {
      const oldName = item.name
      const parentPath = item.path.slice(0, -1)
      const newPath = [...parentPath, newName]

      if (item.kind === "file" && item.handle) {
        // Get the file content
        const fileHandle = item.handle as FileSystemFileHandle
        const file = await fileHandle.getFile()

        // Create a new file with the new name
        const newFileHandle = await parentDir.getFileHandle(newName, { create: true })
        const writable = await newFileHandle.createWritable()
        await writable.write(file)
        await writable.close()

        // Delete the old file
        await parentDir.removeEntry(oldName)

        return { newHandle: newFileHandle, newPath }
      } else if (item.kind === "directory" && item.handle) {
        // Create a new directory with the new name
        const newDirHandle = await parentDir.getDirectoryHandle(newName, { create: true })

        // Copy all contents from old to new directory
        const oldDirHandle = item.handle as FileSystemDirectoryHandle
        await this.copyDirectoryContents(
          oldDirHandle,
          newDirHandle,
          () => {},
          () => {},
        )

        // Delete the old directory
        await parentDir.removeEntry(oldName, { recursive: true })

        return { newHandle: newDirHandle, newPath }
      }

      throw new Error("Invalid item type")
    } catch (error) {
      console.error("Error renaming item:", error)
      throw error
    }
  }

  // Delete file or folder
  async deleteItem(parentDir: FileSystemDirectoryHandle, itemName: string, isDirectory: boolean): Promise<void> {
    try {
      await parentDir.removeEntry(itemName, { recursive: isDirectory })
    } catch (error) {
      console.error("Error deleting item:", error)
      throw error
    }
  }

  // Read file content
  async readFile(fileHandle: FileSystemFileHandle): Promise<File> {
    try {
      return await fileHandle.getFile()
    } catch (error) {
      console.error("Error reading file:", error)
      throw error
    }
  }

  // Write file content
  async writeFile(fileHandle: FileSystemFileHandle, content: string | ArrayBuffer | Blob): Promise<void> {
    try {
      const writable = await fileHandle.createWritable()
      await writable.write(content)
      await writable.close()
    } catch (error) {
      console.error("Error writing file:", error)
      throw error
    }
  }

  // Copy directory contents
  async copyDirectoryContents(
    source: FileSystemDirectoryHandle,
    target: FileSystemDirectoryHandle,
    onProgress: (processed: number, total: number) => void,
    onComplete: (success: boolean) => void,
  ): Promise<boolean> {
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

    await countFiles(source)

    // Copy files with progress tracking
    const copyFiles = async (source: FileSystemDirectoryHandle, target: FileSystemDirectoryHandle) => {
      try {
        for await (const entry of source.values()) {
          if (entry.kind === "file") {
            try {
              const fileHandle = entry as FileSystemFileHandle
              const file = await fileHandle.getFile()
              const newFileHandle = await target.getFileHandle(entry.name, { create: true })
              const writable = await newFileHandle.createWritable()

              // For small files, write them directly
              if (file.size < 20 * 1024 * 1024) {
                await writable.write(file)
                processedFiles++
                onProgress(processedFiles, totalFiles)
              } else {
                // For large files, write in chunks
                const CHUNK_SIZE = 20 * 1024 * 1024 // 20MB chunks
                let offset = 0

                while (offset < file.size) {
                  const chunk = file.slice(offset, offset + CHUNK_SIZE)
                  await writable.write({ type: "write", position: offset, data: chunk })
                  offset += chunk.size

                  // Update progress based on chunk progress for this file
                  const fileProgress = Math.min(offset / file.size, 1)
                  const overallProgress = processedFiles + fileProgress
                  onProgress(overallProgress, totalFiles)

                  // Small delay to allow UI to update
                  await new Promise((resolve) => setTimeout(resolve, 10))
                }

                processedFiles++
              }

              await writable.close()
            } catch (error) {
              console.error(`Error copying file ${entry.name}:`, error)
              throw error // Re-throw to handle in the outer catch
            }
          } else if (entry.kind === "directory") {
            try {
              const dirHandle = entry as FileSystemDirectoryHandle
              const newDirHandle = await target.getDirectoryHandle(entry.name, { create: true })
              await copyFiles(dirHandle, newDirHandle)
            } catch (error) {
              console.error(`Error copying directory ${entry.name}:`, error)
              throw error // Re-throw to handle in the outer catch
            }
          }
        }
      } catch (error) {
        console.error("Error in copyFiles:", error)
        throw error // Re-throw to handle in the outer try/catch
      }
    }

    try {
      await copyFiles(source, target)
      onComplete(true)
      return true // Return success status
    } catch (error) {
      console.error("Error copying directory contents:", error)
      onComplete(false)
      return false // Return failure status
    }
  }

  // Upload files
  async uploadFiles(
    targetDir: FileSystemDirectoryHandle,
    files: FileList,
    onProgress: (uploaded: number, total: number) => void,
  ): Promise<void> {
    try {
      const totalBytes = Array.from(files).reduce((total, file) => total + file.size, 0)
      let uploadedBytes = 0

      for (const file of files) {
        // Create a new file in the target directory
        const fileHandle = await targetDir.getFileHandle(file.name, { create: true })
        const writable = await fileHandle.createWritable()

        // For small files, write them directly
        if (file.size < 20 * 1024 * 1024) {
          // Less than 20MB
          await writable.write(file)
          uploadedBytes += file.size
          onProgress(uploadedBytes, totalBytes)
        } else {
          // For large files, upload in chunks
          const CHUNK_SIZE = 20 * 1024 * 1024 // 20MB chunks
          let offset = 0

          while (offset < file.size) {
            const chunk = file.slice(offset, offset + CHUNK_SIZE)
            await writable.write({ type: "write", position: offset, data: chunk })

            offset += chunk.size
            uploadedBytes += chunk.size
            onProgress(uploadedBytes, totalBytes)

            // Small delay to allow UI to update
            await new Promise((resolve) => setTimeout(resolve, 10))
          }
        }

        await writable.close()
      }
    } catch (error) {
      console.error("Error uploading files:", error)
      throw error
    }
  }

  // Move file
  async moveFile(
    sourceParentDir: FileSystemDirectoryHandle,
    targetDir: FileSystemDirectoryHandle,
    fileName: string,
    onProgress: (progress: number) => void,
  ): Promise<void> {
    try {
      // Move file
      const sourceFileHandle = await sourceParentDir.getFileHandle(fileName)
      const file = await sourceFileHandle.getFile()
      const targetFileHandle = await targetDir.getFileHandle(fileName, { create: true })
      const writable = await targetFileHandle.createWritable()

      // For small files, write them directly
      if (file.size < 20 * 1024 * 1024) {
        await writable.write(file)
        onProgress(100)
      } else {
        // For large files, write in chunks
        const CHUNK_SIZE = 20 * 1024 * 1024 // 20MB chunks
        let offset = 0

        while (offset < file.size) {
          const chunk = file.slice(offset, offset + CHUNK_SIZE)
          await writable.write({ type: "write", position: offset, data: chunk })

          offset += chunk.size
          const progress = Math.round((offset / file.size) * 100)
          onProgress(progress)

          // Small delay to allow UI to update
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
      }

      await writable.close()

      // Only remove the original file after the copy is complete
      try {
        await sourceParentDir.removeEntry(fileName)
      } catch (error) {
        console.error(`Error removing original file ${fileName}:`, error)
        // Continue anyway since the file was copied successfully
      }
    } catch (error) {
      console.error("Error moving file:", error)
      throw error
    }
  }

  // Determine file type for preview
  determineFileType(file: File): "text" | "image" | "video" | "audio" | "other" {
    const mimeType = file.type || getFileTypeFromName(file.name)

    if (mimeType.startsWith("image/")) {
      return "image"
    } else if (mimeType.startsWith("video/")) {
      return "video"
    } else if (mimeType.startsWith("audio/")) {
      return "audio"
    } else if (
      mimeType.startsWith("text/") ||
      mimeType === "application/json" ||
      mimeType === "application/javascript" ||
      mimeType === "application/xml" ||
      mimeType === "application/markdown" ||
      /\.(txt|md|js|jsx|ts|tsx|css|scss|html|xml|json|csv)$/i.test(file.name)
    ) {
      return "text"
    }

    return "other"
  }

  // Save a file to a directory
  async saveFile(dirHandle: FileSystemDirectoryHandle, file: File): Promise<FileSystemFileHandle> {
    try {
      // Create or get the file handle
      const fileHandle = await dirHandle.getFileHandle(file.name, { create: true })

      // Get a writable stream
      const writable = await fileHandle.createWritable()

      // Write the file content
      await writable.write(file)

      // Close the stream
      await writable.close()

      return fileHandle
    } catch (error) {
      console.error("Error saving file:", error)
      throw error
    }
  }
}

// Create and export a singleton instance
export const filesystemService = new FilesystemService()

