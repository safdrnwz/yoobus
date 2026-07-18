import { resolveOperatorScope } from '../../../common/logic/operator-scope.util';
import { Body, Controller, Get, Param, Patch, Post, Res, HttpStatus, Query } from '@nestjs/common';
import { Response } from 'express';
import { BookingsService } from './bookings.service';
import { PdfService } from './pdf.service';
import { TripsService } from '../../operator/trips/trips.service';
import { HoldDto } from './dto/hold.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto, PartialCancelDto } from './dto/cancel-booking.dto';
import { RescheduleDto } from './dto/reschedule.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { assertResourceOwner } from '../../../common/logic/access.util';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';
import { AppException } from '../../../common/errors/app-exception';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly pdf: PdfService,
    private readonly trips: TripsService,
  ) {}

  // PUBLIC: seat hold (select+next) — TTL block
  /**
   * Hold a seat.
   *
   * This was @Public(), and it should never have been.
   *
   * A hold LOCKS INVENTORY. Public means an anonymous caller — no account, no token, nothing to
   * rate-limit against, nothing to ban — can hold every seat on every bus on the network and
   * simply never pay. It is free denial-of-inventory, and the operator would watch their buses
   * show "sold out" while running empty.
   *
   * Guests may look: search is public, the seat map is public, the fares are public. That is
   * the whole funnel and it stays open. But the moment inventory is taken out of circulation,
   * we need to know who took it — which is exactly where the spec draws the line too:
   * "Without login users cannot: Book."
   *
   * Counter staff hold seats on a walk-in passenger's behalf, so they are here as well.
   */
  @Roles(Role.CUSTOMER, Role.OPERATOR_ADMIN, Role.SUPPORT)
  @Post('hold')
  hold(@Body() dto: HoldDto) {
    return this.bookings.hold(dto);
  }

  // USER (OTP/login ke baad): hold se PENDING booking
  @Roles(Role.CUSTOMER) @Post() create(@CurrentUser('id') userId: string, @Body() dto: CreateBookingDto) {
    return this.bookings.createFromHold(userId, dto);
  }

  @Roles(Role.CUSTOMER) @Get('my') my(@CurrentUser('id') userId: string) { return this.bookings.findByUser(userId); }
  @Roles(Role.CUSTOMER, Role.OPERATOR_ADMIN, Role.PLATFORM_SUPPORT, Role.SUPPORT, Role.SUPERADMIN) @Get(':id/detail') detail(@Param('id') id: string) { return this.bookings.bookingDetail(id); }
  @Roles(Role.OPERATOR_ADMIN, Role.PLATFORM_SUPPORT, Role.SUPPORT, Role.ACCOUNTANT) @Get() list(@CurrentUser() u: JwtUser, @Query('operatorId') scopeOp?: string) { return this.bookings.listByOperator(resolveOperatorScope(u, scopeOp)); }
  @Roles(Role.CUSTOMER, Role.OPERATOR_ADMIN, Role.PLATFORM_SUPPORT, Role.SUPPORT, Role.SUPERADMIN) @Get('pnr/:pnr') byPnr(@Param('pnr') pnr: string) { return this.bookings.findByPnr(pnr); }

  @Roles(Role.CUSTOMER, Role.OPERATOR_ADMIN, Role.PLATFORM_SUPPORT, Role.SUPPORT, Role.SUPERADMIN) @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() u: JwtUser, @Body() dto: CancelBookingDto) {
    return this.bookings.cancel(id, { id: u.id, role: u.role as Role, operatorId: u.operatorId }, dto.reason, dto.refundToWallet ?? false);
  }

  @Roles(Role.CUSTOMER, Role.OPERATOR_ADMIN, Role.PLATFORM_SUPPORT, Role.SUPPORT, Role.SUPERADMIN) @Patch(':id/cancel-seats')
  cancelSeats(@Param('id') id: string, @CurrentUser() u: JwtUser, @Body() dto: PartialCancelDto) {
    return this.bookings.partialCancel(id, { id: u.id, role: u.role as Role, operatorId: u.operatorId }, dto.seatNumbers, dto.reason, dto.refundToWallet ?? false);
  }

  @Roles(Role.CUSTOMER, Role.PLATFORM_SUPPORT, Role.SUPPORT) @Patch(':id/reschedule')
  reschedule(@Param('id') id: string, @CurrentUser() u: JwtUser, @Body() dto: RescheduleDto) {
    return this.bookings.reschedule(id, { id: u.id, role: u.role as Role }, dto.newTripId);
  }

  // PDF ticket (owner ya staff)
  @Roles(Role.CUSTOMER, Role.OPERATOR_ADMIN, Role.PLATFORM_SUPPORT, Role.SUPPORT) @Get(':id/ticket.pdf')
  async ticket(@Param('id') id: string, @CurrentUser() u: JwtUser, @Res() res: Response) {
    const booking = await this.bookings.findById(id);
    const owner = assertResourceOwner(u.role, u.id, booking.userId);
    if (!owner.ok) throw new AppException(owner.code!, owner.message!, HttpStatus.FORBIDDEN);
    const { trip, route } = await this.trips.findFull(booking.tripId);
    const from = route.routeStops.find((r: any) => r.stopId === booking.boardingStopId)?.stop?.name || '';
    const to = route.routeStops.find((r: any) => r.stopId === booking.droppingStopId)?.stop?.name || '';
    const buf = await this.pdf.ticket({
      pnr: booking.pnr, operatorName: 'Operator', from, to, date: trip.departureDate, time: trip.departureTime,
      seats: booking.seats.map((s) => ({ seatNumber: s.seatNumber, passengerName: s.passengerName })),
      baseFare: Number(booking.baseFare), fareGst: Number(booking.fareGst), payable: Number(booking.payableByPassenger),
    });
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="ticket-${booking.pnr}.pdf"` });
    res.send(buf);
  }
}
