import { Injectable, HttpStatus } from '@nestjs/common';
import { driverLimitForBuses } from '../../../common/logic/driver-capacity.util';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Driver } from './entities/driver.entity';
import { Bus } from '../buses/entities/bus.entity';
import { AppException } from '../../../common/errors/app-exception';
import { checkDriverBusAssignment } from '../../../common/logic/invariants.util';
import { canDelete } from '../../../common/logic/delete-permission.util';

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver) private readonly driverRepo: Repository<Driver>,
    @InjectRepository(Bus) private readonly busRepo: Repository<Bus>,
    private readonly dataSource: DataSource,
  ) {}

  async create(operatorId: string, dto: any) {
    // Drivers are capped by fleet size: round(buses * 2.5).
    const busCount = await this.busRepo.count({ where: { operatorId } });
    const driverCount = await this.driverRepo.count({ where: { operatorId } });
    const driverLimit = driverLimitForBuses(busCount);
    if (driverCount >= driverLimit) {
      throw new AppException('DRIVER_LIMIT_REACHED', `Drivers are limited to ${driverLimit} for ${busCount} bus(es) (round of buses \u00d7 2.5). Add more buses to hire more drivers.`, HttpStatus.FORBIDDEN);
    }
    const exists = await this.driverRepo.findOne({ where: { licenseNumber: dto.licenseNumber } });
    if (exists) throw new AppException('LICENSE_TAKEN', 'This license number is already registered', HttpStatus.CONFLICT);
    return this.driverRepo.save(this.driverRepo.create({ ...dto, operatorId }));
  }

  listByOperator(operatorId: string, includeDeleted = false) { return this.driverRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' }, withDeleted: includeDeleted }); }

  async findById(id: string) {
    const d = await this.driverRepo.findOne({ where: { id } });
    if (!d) throw new AppException('DRIVER_NOT_FOUND', 'Driver not found', HttpStatus.NOT_FOUND);
    return d;
  }

  // 1:1 driver<->bus, same operator. Transaction-safe.
  async assignBus(operatorId: string, driverId: string, busId: string) {
    return this.dataSource.transaction(async (m) => {
      const driver = await m.getRepository(Driver).findOne({ where: { id: driverId } });
      const bus = await m.getRepository(Bus).findOne({ where: { id: busId } });
      if (!driver) throw new AppException('DRIVER_NOT_FOUND', 'Driver not found', HttpStatus.NOT_FOUND);
      if (!bus) throw new AppException('BUS_NOT_FOUND', 'Bus not found', HttpStatus.NOT_FOUND);
      if (driver.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'Driver does not belong to your operator', HttpStatus.FORBIDDEN);

      const check = checkDriverBusAssignment({
        driverOperatorId: driver.operatorId, busOperatorId: bus.operatorId,
        driverCurrentBusId: driver.busId, busCurrentDriverId: bus.driverId,
        requestedBusId: busId, driverId,
      });
      if (!check.ok) throw new AppException(check.code, check.message, HttpStatus.CONFLICT);

      driver.busId = busId; bus.driverId = driverId;
      await m.getRepository(Bus).save(bus);
      return m.getRepository(Driver).save(driver);
    });
  }

  async unassignBus(operatorId: string, driverId: string) {
    const driver = await this.findById(driverId);
    if (driver.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'Driver does not belong to your operator', HttpStatus.FORBIDDEN);
    if (driver.busId) {
      const bus = await this.busRepo.findOne({ where: { id: driver.busId } });
      if (bus) { bus.driverId = null; await this.busRepo.save(bus); }
    }
    driver.busId = null;
    return this.driverRepo.save(driver);
  }

  async update(operatorId: string, id: string, patch: { fullName?: string; phone?: string; licenseExpiry?: string; isActive?: boolean }) {
    const d = await this.findById(id);
    if (d.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'Driver does not belong to your operator', HttpStatus.FORBIDDEN);
    Object.assign(d, patch);
    return this.driverRepo.save(d);
  }

  async adminSoftDelete(role: string, id: string) {
    const perm = canDelete(role, 'DRIVER');
    if (!perm.ok) throw new AppException(perm.code!, 'Delete not allowed', HttpStatus.FORBIDDEN);
    await this.driverRepo.softDelete(id);
    return { id, deleted: true };
  }

  async softDelete(role: string, operatorId: string, id: string) {
    const perm = canDelete(role, 'DRIVER');
    if (!perm.ok) throw new AppException(perm.code!, 'Delete not allowed', HttpStatus.FORBIDDEN);
    const d = await this.findById(id);
    if (d.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'Driver does not belong to your operator', HttpStatus.FORBIDDEN);
    if (d.busId) throw new AppException('DRIVER_ON_DUTY', 'Unassign the driver from the bus before deleting', HttpStatus.CONFLICT);
    await this.driverRepo.softDelete(id);
    return { id, deleted: true };
  }
}