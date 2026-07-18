import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export interface JwtUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  operatorId: string | null; // null = platform/superadmin/passenger

  /**
   * A custom role, if their operator is on Enterprise and put them on one.
   *
   * Resolved on every request from the DATABASE, not from the token. A token minted before an
   * operator downgraded would otherwise keep granting Enterprise-only powers until it expired
   * — which is a plan you have stopped paying for, still working.
   */
  customRoleId?: string | null;
}
export const CurrentUser = createParamDecorator(
  (data: keyof JwtUser | undefined, ctx: ExecutionContext) => {
    const u = ctx.switchToHttp().getRequest().user as JwtUser;
    return data ? u?.[data] : u;
  },
);
