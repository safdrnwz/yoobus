import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

/** Declarative permission gate. The user must hold every listed permission. */
export const RequirePermission = (...permissions: string[]) => SetMetadata(REQUIRE_PERMISSION_KEY, permissions);
