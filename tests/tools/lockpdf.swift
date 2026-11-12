// Writes a password-protected copy of a PDF with PDFKit: lockpdf <in.pdf> <out.pdf> <password>
import PDFKit
let a = CommandLine.arguments
guard let doc = PDFDocument(url: URL(fileURLWithPath: a[1])) else { print("cannot read"); exit(1) }
let ok = doc.write(to: URL(fileURLWithPath: a[2]), withOptions: [.userPasswordOption: a[3], .ownerPasswordOption: a[3] + "-owner"])
print(ok ? "ok" : "FAILED"); exit(ok ? 0 : 1)
