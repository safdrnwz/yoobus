import { Body, Controller, Post } from '@nestjs/common';
import { OtpService } from './otp.service';
import { RequestOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { Public } from '../../../common/decorators/public.decorator';
@Controller('otp')
export class OtpController {
  constructor(private readonly otp: OtpService) {}
  @Public() @Post('request') request(@Body() dto: RequestOtpDto) { return this.otp.request(dto); }
  @Public() @Post('verify') verify(@Body() dto: VerifyOtpDto) { return this.otp.verify(dto); }
}
