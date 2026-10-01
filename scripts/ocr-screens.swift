// Reads the text in screenshots with Apple's Vision framework, for the key-screen
// checks (#331). Vision ships with macOS, so this needs no downloads.
//
//   xcrun swift scripts/ocr-screens.swift <languages> <image>...
//
// <languages> is a comma-separated list in Vision's order of preference, such as
// "zh-Hant,en-US". Prints JSON: each image's path mapped to its lines of text,
// each with a confidence and a box as fractions of the image, measured from the
// top left: [x, y, width, height].
import AppKit
import Foundation
import Vision

let arguments = CommandLine.arguments.dropFirst()
guard let languageList = arguments.first else {
  FileHandle.standardError.write("Usage: ocr-screens.swift <languages> <image>...\n".data(using: .utf8)!)
  exit(2)
}
let languages = languageList.split(separator: ",").map(String.init)
var results: [String: [[String: Any]]] = [:]

for path in arguments.dropFirst() {
  guard
    let image = NSImage(contentsOfFile: path),
    let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
  else {
    FileHandle.standardError.write("Could not read \(path)\n".data(using: .utf8)!)
    exit(1)
  }
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.recognitionLanguages = languages
  // Report text as drawn, so a cut-off label stays cut off.
  request.usesLanguageCorrection = false
  try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])

  results[path] = (request.results ?? []).compactMap { observation in
    guard let best = observation.topCandidates(1).first else { return nil }
    let box = observation.boundingBox
    return [
      "text": best.string,
      "confidence": Double(best.confidence),
      "box": [box.minX, 1 - box.maxY, box.width, box.height].map { Double($0) },
    ]
  }
}

let data = try JSONSerialization.data(withJSONObject: results, options: [.sortedKeys])
FileHandle.standardOutput.write(data)
