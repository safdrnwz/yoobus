import { HttpStatus } from '@nestjs/common';
import { AppException } from '../errors/app-exception';
import { isPlatformRole, Role } from '../enums/role.enum';

/**
 * Decide WHICH operator's data a request is allowed to touch.
 *
 * There are exactly two kinds of caller, and they must be treated differently:
 *
 *  - Operator staff (OPERATOR_ADMIN / SUPPORT / DRIVER) carry an operatorId in their token.
 *    They may only ever see their own operator. If they ask for someone else's, that is an
 *    isolation breach and we refuse — we do not quietly fall back to their own.
 *
 *  - Platform staff (SUPERADMIN / ACCOUNTANT / PLATFORM_SUPPORT) carry operatorId = null.
 *    They sit above every operator, so they have no implicit scope: they MUST say which
 *    operator they mean. Asking a platform accountant's token for `.operatorId!` yields
 *    null, and every downstream query then either crashes or silently reads nothing —
 *    which is exactly the bug this helper exists to make impossible.
 *
 * Use this anywhere a handler needs "the operator this request is about".
 */
export function resolveOperatorScope(
  user: { role: Role | string; operatorId?: string | null },
  requested?: string | null,
): string {
  const role = user.role as Role;

  if (isPlatformRole(role)) {
    if (!requested) {
      throw new AppException(
        'OPERATOR_ID_REQUIRED',
        'Platform staff are not scoped to one operator. Say which one: add ?operatorId=<id>.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return requested;
  }

  if (!user.operatorId) {
    throw new AppException(
      'NO_OPERATOR_CONTEXT',
      'This account is not attached to any operator.',
      HttpStatus.FORBIDDEN,
    );
  }

  if (requested && requested !== user.operatorId) {
    throw new AppException(
      'CROSS_OPERATOR_FORBIDDEN',
      "You may only access your own operator's data.",
      HttpStatus.FORBIDDEN,
    );
  }

  return user.operatorId;
}
