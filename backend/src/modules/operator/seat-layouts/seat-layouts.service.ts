import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AppException } from '../../../common/errors/app-exception';
import {
  deriveBusSeating,
  LayoutDefinition,
  validateLayout,
} from '../../../common/logic/seat-layout.util';
import { Bus } from '../buses/entities/bus.entity';
import { SeatLayoutTemplate } from './entities/seat-layout-template.entity';

@Injectable()
export class SeatLayoutsService {
  constructor(
    @InjectRepository(SeatLayoutTemplate) private readonly repo: Repository<SeatLayoutTemplate>,
    @InjectRepository(Bus) private readonly buses: Repository<Bus>,
  ) {}

  private async mine(operatorId: string, id: string): Promise<SeatLayoutTemplate> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new AppException('LAYOUT_NOT_FOUND', 'That layout does not exist.', HttpStatus.NOT_FOUND);
    if (t.operatorId !== operatorId) {
      throw new AppException(
        'CROSS_OPERATOR_FORBIDDEN',
        "That layout belongs to another operator.",
        HttpStatus.FORBIDDEN,
      );
    }
    return t;
  }

  list(operatorId: string, status?: string) {
    return this.repo.find({
      where: { operatorId, ...(status ? { status: status as never } : {}) },
      order: { name: 'ASC', version: 'DESC' },
    });
  }

  get(operatorId: string, id: string) {
    return this.mine(operatorId, id);
  }

  /** Every version of one layout, newest first. */
  versions(operatorId: string, familyId: string) {
    return this.repo.find({ where: { operatorId, familyId }, order: { version: 'DESC' } });
  }

  create(operatorId: string, userId: string, dto: { name: string; busType?: string; definition?: LayoutDefinition }) {
    return this.repo.save(
      this.repo.create({
        operatorId,
        familyId: randomUUID(),
        version: 1,
        name: dto.name,
        busType: dto.busType ?? null,
        status: 'DRAFT',
        definition: dto.definition ?? { decks: [{ deck: 'LOWER', items: [] }] },
        seatCount: 0,
        createdBy: userId,
      }),
    );
  }

  /**
   * Edit a draft.
   *
   * A PUBLISHED layout is deliberately immutable. Buses point at it and trips have copied it;
   * letting it change under them is how a passenger's seat 1A becomes somebody else's. To
   * change a published layout you clone it, which starts a new version.
   */
  async update(
    operatorId: string,
    id: string,
    patch: { name?: string; busType?: string; definition?: LayoutDefinition },
  ) {
    const t = await this.mine(operatorId, id);
    if (t.status !== 'DRAFT') {
      throw new AppException(
        'LAYOUT_NOT_EDITABLE',
        `This layout is ${t.status.toLowerCase()} and cannot be changed. Clone it to make a new version.`,
        HttpStatus.CONFLICT,
      );
    }
    if (patch.name !== undefined) t.name = patch.name;
    if (patch.busType !== undefined) t.busType = patch.busType;
    if (patch.definition !== undefined) {
      t.definition = patch.definition;
      t.seatCount = deriveBusSeating(patch.definition).totalSeats;
    }
    return this.repo.save(t);
  }

  /** Dry run. The builder calls this constantly so the operator sees problems as they draw. */
  async validate(operatorId: string, id: string) {
    const t = await this.mine(operatorId, id);
    const errors = validateLayout(t.definition);
    const derived = deriveBusSeating(t.definition);
    return { ok: errors.length === 0, errors, seatCount: derived.totalSeats, derived };
  }

  /**
   * Freeze it. From here the drawing may be assigned to buses.
   *
   * Everything is checked one last time, because this is the point of no return.
   */
  async publish(operatorId: string, id: string) {
    const t = await this.mine(operatorId, id);
    if (t.status === 'PUBLISHED') return t;
    if (t.status === 'ARCHIVED') {
      throw new AppException('LAYOUT_ARCHIVED', 'An archived layout cannot be published.', HttpStatus.CONFLICT);
    }

    const errors = validateLayout(t.definition);
    if (errors.length) {
      throw new AppException(
        'LAYOUT_INVALID',
        `This layout has ${errors.length} problem${errors.length > 1 ? 's' : ''} and cannot be published.`,
        HttpStatus.BAD_REQUEST,
        errors,
      );
    }

    t.status = 'PUBLISHED';
    t.publishedAt = new Date();
    t.seatCount = deriveBusSeating(t.definition).totalSeats;
    return this.repo.save(t);
  }

  /**
   * Start the next version.
   *
   * The published one stays exactly as it is — buses and trips still depend on it. The clone
   * is a fresh DRAFT with the same familyId and version + 1, so the lineage is visible.
   */
  async clone(operatorId: string, userId: string, id: string, name?: string) {
    const src = await this.mine(operatorId, id);
    const latest = await this.repo.findOne({
      where: { operatorId, familyId: src.familyId },
      order: { version: 'DESC' },
    });

    return this.repo.save(
      this.repo.create({
        operatorId,
        familyId: src.familyId,
        version: (latest?.version ?? src.version) + 1,
        name: name ?? src.name,
        busType: src.busType,
        status: 'DRAFT',
        definition: JSON.parse(JSON.stringify(src.definition)),
        seatCount: src.seatCount,
        createdBy: userId,
      }),
    );
  }

  /** Duplicate as a brand new layout family — "start from Volvo Sleeper, but it's its own thing". */
  async duplicateAsNew(operatorId: string, userId: string, id: string, name: string) {
    const src = await this.mine(operatorId, id);
    return this.repo.save(
      this.repo.create({
        operatorId,
        familyId: randomUUID(),
        version: 1,
        name,
        busType: src.busType,
        status: 'DRAFT',
        definition: JSON.parse(JSON.stringify(src.definition)),
        seatCount: src.seatCount,
        createdBy: userId,
      }),
    );
  }

  async archive(operatorId: string, id: string) {
    const t = await this.mine(operatorId, id);

    const inUse = await this.buses.count({ where: { operatorId, layoutTemplateId: t.id } });
    if (inUse > 0) {
      throw new AppException(
        'LAYOUT_IN_USE',
        `${inUse} bus${inUse > 1 ? 'es are' : ' is'} still using this layout. Move them to another version first.`,
        HttpStatus.CONFLICT,
      );
    }

    t.status = 'ARCHIVED';
    return this.repo.save(t);
  }

  /**
   * Point a bus at a published layout — and, crucially, regenerate the flat seat data the
   * booking engine has always run on.
   *
   * The booking engine, the OTA API, the gender rules and the seat map were all written
   * against `bus.seatMap: string[]`, `ladiesReservedSeats` and `seatAdjacency`. Rewriting six
   * modules to read a drawing instead would have put the money path at risk for no gain. So
   * the drawing DERIVES exactly those fields, here, at assignment time. The booking engine
   * never learns that a builder exists, and every test it already had keeps passing.
   */
  async assignToBus(operatorId: string, busId: string, templateId: string) {
    const t = await this.mine(operatorId, templateId);
    if (t.status !== 'PUBLISHED') {
      throw new AppException(
        'LAYOUT_NOT_PUBLISHED',
        'Only a published layout can be assigned to a bus.',
        HttpStatus.CONFLICT,
      );
    }

    const bus = await this.buses.findOne({ where: { id: busId } });
    if (!bus) throw new AppException('BUS_NOT_FOUND', 'That bus does not exist.', HttpStatus.NOT_FOUND);
    if (bus.operatorId !== operatorId) {
      throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'That bus belongs to another operator.', HttpStatus.FORBIDDEN);
    }

    const derived = deriveBusSeating(t.definition);
    if (!derived.totalSeats) {
      throw new AppException('LAYOUT_HAS_NO_SEATS', 'That layout has no bookable seats.', HttpStatus.BAD_REQUEST);
    }

    bus.layoutTemplateId = t.id;
    bus.layoutVersion = t.version;
    bus.seatLayout = t.definition;
    bus.seatMap = derived.seatMap;
    bus.totalSeats = derived.totalSeats;
    bus.ladiesReservedSeats = derived.ladiesReservedSeats;
    bus.maleOnlySeats = derived.maleOnlySeats;
    bus.seatAdjacency = derived.seatAdjacency;

    return this.buses.save(bus);
  }
}
