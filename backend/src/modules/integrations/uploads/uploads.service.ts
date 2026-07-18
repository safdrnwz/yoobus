import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { AppException } from '../../../common/errors/app-exception';

/** MIME types the platform accepts for uploads (images + PDF documents). */
export const ALLOWED_UPLOAD_MIME = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
];

export type UploadKind = 'bus-documents' | 'buses' | 'profiles' | 'operators' | 'misc';

/**
 * Central CDN upload service (Cloudinary). EVERY file/image upload in the app
 * goes through here — controllers receive a multipart file and hand the buffer
 * over; this service validates, uploads, and returns the CDN url.
 *
 * Configuration comes exclusively from CLOUDINARY_URL in .env
 * (cloudinary://<api_key>:<api_secret>@<cloud_name>). The secret is never in code.
 */
@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger('Uploads');
  private configured = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('cloudinary.url');
    if (!url) {
      this.logger.warn('CLOUDINARY_URL not set — file uploads are disabled until it is configured in .env');
      return;
    }
    try {
      // The SDK understands CLOUDINARY_URL natively; parse once and pin secure delivery.
      const u = new URL(url);
      cloudinary.config({
        cloud_name: u.hostname,
        api_key: decodeURIComponent(u.username),
        api_secret: decodeURIComponent(u.password),
        secure: true,
      });
      this.configured = true;
    } catch (e) {
      this.logger.error(`Invalid CLOUDINARY_URL: ${(e as Error).message}`);
    }
  }

  get isConfigured(): boolean { return this.configured; }

  /**
   * Validate + upload one file buffer. Returns { url, publicId, fileName, bytes, format }.
   * @param kind logical folder (bus-documents, buses, profiles, …) under the root folder
   */
  async upload(file: { buffer: Buffer; mimetype: string; originalname: string; size: number }, kind: UploadKind = 'misc'): Promise<{
    url: string; publicId: string; fileName: string; bytes: number; format: string | undefined;
  }> {
    if (!this.configured) {
      throw new AppException('UPLOADS_NOT_CONFIGURED', 'File uploads are not configured. Set CLOUDINARY_URL in the server .env.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!file?.buffer?.length) throw new AppException('EMPTY_FILE', 'No file received.', HttpStatus.BAD_REQUEST);
    if (!ALLOWED_UPLOAD_MIME.includes(file.mimetype)) {
      throw new AppException('UNSUPPORTED_FILE_TYPE', `Unsupported file type ${file.mimetype}. Allowed: ${ALLOWED_UPLOAD_MIME.join(', ')}`, HttpStatus.BAD_REQUEST);
    }
    const maxMb = this.config.get<number>('cloudinary.maxFileSizeMb') ?? 5;
    if (file.size > maxMb * 1024 * 1024) {
      throw new AppException('FILE_TOO_LARGE', `File exceeds the ${maxMb} MB limit.`, HttpStatus.BAD_REQUEST);
    }

    const folder = `${this.config.get<string>('cloudinary.folder') ?? 'yoobus'}/${kind}`;
    const isPdf = file.mimetype === 'application/pdf';

    const res: UploadApiResponse = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: isPdf ? 'raw' : 'image',
          use_filename: true,
          unique_filename: true,
          overwrite: false,
        },
        (err, result) => (err || !result ? reject(err ?? new Error('Empty upload result')) : resolve(result)),
      );
      stream.end(file.buffer);
    }).catch((e) => {
      this.logger.error(`Cloudinary upload failed: ${(e as Error).message}`);
      throw new AppException('UPLOAD_FAILED', 'File upload failed. Please try again.', HttpStatus.BAD_GATEWAY);
    }) as UploadApiResponse;

    return {
      url: res.secure_url,
      publicId: res.public_id,
      fileName: file.originalname,
      bytes: res.bytes,
      format: res.format,
    };
  }

  /** Delete an uploaded asset by its public id (cleanup on replace). */
  async remove(publicId: string, isPdf = false): Promise<void> {
    if (!this.configured || !publicId) return;
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: isPdf ? 'raw' : 'image' });
    } catch (e) {
      this.logger.warn(`Cloudinary delete failed for ${publicId}: ${(e as Error).message}`);
    }
  }
}
