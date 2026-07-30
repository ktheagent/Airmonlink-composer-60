# Import, Export and Publishing Guide

Build 40 supports the established `.airscore`, MusicXML/MXL, MIDI, PDF, images and WAV paths represented by the engine and publishing services.

`.airscore` preserves stable IDs, score semantics, lyrics, Sol-fa settings, parts, layout, mixer, metadata and view state. Integrity validation rejects damaged content. Newer schemas are flagged for read-only handling. Older migrations require a backup plan.

Publishing plans support score/part selection, page ranges, copies, deterministic filenames, PDF metadata, watermarks and transactional rollback. MusicXML and MIDI cannot represent every private layout or plugin field; those remain preserved in `.airscore`.

Build 40 Windows executables have not yet been produced.
