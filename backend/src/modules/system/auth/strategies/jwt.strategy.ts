import { Injectable, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../../customer/users/users.service';
import { AppException } from '../../../../common/errors/app-exception';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService, private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret'),
    });
  }
  async validate(payload: any) {
    // findByIdOrNull, NOT findById: findById throws 404, which would mask a revoked
    // credential as a missing resource and skip the 401 below entirely.
    const u = await this.users.findByIdOrNull(payload.sub);
    if (!u || !u.isActive) throw new AppException('ACCOUNT_INACTIVE', 'Account is inactive or invalid', HttpStatus.UNAUTHORIZED);
    // customRoleId comes from the DATABASE on every request, never from the token. A token
    // minted before the operator downgraded would otherwise keep granting Enterprise-only
    // powers until it expired — a plan they have stopped paying for, still working.
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      operatorId: u.operatorId,
      customRoleId: u.customRoleId ?? null,
    };
  }
}
