import { Controller, HttpStatus, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService, UploadKind } from './uploads.service';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { AppException } from '../../../common/errors/app-exception';

const KINDS: UploadKind[] = ['bus-documents', 'buses', 'profiles', 'operators', 'misc'];

/**
 * Generic authenticated upload endpoint. The whole app uploads through here
 * (or through purpose-specific endpoints that delegate to UploadsService) and
 * stores only the returned CDN url — never raw files on the API server.
 *
 * POST /uploads?kind=bus-documents   (multipart field name: "file")
 */
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Roles(Role.OPERATOR_ADMIN, Role.SUPPORT, Role.ACCOUNTANT, Role.SUPERADMIN, Role.CUSTOMER)
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File, @Query('kind') kind?: string) {
    if (!file) throw new AppException('NO_FILE', 'Send the file in a multipart field named "file".', HttpStatus.BAD_REQUEST);
    const k = (KINDS as string[]).includes(kind ?? '') ? (kind as UploadKind) : 'misc';
    return this.uploads.upload(file, k);
  }
}
