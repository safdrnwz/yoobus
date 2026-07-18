import { IsString, MinLength } from 'class-validator';
export class LoginDto {
  /**
   * Accepts either a registered email address (user@example.com)
   * or the 10-digit mobile number used at registration.
   */
  @IsString() @MinLength(6) identifier: string;
  @IsString() @MinLength(8) password: string;
}
