import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FuelCard, FuelTransaction } from './entities/fuel.entities';
import { FuelCardDto, FuelTxnDto } from './dto/fuel.dto';
import { AppException } from '../../../common/errors/app-exception';
import { efficiencyVariancePct, fuelCost, mileage } from '../../../common/logic/fuel.util';

/** Operator fuel management: transactions, cards, and efficiency reporting. */
@Injectable()
export class FuelService {
  constructor(
    @InjectRepository(FuelTransaction) private readonly txnRepo: Repository<FuelTransaction>,
    @InjectRepository(FuelCard) private readonly cardRepo: Repository<FuelCard>,
  ) {}

  createTransaction(operatorId: string, dto: FuelTxnDto): Promise<FuelTransaction> {
    const cost = fuelCost(dto.litres, dto.pricePerLitre ?? 0);
    return this.txnRepo.save(this.txnRepo.create({
      operatorId, busId: dto.busId, type: dto.type as any, litres: dto.litres,
      pricePerLitre: dto.pricePerLitre ?? 0, cost, odometerKm: dto.odometerKm ?? null,
      note: dto.note ?? null, status: 'PENDING',
    }));
  }

  async approveTransaction(operatorId: string, id: string): Promise<FuelTransaction> {
    const t = await this.txnRepo.findOne({ where: { id } });
    if (!t || t.operatorId !== operatorId) throw new AppException('FUEL_TXN_NOT_FOUND', 'Fuel transaction not found.', HttpStatus.NOT_FOUND);
    if (t.status === 'APPROVED') throw new AppException('FUEL_TXN_APPROVED', 'This transaction is already approved.', HttpStatus.BAD_REQUEST);
    t.status = 'APPROVED';
    return this.txnRepo.save(t);
  }

  listTransactions(operatorId: string): Promise<FuelTransaction[]> {
    return this.txnRepo.find({ where: { operatorId }, order: { recordedAt: 'DESC' } });
  }

  /** Computes mileage between the two most recent refills for a bus and its variance. */
  async efficiencyReport(operatorId: string, busId: string, benchmarkMileage = 4) {
    const refills = await this.txnRepo.find({
      where: { operatorId, busId, type: 'REFILL' },
      order: { recordedAt: 'DESC' },
      take: 2,
    });
    if (refills.length < 2 || refills[0].odometerKm == null || refills[1].odometerKm == null) {
      return { busId, available: false, message: 'Need at least two refills with odometer readings.' };
    }
    const distance = Number(refills[0].odometerKm) - Number(refills[1].odometerKm);
    const litres = Number(refills[0].litres);
    const actual = mileage(distance, litres);
    return {
      busId, available: true, distanceKm: distance, litres,
      mileageKmPerLitre: actual,
      benchmarkKmPerLitre: benchmarkMileage,
      variancePct: efficiencyVariancePct(actual, benchmarkMileage),
    };
  }

  // Fuel cards
  createCard(operatorId: string, dto: FuelCardDto): Promise<FuelCard> {
    return this.cardRepo.save(this.cardRepo.create({ operatorId, cardNumber: dto.cardNumber, busId: dto.busId ?? null, status: 'ACTIVE' }));
  }
  async setCardStatus(operatorId: string, id: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<FuelCard> {
    const c = await this.cardRepo.findOne({ where: { id } });
    if (!c || c.operatorId !== operatorId) throw new AppException('FUEL_CARD_NOT_FOUND', 'Fuel card not found.', HttpStatus.NOT_FOUND);
    c.status = status;
    return this.cardRepo.save(c);
  }
  listCards(operatorId: string): Promise<FuelCard[]> {
    return this.cardRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' } });
  }
}
