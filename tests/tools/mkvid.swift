// Writes a 3-second 1280x720 test video with AVFoundation, the way an iPhone records: mkvid <out.mp4|out.mov> <h264|hevc>
import AVFoundation
import CoreVideo
let args = CommandLine.arguments
let out = URL(fileURLWithPath: args[1]), codec = args[2] == "hevc" ? AVVideoCodecType.hevc : AVVideoCodecType.h264
let type: AVFileType = out.pathExtension == "mov" ? .mov : .mp4
try? FileManager.default.removeItem(at: out)
let w = try! AVAssetWriter(outputURL: out, fileType: type)
let W = 1280, H = 720
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: codec, AVVideoWidthKey: W, AVVideoHeightKey: H])
let ad = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H])
w.add(input); w.startWriting(); w.startSession(atSourceTime: .zero)
for f in 0..<90 {
  while !input.isReadyForMoreMediaData { usleep(1000) }
  var pb: CVPixelBuffer?; CVPixelBufferPoolCreatePixelBuffer(nil, ad.pixelBufferPool!, &pb)
  CVPixelBufferLockBaseAddress(pb!, [])
  let base = CVPixelBufferGetBaseAddress(pb!)!.assumingMemoryBound(to: UInt8.self), rb = CVPixelBufferGetBytesPerRow(pb!)
  for y in 0..<H { for x in 0..<W { let o = y * rb + x * 4; base[o] = UInt8((x + f * 8) % 256); base[o+1] = UInt8(y % 256); base[o+2] = UInt8(f * 2 % 256); base[o+3] = 255 } }
  CVPixelBufferUnlockBaseAddress(pb!, [])
  ad.append(pb!, withPresentationTime: CMTime(value: CMTimeValue(f), timescale: 30))
}
input.markAsFinished()
let sem = DispatchSemaphore(value: 0); w.finishWriting { sem.signal() }; sem.wait()
print(args[1], w.status == .completed ? "ok" : "FAILED \(String(describing: w.error))")
