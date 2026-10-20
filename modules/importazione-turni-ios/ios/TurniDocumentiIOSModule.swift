import ExpoModulesCore
import Foundation
import PDFKit
import Vision
import ImageIO
import UIKit

// Nessun decoder simulato, servizio remoto o accesso al calendario.
public class TurniDocumentiIOSModule: Module {
  private let queue = DispatchQueue(label: "vigilanza.turni.lettura", qos: .userInitiated)
  private let maxTesto = 500_000
  private let maxElementi = 20_000

  public func definition() -> ModuleDefinition {
    Name("TurniDocumentiIOS")
    Constants(["versione": 1])
    AsyncFunction("leggiPDF") { (uri: String) -> [String: Any] in
      return try self.leggiPDF(self.fileLocale(uri))
    }.runOnQueue(queue)
    AsyncFunction("leggiImmagine") { (uri: String) -> [String: Any] in
      return try self.leggiImmagine(self.fileLocale(uri))
    }.runOnQueue(queue)
  }

  private func errore(_ codice: String) -> Exception {
    return Exception(name: "TurniLettura", description: codice, code: codice)
  }

  private func fileLocale(_ uri: String) throws -> URL {
    guard uri.hasPrefix("file:///"), let url = URL(string: uri), url.isFileURL,
          url.query == nil, url.fragment == nil, url.host == nil || url.host == "",
          let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
      throw errore("URI_NON_LOCALE")
    }
    let file = url.standardizedFileURL.resolvingSymlinksInPath()
    let root = cache.standardizedFileURL.resolvingSymlinksInPath().path + "/"
    guard file.path.hasPrefix(root),
          ["DocumentPicker", "ImagePicker"].contains(file.deletingLastPathComponent().lastPathComponent) else {
      throw errore("URI_NON_ACQUISITO")
    }
    let info = try file.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
    guard info.isRegularFile == true, let size = info.fileSize, size > 0, size <= 20 * 1024 * 1024 else {
      throw errore("DIMENSIONE_NON_VALIDA")
    }
    return file
  }

  // Rettangoli normalizzati, origine in alto a sinistra della pagina leggibile.
  private func rettangolo(_ box: CGRect, pagina: CGRect) -> Any {
    let r = box.intersection(pagina)
    guard !r.isNull, r.width > 0, r.height > 0, pagina.width > 0, pagina.height > 0 else { return NSNull() }
    return [Double((r.minX - pagina.minX) / pagina.width), Double((pagina.maxY - r.maxY) / pagina.height),
            Double(r.width / pagina.width), Double(r.height / pagina.height)]
  }

  private func parole(_ testo: String) throws -> [NSTextCheckingResult] {
    return try NSRegularExpression(pattern: "\\S+").matches(in: testo, range: NSRange(testo.startIndex..., in: testo))
  }

  private func leggiPDF(_ url: URL) throws -> [String: Any] {
    guard let documento = PDFDocument(url: url) else { throw errore("PDF_NON_VALIDO") }
    guard !documento.isLocked else { throw errore("PDF_PROTETTO") }
    guard documento.pageCount > 0, documento.pageCount <= 30 else { throw errore("LIMITE_PAGINE") }
    var pagine: [[String: Any]] = []
    var caratteri = 0
    var quanti = 0
    for indice in 0..<documento.pageCount {
      let risultato: [String: Any] = try autoreleasepool {
        guard let pagina = documento.page(at: indice) else {
          return ["numero": indice + 1, "larghezza": NSNull(), "altezza": NSNull(), "testo": NSNull(),
                  "elementi": [], "righeOriginali": [], "errore": "PAGINA_NON_LETTA"]
        }
        let bounds = pagina.bounds(for: .cropBox)
        let testo = pagina.string ?? ""
        caratteri += testo.utf16.count
        guard caratteri <= maxTesto else { throw errore("LIMITE_TESTO") }
        var elementi: [[String: Any]] = []
        let ruotata = pagina.rotation % 360 != 0
        // Non attribuire coordinate sbagliate alle pagine ruotate: testo disponibile per mappatura manuale.
        if !ruotata {
          for match in try parole(testo) {
            quanti += 1
            guard quanti <= maxElementi else { throw errore("LIMITE_ELEMENTI") }
            let parola = (testo as NSString).substring(with: match.range)
            let selection = pagina.selection(for: match.range)
            let box = selection.map { rettangolo($0.bounds(for: pagina), pagina: bounds) } ?? NSNull()
            elementi.append(["id": "pdf-\(match.range.location)", "testo": parola,
                             "rettangolo": box, "confidenza": NSNull(), "gruppo": NSNull()])
          }
        }
        // Il testo presente può essere solo una cornice. Valutazione per pagina:
        // OCR quando mancano servizi plausibili o la geometria non è disponibile.
        let patternServizi = "\\b[0-9]{1,2}(?:[:.][0-9]{2})?\\s*[-–—/]\\s*[0-9]{1,2}(?:[:.][0-9]{2})?\\b"
        let serviziPDF = (try NSRegularExpression(pattern: patternServizi)).numberOfMatches(in: testo, range: NSRange(testo.startIndex..., in: testo))
        if ruotata || serviziPDF < 2 {
          let dimensione = CGSize(width: max(1, bounds.width), height: max(1, bounds.height))
          let scala = min(3, 4096 / max(dimensione.width, dimensione.height))
          let format = UIGraphicsImageRendererFormat()
          format.scale = scala
          format.opaque = true
          let renderer = UIGraphicsImageRenderer(size: dimensione, format: format)
          let immagine = renderer.image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: dimensione))
            // PDFKit applica orientamento e crop nella thumbnail.
            let thumb = pagina.thumbnail(of: CGSize(width: dimensione.width * scala, height: dimensione.height * scala), for: .cropBox)
            thumb.draw(in: CGRect(origin: .zero, size: dimensione))
          }
          if let cg = immagine.cgImage {
            let ocr = try riconosci(cg)
            let testoOCR = ocr.righe.compactMap { $0["testo"] as? String }.joined(separator: "\n")
            let serviziOCR = (try NSRegularExpression(pattern: patternServizi)).numberOfMatches(in: testoOCR, range: NSRange(testoOCR.startIndex..., in: testoOCR))
            // Una sola rappresentazione per pagina: nessuna concatenazione PDF/OCR.
            if testo.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || ruotata || serviziOCR > serviziPDF {
              caratteri += testoOCR.utf16.count
              quanti += ocr.elementi.count
              guard caratteri <= maxTesto, quanti <= maxElementi else { throw errore("LIMITE_TESTO") }
              return ["numero": indice + 1, "larghezza": Double(cg.width), "altezza": Double(cg.height),
                      "testo": NSNull(), "elementi": ocr.elementi, "righeOriginali": ocr.righe,
                      "errore": NSNull()]
            }
          }
        }
        var problema: Any = NSNull()
        if testo.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { problema = "PDF_SCANSIONE_NON_SUPPORTATA" }
        else if ruotata { problema = "GEOMETRIA_PDF_RUOTATO_NON_DISPONIBILE" }
        return ["numero": indice + 1, "larghezza": Double(bounds.width), "altezza": Double(bounds.height),
                "testo": testo, "elementi": elementi, "righeOriginali": [], "errore": problema]
      }
      pagine.append(risultato)
    }
    return ["versione": 1, "metodo": "pdfkit", "pagineAttese": documento.pageCount, "pagine": pagine]
  }

  private func leggiImmagine(_ url: URL) throws -> [String: Any] {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
          let width = properties[kCGImagePropertyPixelWidth] as? NSNumber,
          let height = properties[kCGImagePropertyPixelHeight] as? NSNumber,
          width.doubleValue > 0, height.doubleValue > 0,
          width.doubleValue * height.doubleValue <= 40_000_000 else { throw errore("IMMAGINE_NON_VALIDA_O_TROPPO_GRANDE") }
    // Thumbnail in memoria con trasformazione EXIF: niente copie su disco o originale decodificato interamente.
    let options: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: 4096]
    guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { throw errore("IMMAGINE_NON_VALIDA") }
    let lettura = try riconosci(image)
    return ["versione": 1, "metodo": "vision", "pagineAttese": 1, "pagine": [[
      "numero": 1, "larghezza": image.width, "altezza": image.height, "testo": NSNull(),
      "elementi": lettura.elementi, "righeOriginali": lettura.righe, "errore": NSNull(),
    ]]]
  }

  private func riconosci(_ image: CGImage) throws -> (elementi: [[String: Any]], righe: [[String: Any]]) {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["it-IT", "en-US"]
    request.usesLanguageCorrection = false
    try VNImageRequestHandler(cgImage: image, orientation: .up, options: [:]).perform([request])
    var elementi: [[String: Any]] = []
    var righe: [[String: Any]] = []
    var caratteri = 0
    let unita = CGRect(x: 0, y: 0, width: 1, height: 1)
    for (indice, observation) in (request.results ?? []).enumerated() {
      guard let candidate = observation.topCandidates(1).first else { continue }
      let testo = candidate.string
      caratteri += testo.utf16.count
      guard caratteri <= maxTesto, righe.count < 5000 else { throw errore("LIMITE_TESTO") }
      let gruppo = "vision-r-\(indice + 1)"
      righe.append(["id": gruppo, "testo": testo, "confidenza": Double(candidate.confidence),
                    "rettangolo": rettangolo(observation.boundingBox, pagina: unita)])
      for (n, match) in try parole(testo).enumerated() {
        guard elementi.count < maxElementi, let range = Range(match.range, in: testo) else { throw errore("LIMITE_ELEMENTI") }
        let box = try candidate.boundingBox(for: range)
        elementi.append(["id": "\(gruppo)-p-\(n + 1)", "testo": String(testo[range]),
                         "rettangolo": box.map { rettangolo($0.boundingBox, pagina: unita) } ?? NSNull(),
                         // Vision espone la confidenza della riga, non della singola parola.
                         "confidenza": NSNull(), "gruppo": gruppo])
      }
    }
    return (elementi, righe)
  }
}
