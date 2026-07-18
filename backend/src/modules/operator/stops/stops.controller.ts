import { Body, Controller, Get, Post } from '@nestjs/common';
import { StopsService } from './stops.service';
import { CreateStopDto } from './dto/create-stop.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';

@Controller('stops')
export class StopsController {
  constructor(private readonly stops: StopsService) {}
  @Roles(Role.SUPERADMIN, Role.OPERATOR_ADMIN) @Post() create(@Body() dto: CreateStopDto) { return this.stops.create(dto); }
  @Get() all() { return this.stops.findAll(); }
}
