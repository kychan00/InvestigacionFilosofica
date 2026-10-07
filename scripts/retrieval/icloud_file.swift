#!/usr/bin/env swift

import Foundation

struct ItemStatus: Codable {
    let path: String
    let exists: Bool
    let isUbiquitous: Bool?
    let isUploaded: Bool?
    let isUploading: Bool?
    let isDownloading: Bool?
    let downloadingStatus: String?
    let hasUnresolvedConflicts: Bool?
    let fileSize: Int?
}

enum ToolError: Error, CustomStringConvertible {
    case usage(String)
    case unsafe(String)
    case timeout(String)

    var description: String {
        switch self {
        case .usage(let message), .unsafe(let message), .timeout(let message):
            return message
        }
    }
}

let resourceKeys: Set<URLResourceKey> = [
    .isUbiquitousItemKey,
    .ubiquitousItemIsUploadedKey,
    .ubiquitousItemIsUploadingKey,
    .ubiquitousItemIsDownloadingKey,
    .ubiquitousItemDownloadingStatusKey,
    .ubiquitousItemHasUnresolvedConflictsKey,
    .fileSizeKey,
]

func readStatus(_ path: String) throws -> ItemStatus {
    var url = URL(fileURLWithPath: path).standardizedFileURL
    url.removeAllCachedResourceValues()
    let exists = FileManager.default.fileExists(atPath: url.path)
    guard exists else {
        return ItemStatus(
            path: url.path,
            exists: false,
            isUbiquitous: nil,
            isUploaded: nil,
            isUploading: nil,
            isDownloading: nil,
            downloadingStatus: nil,
            hasUnresolvedConflicts: nil,
            fileSize: nil
        )
    }
    let values = try url.resourceValues(forKeys: resourceKeys)
    return ItemStatus(
        path: url.path,
        exists: true,
        isUbiquitous: values.isUbiquitousItem,
        isUploaded: values.ubiquitousItemIsUploaded,
        isUploading: values.ubiquitousItemIsUploading,
        isDownloading: values.ubiquitousItemIsDownloading,
        downloadingStatus: values.ubiquitousItemDownloadingStatus?.rawValue,
        hasUnresolvedConflicts: values.ubiquitousItemHasUnresolvedConflicts,
        fileSize: values.fileSize
    )
}

func emit(_ status: ItemStatus) throws {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    let data = try encoder.encode(status)
    guard let output = String(data: data, encoding: .utf8) else {
        throw ToolError.unsafe("Could not encode status as UTF-8")
    }
    print(output)
}

func timeoutValue(_ arguments: [String]) throws -> TimeInterval {
    guard arguments.count >= 4, let seconds = Double(arguments[3]), seconds > 0 else {
        throw ToolError.usage("A positive timeout in seconds is required")
    }
    return seconds
}

func waitUntil(
    path: String,
    timeout: TimeInterval,
    predicate: (ItemStatus) -> Bool,
    description: String
) throws -> ItemStatus {
    let deadline = Date().addingTimeInterval(timeout)
    while true {
        let status = try readStatus(path)
        if predicate(status) {
            return status
        }
        if Date() >= deadline {
            throw ToolError.timeout("Timed out waiting for \(description): \(path)")
        }
        Thread.sleep(forTimeInterval: 1.0)
    }
}

do {
    let arguments = CommandLine.arguments
    guard arguments.count >= 3 else {
        throw ToolError.usage(
            "Usage: icloud_file.swift <status|wait-uploaded|evict|download> <path> [timeout-seconds]"
        )
    }
    let command = arguments[1]
    let path = arguments[2]

    switch command {
    case "status":
        try emit(readStatus(path))
    case "wait-uploaded":
        let timeout = try timeoutValue(arguments)
        let status = try waitUntil(
            path: path,
            timeout: timeout,
            predicate: { item in
                item.exists
                    && item.isUbiquitous == true
                    && item.isUploaded == true
                    && item.isUploading != true
                    && item.hasUnresolvedConflicts != true
            },
            description: "an iCloud upload"
        )
        try emit(status)
    case "evict":
        let before = try readStatus(path)
        guard before.exists, before.isUbiquitous == true else {
            throw ToolError.unsafe("Refusing to evict a non-iCloud item: \(path)")
        }
        guard before.isUploaded == true, before.isUploading != true else {
            throw ToolError.unsafe("Refusing to evict before upload completes: \(path)")
        }
        guard before.hasUnresolvedConflicts != true else {
            throw ToolError.unsafe("Refusing to evict an item with conflicts: \(path)")
        }
        try FileManager.default.evictUbiquitousItem(
            at: URL(fileURLWithPath: path).standardizedFileURL
        )
        try emit(readStatus(path))
    case "download":
        let timeout = try timeoutValue(arguments)
        let url = URL(fileURLWithPath: path).standardizedFileURL
        let before = try readStatus(path)
        guard before.exists, before.isUbiquitous == true, before.isUploaded == true else {
            throw ToolError.unsafe("Refusing to download an unconfirmed iCloud item: \(path)")
        }
        try FileManager.default.startDownloadingUbiquitousItem(at: url)
        let status = try waitUntil(
            path: path,
            timeout: timeout,
            predicate: { item in
                item.downloadingStatus == URLUbiquitousItemDownloadingStatus.current.rawValue
                    && item.isDownloading != true
            },
            description: "an iCloud download"
        )
        try emit(status)
    default:
        throw ToolError.usage("Unknown command: \(command)")
    }
} catch {
    FileHandle.standardError.write(Data("\(error)\n".utf8))
    exit(1)
}

