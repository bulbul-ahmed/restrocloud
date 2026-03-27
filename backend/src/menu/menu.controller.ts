import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { MenuService } from './menu.service';

@ApiTags('menu — full menu')
@Controller('restaurants/:restaurantId/menu')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth('access-token')
@ApiParam({ name: 'restaurantId', description: 'Restaurant UUID' })
export class MenuController {
  constructor(private menuService: MenuService) {}

  @Get()
  @ApiOperation({
    summary: 'Get full menu tree — categories → items → modifier groups → modifiers (cached 60s)',
  })
  @ApiResponse({ status: 200, description: 'Nested menu structure' })
  getMenu(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.menuService.getFullMenu(tenantId, restaurantId);
  }
}
