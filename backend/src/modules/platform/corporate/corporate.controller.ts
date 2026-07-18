import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CorporateService } from './corporate.service';
import { AddEmployeeDto, CreateCorporateDto } from './dto/corporate.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';

/** Corporate B2B administration (platform-managed). */
@Roles(Role.SUPERADMIN, Role.ACCOUNTANT)
@Controller('corporate')
export class CorporateController {
  constructor(private readonly corporate: CorporateService) {}

  @Post() create(@Body() dto: CreateCorporateDto) { return this.corporate.create(dto); }
  @Get() list() { return this.corporate.list(); }
  @Post(':id/employees') addEmployee(@Param('id') id: string, @Body() dto: AddEmployeeDto) { return this.corporate.addEmployee(id, dto); }
  @Get(':id/employees') employees(@Param('id') id: string) { return this.corporate.listEmployees(id); }
  @Get(':id/statement') statement(@Param('id') id: string, @Query('month') month?: string) { return this.corporate.monthlyStatement(id, month); }
}
