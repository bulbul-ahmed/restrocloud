import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { EarnPointsDto } from './dto/earn-points.dto';
import { RedeemPointsDto } from './dto/redeem-points.dto';

@ApiTags('customers')
@Controller('restaurants/:restaurantId/customers')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
@ApiParam({ name: 'restaurantId', description: 'Restaurant UUID' })
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  // ─── M8.1 Create customer ─────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.CASHIER)
  @ApiOperation({ summary: 'Create a new customer (CASHIER+). Auto-creates loyalty account.' })
  create(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.createCustomer(tenantId, restaurantId, user.role as UserRole, dto);
  }

  // ─── M8.2 List customers ──────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List customers with optional search (name/phone/email) and pagination' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: ListCustomersQueryDto,
  ) {
    return this.customersService.listCustomers(tenantId, restaurantId, query);
  }

  // ─── M8.3 Get customer detail ─────────────────────────────────────────────

  @Get(':customerId')
  @ApiOperation({ summary: 'Get customer detail with addresses, loyalty account, and recent orders' })
  findOne(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.customersService.getCustomer(tenantId, restaurantId, customerId);
  }

  // ─── M8.4 Update customer ─────────────────────────────────────────────────

  @Patch(':customerId')
  @Roles(UserRole.CASHIER)
  @ApiOperation({ summary: 'Update customer details (CASHIER+)' })
  update(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('customerId') customerId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.updateCustomer(tenantId, restaurantId, customerId, user.role as UserRole, dto);
  }

  // ─── M8.5 Blacklist toggle ────────────────────────────────────────────────

  @Patch(':customerId/blacklist')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Toggle customer blacklist status (MANAGER+)' })
  toggleBlacklist(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('customerId') customerId: string,
    @CurrentUser() user: any,
  ) {
    return this.customersService.toggleBlacklist(tenantId, restaurantId, customerId, user.role as UserRole);
  }

  // ─── M8.6 Address CRUD ────────────────────────────────────────────────────

  @Post(':customerId/addresses')
  @Roles(UserRole.CASHIER)
  @ApiOperation({ summary: 'Add a delivery address for a customer (CASHIER+)' })
  addAddress(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('customerId') customerId: string,
    @Body() dto: CreateAddressDto,
  ) {
    return this.customersService.addAddress(tenantId, restaurantId, customerId, dto);
  }

  @Get(':customerId/addresses')
  @ApiOperation({ summary: 'List all addresses for a customer (default first)' })
  listAddresses(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.customersService.listAddresses(tenantId, restaurantId, customerId);
  }

  @Patch(':customerId/addresses/:addressId')
  @Roles(UserRole.CASHIER)
  @ApiOperation({ summary: 'Update a customer address (CASHIER+)' })
  updateAddress(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('customerId') customerId: string,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.customersService.updateAddress(tenantId, restaurantId, customerId, addressId, dto);
  }

  @Delete(':customerId/addresses/:addressId')
  @Roles(UserRole.CASHIER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a customer address (CASHIER+)' })
  deleteAddress(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('customerId') customerId: string,
    @Param('addressId') addressId: string,
  ) {
    return this.customersService.deleteAddress(tenantId, restaurantId, customerId, addressId);
  }

  // ─── M8.7–M8.9 Loyalty ───────────────────────────────────────────────────

  @Get(':customerId/loyalty')
  @ApiOperation({ summary: 'Get loyalty account with last 20 transactions' })
  getLoyalty(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.customersService.getLoyalty(tenantId, restaurantId, customerId);
  }

  @Post(':customerId/loyalty/earn')
  @Roles(UserRole.CASHIER)
  @ApiOperation({
    summary: 'Earn loyalty points (CASHIER+). Provide amount (floor(amount/10) pts) or points directly.',
  })
  earnPoints(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('customerId') customerId: string,
    @CurrentUser() user: any,
    @Body() dto: EarnPointsDto,
  ) {
    return this.customersService.earnPoints(tenantId, restaurantId, customerId, user.role as UserRole, dto);
  }

  @Post(':customerId/loyalty/redeem')
  @Roles(UserRole.CASHIER)
  @ApiOperation({ summary: 'Redeem loyalty points (CASHIER+). 1 point = ৳1 discount.' })
  redeemPoints(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('customerId') customerId: string,
    @CurrentUser() user: any,
    @Body() dto: RedeemPointsDto,
  ) {
    return this.customersService.redeemPoints(tenantId, restaurantId, customerId, user.role as UserRole, dto);
  }

  // ─── M8.10 Order history ──────────────────────────────────────────────────

  @Get(':customerId/orders')
  @ApiOperation({ summary: 'Customer order history with pagination' })
  getOrderHistory(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('customerId') customerId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.customersService.getOrderHistory(
      tenantId,
      restaurantId,
      customerId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }
}
