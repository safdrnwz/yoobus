import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { Role } from '../../../common/enums/role.enum';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GRID,
  ITEM_SIZE,
  BOOKABLE_KINDS,
  ROTATIONS,
} from '../../../common/logic/seat-layout.util';
import { AssignLayoutDto, CloneLayoutDto, CreateLayoutDto, UpdateLayoutDto } from './dto/seat-layout.dto';
import { SeatLayoutsService } from './seat-layouts.service';

/**
 * The seat layout builder.
 *
 * An operator draws the inside of a bus once, publishes it, and points as many buses at it as
 * they like. Before this, a bus carried a flat list of seat numbers and nothing else: no idea
 * where a seat physically sat, so no seat map worth looking at, no sleeper berths, no upper
 * deck, and adjacency typed in by hand pair by pair.
 */
@Roles(Role.OPERATOR_ADMIN)
@Controller('seat-layouts')
export class SeatLayoutsController {
  constructor(private readonly layouts: SeatLayoutsService) {}

  /**
   * Everything the builder needs to draw itself: the canvas, the grid, the catalogue of
   * things that can be placed, and how big each one is.
   *
   * Public because it is a description of the tool, not of anyone's data — and because the
   * frontend must NEVER hardcode 320x800. Add a component here and the toolbox grows on its
   * own, which is the "no code changes for a new bus type" promise made good.
   */
  @Get('catalogue')
  catalogue() {
    return {
      canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, grid: GRID },
      rotations: ROTATIONS,
      bookableKinds: BOOKABLE_KINDS,
      items: Object.entries(ITEM_SIZE).map(([kind, size]) => ({
        kind,
        ...size,
        bookable: (BOOKABLE_KINDS as string[]).includes(kind),
      })),
      genders: ['ANY', 'FEMALE_ONLY', 'MALE_ONLY'],
      fareZones: ['PREMIUM', 'STANDARD', 'ECONOMY', 'LAST_ROW', 'LADIES', 'LUXURY'],
      decks: ['LOWER', 'UPPER'],
    };
  }

  @RequirePermission('VIEW_BUS') @Get()
  list(@CurrentUser() u: JwtUser) {
    return this.layouts.list(u.operatorId!);
  }

  @RequirePermission('VIEW_BUS') @Get(':id')
  get(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.layouts.get(u.operatorId!, id);
  }

  /** Every version of this layout — which bus is on which is the operator's to decide. */
  @RequirePermission('VIEW_BUS') @Get('family/:familyId/versions')
  versions(@CurrentUser() u: JwtUser, @Param('familyId') familyId: string) {
    return this.layouts.versions(u.operatorId!, familyId);
  }

  @RequirePermission('CREATE_BUS') @Post()
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateLayoutDto) {
    return this.layouts.create(u.operatorId!, u.id, dto as never);
  }

  /** Drafts only. A published layout is frozen — clone it to change it. */
  @RequirePermission('EDIT_BUS') @Patch(':id')
  update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateLayoutDto) {
    return this.layouts.update(u.operatorId!, id, dto as never);
  }

  /** A dry run. The builder calls this as the operator draws, so problems surface immediately. */
  @RequirePermission('VIEW_BUS') @Post(':id/validate')
  validate(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.layouts.validate(u.operatorId!, id);
  }

  @RequirePermission('EDIT_BUS') @Post(':id/publish')
  publish(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.layouts.publish(u.operatorId!, id);
  }

  @RequirePermission('CREATE_BUS') @Post(':id/clone')
  clone(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: CloneLayoutDto) {
    return dto.asNewFamily
      ? this.layouts.duplicateAsNew(u.operatorId!, u.id, id, dto.name ?? 'Copy')
      : this.layouts.clone(u.operatorId!, u.id, id, dto.name);
  }

  @RequirePermission('EDIT_BUS') @Delete(':id')
  archive(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.layouts.archive(u.operatorId!, id);
  }

  /**
   * Point a bus at this layout.
   *
   * This is where the drawing becomes the flat seat data the booking engine has always run
   * on — seatMap, ladiesReservedSeats, seatAdjacency are all regenerated from it. The booking
   * engine never learns a builder exists.
   */
  @RequirePermission('EDIT_BUS') @Post('assign/:busId')
  assign(@CurrentUser() u: JwtUser, @Param('busId') busId: string, @Body() dto: AssignLayoutDto) {
    return this.layouts.assignToBus(u.operatorId!, busId, dto.templateId);
  }
}
