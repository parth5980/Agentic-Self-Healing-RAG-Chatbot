import multer from "multer";

// Files only need to pass through to backend-ai — we never write them to
// our own disk, so memoryStorage is enough. Adjust fileSize if you expect
// larger PDFs.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

export default upload;
