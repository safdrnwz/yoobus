import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Roles(Role.CUSTOMER) @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateReviewDto) {
    return this.reviews.create(userId, dto);
  }

  @Public() @Get('operator/:operatorId')
  list(@Param('operatorId') operatorId: string) {
    return this.reviews.listByOperator(operatorId);
  }

  @Public() @Get('operator/:operatorId/rating')
  rating(@Param('operatorId') operatorId: string) {
    return this.reviews.operatorRating(operatorId);
  }
}
