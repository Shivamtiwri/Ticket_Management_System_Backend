import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary, UploadApiErrorResponse, UploadApiResponse } from 'cloudinary';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880');
const ALLOWED_TYPES = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,application/pdf').split(',');
const UPLOAD_TIMEOUT_MS = 60_000;

export const validateCloudinaryConfig = (): void => {
  const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Cloudinary is not configured. Set: ${missing.join(', ')}.`);
  }
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: UPLOAD_TIMEOUT_MS,
});

interface StoredCloudinaryUpload extends Express.Multer.File {
  cloudinaryResourceType: UploadApiResponse['resource_type'];
}

const storage: multer.StorageEngine = {
  _handleFile(_req, file, callback) {
    const publicId = uuidv4();
    let completed = false;
    const finish = (error?: Error | null, info?: Partial<StoredCloudinaryUpload>) => {
      if (completed) return;
      completed = true;
      clearTimeout(timeout);
      callback(error, info);
    };

    const timeout = setTimeout(() => {
      uploadStream.destroy(new Error('Cloudinary upload timed out.'));
      finish(new AppError('Cloudinary upload timed out. Please try again.', 504));
    }, UPLOAD_TIMEOUT_MS);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: process.env.CLOUDINARY_FOLDER || undefined,
        resource_type: 'auto',
        timeout: UPLOAD_TIMEOUT_MS,
      },
      (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
        if (error || !result) {
          logger.error('Cloudinary file upload failed', {
            publicId,
            message: error?.message ?? 'No upload result returned',
            http_code: error?.http_code,
          });
          const isTimeout = error?.name === 'TimeoutError' || /timed?\s*out|timeout/i.test(error?.message ?? '');
          finish(new AppError(
            isTimeout
              ? 'Cloudinary upload timed out. Please try again.'
              : 'Failed to upload attachment to Cloudinary. Please try again.',
            isTimeout ? 504 : 502
          ));
          return;
        }

        finish(null, {
          destination: 'cloudinary',
          filename: result.public_id,
          path: result.secure_url,
          size: result.bytes,
          cloudinaryResourceType: result.resource_type,
        });
      }
    );

    file.stream.on('error', (error) => finish(error));
    file.stream.pipe(uploadStream);
  },

  _removeFile(_req, file, callback) {
    const stored = file as StoredCloudinaryUpload;
    void cloudinary.uploader.destroy(stored.filename, {
      resource_type: stored.cloudinaryResourceType || 'image',
    }).then(() => callback(null)).catch((error: unknown) => {
      logger.error('Failed to remove Cloudinary upload after a multipart request failed', {
        publicId: stored.filename,
        error: error instanceof Error ? error.message : String(error),
      });
      callback(error instanceof Error ? error : new Error(String(error)));
    });
  },
};

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
