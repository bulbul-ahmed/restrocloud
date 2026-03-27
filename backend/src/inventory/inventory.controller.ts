import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MovementType, POStatus, UserRole } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { SetRecipeDto } from './dto/set-recipe.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { LogWasteDto } from './dto/log-waste.dto';
import { StockTakeDto } from './dto/stock-take.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireFeature } from '../common/decorators/plan-feature.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('inventory')
@Controller('restaurants/:restaurantId/inventory')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PlanGuard)
@RequireFeature('inventory')
@Roles(UserRole.MANAGER)
@ApiBearerAuth('access-token')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  // ─── M20.1 Ingredients ───────────────────────────────────────────────────

  @Get('ingredients')
  @ApiOperation({ summary: 'List ingredients (M20.1)' })
  listIngredients(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('lowStockOnly') lowStockOnly?: string,
  ) {
    return this.svc.listIngredients(tenantId, restaurantId, { search, category, lowStockOnly });
  }

  @Post('ingredients')
  @ApiOperation({ summary: 'Create ingredient (M20.1)' })
  createIngredient(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: CreateIngredientDto,
  ) {
    return this.svc.createIngredient(tenantId, restaurantId, dto);
  }

  @Get('ingredients/:id')
  @ApiOperation({ summary: 'Get ingredient (M20.1)' })
  getIngredient(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
  ) {
    return this.svc.getIngredient(tenantId, restaurantId, id);
  }

  @Patch('ingredients/:id')
  @ApiOperation({ summary: 'Update ingredient (M20.1)' })
  updateIngredient(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateIngredientDto,
  ) {
    return this.svc.updateIngredient(tenantId, restaurantId, id, dto);
  }

  @Delete('ingredients/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete (soft) ingredient (M20.1)' })
  deleteIngredient(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
  ) {
    return this.svc.deleteIngredient(tenantId, restaurantId, id);
  }

  // ─── M20.2 Recipes ───────────────────────────────────────────────────────

  @Get('recipes/items/:itemId')
  @ApiOperation({ summary: 'Get recipe for menu item (M20.2)' })
  getRecipe(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.svc.getRecipe(tenantId, restaurantId, itemId);
  }

  @Post('recipes/items/:itemId')
  @ApiOperation({ summary: 'Set recipe for menu item (M20.2)' })
  setRecipe(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('itemId') itemId: string,
    @Body() dto: SetRecipeDto,
  ) {
    return this.svc.setRecipe(tenantId, restaurantId, itemId, dto);
  }

  @Delete('recipes/items/:itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete recipe for menu item (M20.2)' })
  deleteRecipe(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.svc.deleteRecipe(tenantId, restaurantId, itemId);
  }

  // ─── M20.5 Suppliers ─────────────────────────────────────────────────────

  @Get('suppliers')
  @ApiOperation({ summary: 'List suppliers (M20.5)' })
  listSuppliers(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.svc.listSuppliers(tenantId, restaurantId);
  }

  @Post('suppliers')
  @ApiOperation({ summary: 'Create supplier (M20.5)' })
  createSupplier(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: CreateSupplierDto,
  ) {
    return this.svc.createSupplier(tenantId, restaurantId, dto);
  }

  @Get('suppliers/:id')
  @ApiOperation({ summary: 'Get supplier (M20.5)' })
  getSupplier(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
  ) {
    return this.svc.getSupplier(tenantId, restaurantId, id);
  }

  @Patch('suppliers/:id')
  @ApiOperation({ summary: 'Update supplier (M20.5)' })
  updateSupplier(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.svc.updateSupplier(tenantId, restaurantId, id, dto);
  }

  @Delete('suppliers/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete supplier (M20.5)' })
  deleteSupplier(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
  ) {
    return this.svc.deleteSupplier(tenantId, restaurantId, id);
  }

  // ─── M20.6+M20.7 Purchase Orders ─────────────────────────────────────────

  @Get('purchase-orders')
  @ApiOperation({ summary: 'List purchase orders (M20.6)' })
  listPurchaseOrders(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query('status') status?: POStatus,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.svc.listPurchaseOrders(tenantId, restaurantId, { status, supplierId });
  }

  @Post('purchase-orders')
  @ApiOperation({ summary: 'Create purchase order (M20.6)' })
  createPurchaseOrder(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.svc.createPurchaseOrder(tenantId, restaurantId, dto);
  }

  @Get('purchase-orders/:id')
  @ApiOperation({ summary: 'Get purchase order (M20.6)' })
  getPurchaseOrder(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
  ) {
    return this.svc.getPurchaseOrder(tenantId, restaurantId, id);
  }

  @Patch('purchase-orders/:id')
  @ApiOperation({ summary: 'Update purchase order (M20.6, DRAFT only)' })
  updatePurchaseOrder(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @Body() body: { notes?: string; expectedDate?: string; supplierId?: string },
  ) {
    return this.svc.updatePurchaseOrder(tenantId, restaurantId, id, body);
  }

  @Patch('purchase-orders/:id/receive')
  @ApiOperation({ summary: 'Receive stock against purchase order (M20.7)' })
  receivePurchaseOrder(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseOrderDto,
  ) {
    return this.svc.receivePurchaseOrder(tenantId, restaurantId, id, dto);
  }

  @Patch('purchase-orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel purchase order (M20.6)' })
  cancelPurchaseOrder(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
  ) {
    return this.svc.cancelPurchaseOrder(tenantId, restaurantId, id);
  }

  // ─── M20.8+M20.9 Stock movements ─────────────────────────────────────────

  @Get('stock/movements')
  @ApiOperation({ summary: 'List stock movements (M20.8)' })
  listMovements(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query('ingredientId') ingredientId?: string,
    @Query('type') type?: MovementType,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.listStockMovements(tenantId, restaurantId, {
      ingredientId,
      type,
      dateFrom,
      dateTo,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('stock/waste')
  @ApiOperation({ summary: 'Log waste (M20.9)' })
  logWaste(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: LogWasteDto,
  ) {
    return this.svc.logWaste(tenantId, restaurantId, user.id, dto);
  }

  @Post('stock/take')
  @ApiOperation({ summary: 'Conduct stock take (M20.8)' })
  conductStockTake(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: StockTakeDto,
  ) {
    return this.svc.conductStockTake(tenantId, restaurantId, user.id, dto);
  }

  // ─── M20.10+M20.11 Reports ───────────────────────────────────────────────

  @Get('reports/food-cost')
  @ApiOperation({ summary: 'Food cost report (M20.10)' })
  getFoodCostReport(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: InventoryQueryDto,
  ) {
    return this.svc.getFoodCostReport(tenantId, restaurantId, query);
  }

  @Get('reports/variance')
  @ApiOperation({ summary: 'Usage variance report (M20.11)' })
  getUsageVariance(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: InventoryQueryDto,
  ) {
    return this.svc.getUsageVariance(tenantId, restaurantId, query);
  }
}
