import { Body, Controller, Get, Post, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateStaffDto, CreatePlatformStaffDto } from './dto/create-staff.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';
import { AppException } from '../../../common/errors/app-exception';
import { InjectRepository } from '@nestjs/typeorm';
import { Operator } from '../../operator/operators/entities/operator.entity';
import { Repository } from 'typeorm';

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    @InjectRepository(Operator) private readonly opRepo: Repository<Operator>,
  ) {}

  // The operator admin creates staff within their own operator.
  @Roles(Role.OPERATOR_ADMIN)
  @Post('staff')
  async createStaff(@CurrentUser() actor: JwtUser, @Body() dto: CreateStaffDto) {
    if (!actor.operatorId) throw new AppException('NO_OPERATOR_CONTEXT', 'Operator context is missing', HttpStatus.FORBIDDEN);
    const op = await this.opRepo.findOne({ where: { id: actor.operatorId } });
    const { user, tempPassword } = await this.users.createStaff(actor.operatorId, op?.brandName || op?.legalName || 'Operator', dto);
    return { id: user.id, email: user.email, role: user.role, tempPassword };
  }

  @Roles(Role.OPERATOR_ADMIN)
  @Get('staff')
  listStaff(@CurrentUser() actor: JwtUser) {
    return this.users.listStaff(actor.operatorId!);
  }

  /**
   * Yoo Bus's OWN team — Accountant and Platform Support. Only the SuperAdmin may create
   * them, and only those two roles (see PLATFORM_CREATABLE_ROLES), so this endpoint can
   * never be used to mint a second SuperAdmin.
   */
  @Roles(Role.SUPERADMIN)
  @Post('platform-staff')
  async createPlatformStaff(@Body() dto: CreatePlatformStaffDto) {
    const { user, tempPassword } = await this.users.createPlatformStaff(dto);
    return { id: user.id, email: user.email, role: user.role, operatorId: user.operatorId, tempPassword };
  }

  @Roles(Role.SUPERADMIN)
  @Get('platform-staff')
  listPlatformStaff() {
    return this.users.listPlatformStaff();
  }
}
