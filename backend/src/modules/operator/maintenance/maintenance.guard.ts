import { CanActivate, ExecutionContext, Injectable, HttpStatus } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { AppException } from '../../../common/errors/app-exception';
import { isActive, isWriteBlockedDuringMaintenance } from '../../../common/logic/maintenance.util';

/**
 * Blocks operator-side write operations while a maintenance window is active.
 * Passenger booking/payment/OTP/auth flows, all GETs, and SuperAdmin actions pass.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly maintenance: MaintenanceService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return true;

    const win = await this.maintenance.getActiveWindowCached();
    if (!win || !isActive(Date.now(), win.startAt.getTime(), win.endAt.getTime())) return true;

    const role: string | undefined = req.user?.role;
    const path: string = req.originalUrl ?? req.url ?? '';
    if (isWriteBlockedDuringMaintenance(method, path, role)) {
      throw new AppException(
        'MAINTENANCE_MODE',
        `Platform is under maintenance until ${win.endAt.toISOString()}. Changes are temporarily disabled; bookings continue as usual.`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return true;
  }
}
