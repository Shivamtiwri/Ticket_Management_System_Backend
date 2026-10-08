import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from './errorHandler';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880');
const ALLOWED_TYPES = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,application/pdf').split(',');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
};

const safeExtension = (file: Express.Multer.File): string => {
  const mapped = EXT_BY_MIME[file.mimetype];
  if (mapped) return mapped;
  const ext = path.extname(file.originalname).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '';
};

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(_req, file, cb) {
    const uniqueName = `${uuidv4()}${safeExtension(file)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`File type ${file.mimetype} is not allowed. Allowed types: ${ALLOWED_TYPES.join(', ')}`, 400));
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 5 },
  fileFilter,
});

export const uploadFiles = upload.array('attachments', 5);
export const uploadSingle = upload.single('file');
