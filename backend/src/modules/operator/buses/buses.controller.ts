import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { resolveOperatorScope } from '../../../common/logic/operator-scope.util';
import { Body, Controller, Delete, Get, Param, Patch, Post, HttpStatus, Query, Put } from '@nestjs/common';
import { BusesService } from './buses.service';
import { CreateBusDto , LadiesReservedDto, SeatAdjacencyDto, UpdateBusDto, SetSeatFaresDto, AdjustSeatFaresDto} from './dto/create-bus.dto';
import { MapRouteDto } from './dto/map-route.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';
import { AppException } from '../../../common/errors/app-exception';
import { InjectRepository } from '@nestjs/typeorm';
import { Operator } from '../operators/entities/operator.entity';
import { Repository } from 'typeorm';
import { PLATFORM_DEFAULTS } from '../../../common/config/platform-defaults';

@Controller('buses')
export class BusesController {
  constructor(
    private readonly buses: BusesService,
    @InjectRepository(Operator) private readonly opRepo: Repository<Operator>,
  ) {}

  @Roles(Role.OPERATOR_ADMIN) @Post()
  async create(@CurrentUser() u: JwtUser, @Body() dto: CreateBusDto) {
    if (!u.operatorId) throw new AppException('NO_OPERATOR_CONTEXT', 'Operator context is missing', HttpStatus.FORBIDDEN);
    const op = await this.opRepo.findOne({ where: { id: u.operatorId } });
    return this.buses.create(u.operatorId, Number(op?.setupFeePerBus ?? PLATFORM_DEFAULTS.PAYMENT.setupFeePerBus), dto);
  }

  @Roles(Role.OPERATOR_ADMIN, Role.SUPPORT, Role.ACCOUNTANT) @Get()
  list(@CurrentUser() u: JwtUser, @Query('operatorId') scopeOp?: string) { return this.buses.listByOperator(resolveOperatorScope(u, scopeOp)); }

  /**
   * Per-seat pricing. Every seat on a trip used to cost the same — a lower berth and the
   * back row were priced identically, which is not how anyone actually sells a bus.
   */
  @RequirePermission('CONFIGURE_DYNAMIC_PRICING') @Roles(Role.OPERATOR_ADMIN) @Put(':id/seat-fares')
  setSeatFares(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: SetSeatFaresDto) {
    return this.buses.setSeatFares(u.operatorId!, id, dto.fares);
  }

  /** "Put everything up 5%", or just the front half, or just the back row. */
  @RequirePermission('CONFIGURE_DYNAMIC_PRICING') @Roles(Role.OPERATOR_ADMIN) @Patch(':id/seat-fares/adjust')
  adjustSeatFares(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: AdjustSeatFaresDto) {
    return this.buses.adjustSeatFares(u.operatorId!, id, dto);
  }

  @Roles(Role.OPERATOR_ADMIN) @Patch(':id/route')
  mapRoute(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: MapRouteDto) {
    return this.buses.mapRoute(u.operatorId!, id, dto.routeId);
  }

  @Roles(Role.OPERATOR_ADMIN) @Patch(':id')
  update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() patch: UpdateBusDto) { return this.buses.update(u.operatorId!, id, patch); }

  @Roles(Role.OPERATOR_ADMIN) @Patch(':id/deactivate')
  deactivate(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.buses.setActive(u.operatorId!, id, false); }

  @Roles(Role.OPERATOR_ADMIN) @Patch(':id/activate')
  activate(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.buses.setActive(u.operatorId!, id, true); }

  // Requirement 8 — configure ladies-reserved seats for this bus.
  @Roles(Role.OPERATOR_ADMIN) @Patch(':id/ladies-reserved')
  configureLadiesReserved(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: LadiesReservedDto) {
    return this.buses.configureLadiesReserved(u.operatorId!, id, dto.seatNumbers);
  }

  // Requirement 10 — configure paired-seat adjacency for gender validation.
  @Roles(Role.OPERATOR_ADMIN) @Patch(':id/seat-adjacency')
  setSeatAdjacency(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: SeatAdjacencyDto) {
    return this.buses.setSeatAdjacency(u.operatorId!, id, dto.pairs);
  }

  @Roles(Role.OPERATOR_ADMIN) @Get(':id/seat-config')
  getSeatConfig(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.buses.getSeatConfig(u.operatorId!, id); }

  @Roles(Role.OPERATOR_ADMIN) @Delete(':id')
  remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.buses.softDelete(u.role, u.operatorId!, id); }
}
