import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateCustomRoleDto {
  /** What the operator calls it — "Counter Clerk", "Night Shift Supervisor". */
  @IsString() @IsNotEmpty() @MinLength(2) @MaxLength(60) name: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;

  /**
   * The permissions it grants.
   *
   * Every key is checked against the catalogue AND against what an OPERATOR_ADMIN already
   * holds. An operator cannot invent a role that reaches the platform — custom roles subdivide
   * authority, they never manufacture it.
   */
  @IsArray() @ArrayMaxSize(400) @IsString({ each: true }) permissions: string[];
}

export class UpdateCustomRoleDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) name?: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(400) @IsString({ each: true }) permissions?: string[];
}

export class AssignCustomRoleDto {
  @IsUUID() userId: string;
  /** null takes them off the custom role and back to their base role. */
  @IsOptional() @IsUUID() roleId?: string | null;
}
