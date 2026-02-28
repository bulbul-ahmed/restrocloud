import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnlineOrderingService } from './online-ordering.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { CustomerJwtAuthGuard } from './guards/customer-jwt-auth.guard';
import { CurrentCustomer } from './decorators/current-customer.decorator';
import { PushService } from '../push/push.service';
import { RegisterTokenDto } from '../push/dto/register-token.dto';
import { DeregisterTokenDto } from '../push/dto/deregister-token.dto';

/**
 * Customer-facing auth routes for online ordering.
 * No staff JwtAuthGuard — uses CustomerJwtAuthGuard.
 */
@ApiTags('online-ordering-auth')
@Controller('online/:slug')
export class OnlineOrderingAuthController {
  constructor(
    private readonly svc: OnlineOrderingService,
    private readonly push: PushService,
  ) {}

  // ─── M13.4a Register ──────────────────────────────────────────────────
  @Post('auth/register')
  @ApiOperation({ summary: 'Register a new customer account for online ordering' })
  register(
    @Param('slug') slug: string,
    @Body() dto: RegisterCustomerDto,
  ) {
    return this.svc.registerCustomer(slug, dto);
  }

  // ─── M13.4b Login ─────────────────────────────────────────────────────
  @Post('auth/login')
  @ApiOperation({ summary: 'Login with email + password — returns customer JWT' })
  login(
    @Param('slug') slug: string,
    @Body() dto: LoginCustomerDto,
  ) {
    return this.svc.loginCustomer(slug, dto);
  }

  // ─── M13.4c Me ────────────────────────────────────────────────────────
  @Get('auth/me')
  @ApiOperation({ summary: 'Get authenticated customer profile' })
  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  me(@CurrentCustomer() customer: any) {
    return this.svc.getCustomerProfile(customer.customerId);
  }

  // ─── M13.10 Update profile ────────────────────────────────────────────
  @Patch('auth/me')
  @ApiOperation({ summary: 'Update customer profile (name, phone, password)' })
  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  updateProfile(
    @CurrentCustomer() customer: any,
    @Body() dto: UpdateCustomerProfileDto,
  ) {
    return this.svc.updateCustomerProfile(customer.customerId, dto);
  }

  // ─── M25.3 Register customer device token ────────────────────────────
  @Post('auth/device-token')
  @ApiOperation({ summary: 'Register customer device push token' })
  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  registerDeviceToken(
    @Param('slug') slug: string,
    @CurrentCustomer() customer: any,
    @Body() dto: RegisterTokenDto,
  ) {
    return this.push.registerCustomerToken(
      customer.customerId,
      customer.restaurantId,
      customer.tenantId,
      dto.token,
      dto.platform,
    );
  }

  // ─── M25.3 Deregister customer device token ───────────────────────────
  @Delete('auth/device-token')
  @ApiOperation({ summary: 'Deregister customer device push token (on logout)' })
  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  deregisterDeviceToken(
    @CurrentCustomer() customer: any,
    @Body() dto: DeregisterTokenDto,
  ) {
    return this.push.deregisterCustomerToken(customer.customerId, dto.token);
  }

  // ─── M13.9 Order history ─────────────────────────────────────────────
  @Get('my/orders')
  @ApiOperation({ summary: 'Get customer order history (requires customer JWT)' })
  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  orderHistory(
    @CurrentCustomer() customer: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.getOrderHistory(
      customer.customerId,
      customer.restaurantId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }
}
