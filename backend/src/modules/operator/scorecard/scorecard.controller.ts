import { Controller, Get, Param } from '@nestjs/common';
import { ScorecardService } from './scorecard.service';
import { Public } from '../../../common/decorators/public.decorator';

/** Public transparency: anyone can see an operator's quality scorecard. */
@Controller()
export class ScorecardController {
  constructor(private readonly scorecard: ScorecardService) {}

  @Public() @Get('operators/:id/scorecard')
  scorecard_(@Param('id') id: string) { return this.scorecard.forOperator(id); }

  @Public() @Get('operators/scorecards/leaderboard')
  leaderboard() { return this.scorecard.leaderboard(); }
}
