import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance, Employee, LeaveRequest, Shift } from './entities/crew.entities';
import { CheckInDto, CreateEmployeeDto, CreateShiftDto, LeaveDto } from './dto/crew.dto';
import { AppException } from '../../../common/errors/app-exception';
import { attendanceStatus, leaveConflicts, rosterConflicts } from '../../../common/logic/crew-hr.util';

/** Operator crew & HR: employees, shifts (with roster-conflict checks), attendance, leave. */
@Injectable()
export class CrewHrService {
  constructor(
    @InjectRepository(Employee) private readonly empRepo: Repository<Employee>,
    @InjectRepository(Shift) private readonly shiftRepo: Repository<Shift>,
    @InjectRepository(Attendance) private readonly attRepo: Repository<Attendance>,
    @InjectRepository(LeaveRequest) private readonly leaveRepo: Repository<LeaveRequest>,
  ) {}

  // Employees
  createEmployee(operatorId: string, dto: CreateEmployeeDto): Promise<Employee> {
    return this.empRepo.save(this.empRepo.create({ operatorId, ...dto }));
  }
  listEmployees(operatorId: string): Promise<Employee[]> {
    return this.empRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' } });
  }

  // Shifts (roster) — block double-booking a crew member into overlapping shifts.
  async createShift(operatorId: string, dto: CreateShiftDto): Promise<Shift> {
    const newRange = { start: Date.parse(dto.startAt), end: Date.parse(dto.endAt) };
    if (newRange.end <= newRange.start) throw new AppException('SHIFT_BAD_RANGE', 'Shift end must be after start.', HttpStatus.BAD_REQUEST);
    if (dto.employeeId) {
      const existing = await this.shiftRepo.find({ where: { operatorId, employeeId: dto.employeeId } });
      const ranges = existing.map((s) => ({ start: s.startAt.getTime(), end: s.endAt.getTime() }));
      if (rosterConflicts(ranges, newRange)) throw new AppException('ROSTER_CONFLICT', 'This crew member is already rostered onto an overlapping shift.', HttpStatus.CONFLICT);
    }
    return this.shiftRepo.save(this.shiftRepo.create({ operatorId, name: dto.name, startAt: new Date(dto.startAt), endAt: new Date(dto.endAt), employeeId: dto.employeeId ?? null }));
  }
  listShifts(operatorId: string): Promise<Shift[]> {
    return this.shiftRepo.find({ where: { operatorId }, order: { startAt: 'DESC' } });
  }

  // Attendance
  recordAttendance(operatorId: string, dto: CheckInDto): Promise<Attendance> {
    const checkInMs = dto.checkIn ? Date.parse(dto.checkIn) : null;
    const status = attendanceStatus(Date.parse(dto.shiftStart), checkInMs);
    return this.attRepo.save(this.attRepo.create({
      operatorId, employeeId: dto.employeeId, date: new Date(dto.shiftStart).toISOString().slice(0, 10),
      checkIn: checkInMs ? new Date(checkInMs) : null, status,
    }));
  }
  listAttendance(operatorId: string): Promise<Attendance[]> {
    return this.attRepo.find({ where: { operatorId }, order: { date: 'DESC' } });
  }

  // Leave
  async requestLeave(operatorId: string, dto: LeaveDto): Promise<LeaveRequest> {
    const requested = { start: Date.parse(dto.fromAt), end: Date.parse(dto.toAt) };
    if (requested.end < requested.start) throw new AppException('LEAVE_BAD_RANGE', 'Leave end must be on or after start.', HttpStatus.BAD_REQUEST);
    const approved = await this.leaveRepo.find({ where: { operatorId, employeeId: dto.employeeId, status: 'APPROVED' } });
    const ranges = approved.map((l) => ({ start: l.fromAt.getTime(), end: l.toAt.getTime() }));
    if (leaveConflicts(ranges, requested)) throw new AppException('LEAVE_CONFLICT', 'This leave overlaps an already approved leave.', HttpStatus.CONFLICT);
    return this.leaveRepo.save(this.leaveRepo.create({ operatorId, employeeId: dto.employeeId, fromAt: new Date(dto.fromAt), toAt: new Date(dto.toAt), reason: dto.reason ?? null, status: 'PENDING' }));
  }
  async decideLeave(operatorId: string, id: string, approve: boolean): Promise<LeaveRequest> {
    const l = await this.leaveRepo.findOne({ where: { id } });
    if (!l || l.operatorId !== operatorId) throw new AppException('LEAVE_NOT_FOUND', 'Leave request not found.', HttpStatus.NOT_FOUND);
    if (l.status !== 'PENDING') throw new AppException('LEAVE_DECIDED', 'This leave request has already been decided.', HttpStatus.BAD_REQUEST);
    l.status = approve ? 'APPROVED' : 'REJECTED';
    return this.leaveRepo.save(l);
  }
  listLeave(operatorId: string): Promise<LeaveRequest[]> {
    return this.leaveRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' } });
  }
}
