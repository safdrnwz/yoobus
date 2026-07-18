import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Stop } from './entities/stop.entity';
import { AppException } from '../../../common/errors/app-exception';

@Injectable()
export class StopsService {
  constructor(@InjectRepository(Stop) private readonly repo: Repository<Stop>) {}
  async create(dto: any) {
    const exists = await this.repo.findOne({ where: { code: dto.code } });
    if (exists) throw new AppException('STOP_CODE_TAKEN', 'This stop code already exists', HttpStatus.CONFLICT);
    return this.repo.save(this.repo.create(dto));
  }
  findAll() { return this.repo.find({ order: { name: 'ASC' } }); }
  findByIds(ids: string[]) { return this.repo.find({ where: { id: In(ids) } }); }
}
