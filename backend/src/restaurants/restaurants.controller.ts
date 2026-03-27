import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { UpdateHoursDto } from './dto/update-hours.dto';
import { UpdateTaxDto } from './dto/update-tax.dto';
import { UpdateServiceChargeDto } from './dto/update-service-charge.dto';
import { UpdateDeliverySettingsDto } from './dto/update-delivery-settings.dto';
import { UpdateTipOptionsDto } from './dto/update-tip-options.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { UpdateOrderTypesDto } from './dto/update-order-types.dto';
import { UpdateAutoAcceptDto } from './dto/update-auto-accept.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

@ApiTags('restaurants')
@Controller('restaurants')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class RestaurantsController {
  constructor(private restaurantsService: RestaurantsService) {}

  // ─── M2.1 Profile CRUD ────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Create a new restaurant branch (OWNER only) (M2.1)' })
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() caller: any,
    @Body() dto: CreateRestaurantDto,
  ) {
    return this.restaurantsService.create(tenantId, caller.role, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all restaurants for current tenant (M2.1)' })
  findAll(@CurrentTenant() tenantId: string) {
    return this.restaurantsService.findByTenant(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single restaurant with all config (M2.1)' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.restaurantsService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Update restaurant profile (name, address, logo, currency, timezone, locale) (M2.1 / M2.4 / M2.10)' })
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRestaurantDto,
  ) {
    return this.restaurantsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a restaurant branch (OWNER only) (M2.1)' })
  deactivate(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.restaurantsService.deactivate(tenantId, id);
  }

  // ─── Logo upload ──────────────────────────────────────────────────────────

  @Post(':id/logo')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Upload restaurant logo from local file (MANAGER+)' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = path.join(process.cwd(), 'uploads', 'logos');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase() || '.png';
          cb(null, `logo-${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new BadRequestException('Only JPEG, PNG, WebP or SVG files allowed'), false);
      },
    }),
  )
  async uploadLogo(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const logoUrl = `/uploads/logos/${file.filename}`;
    await this.restaurantsService.update(tenantId, id, { logoUrl });
    return { logoUrl };
  }

  // ─── Wordmark logo upload ─────────────────────────────────────────────────

  @Post(':id/logo-wordmark')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Upload horizontal wordmark / banner logo (MANAGER+)' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = path.join(process.cwd(), 'uploads', 'logos');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase() || '.png';
          cb(null, `wordmark-${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new BadRequestException('Only JPEG, PNG, WebP or SVG files allowed'), false);
      },
    }),
  )
  async uploadLogoWordmark(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const logoWordmarkUrl = `/uploads/logos/${file.filename}`;
    await this.restaurantsService.update(tenantId, id, { logoWordmarkUrl });
    return { logoWordmarkUrl };
  }

  // ─── Generic image upload (menu items, categories, etc.) ─────────────────

  @Post(':id/upload-image')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Upload an image file, returns a URL (MANAGER+)' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = path.join(process.cwd(), 'uploads', 'menu');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
          cb(null, `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new BadRequestException('Only JPEG, PNG, WebP or GIF files allowed'), false);
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return { url: `/uploads/menu/${file.filename}` };
  }

  // ─── M2.2 Operating Hours ─────────────────────────────────────────────────

  @Patch(':id/hours')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Update operating hours + holiday overrides (M2.2)' })
  updateHours(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateHoursDto,
  ) {
    return this.restaurantsService.updateHours(tenantId, id, dto);
  }

  @Get(':id/hours/status')
  @ApiOperation({ summary: 'Check if restaurant is currently open (M2.2)' })
  isOpenNow(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.restaurantsService.isOpenNow(tenantId, id);
  }

  // ─── M2.3 Tax Configuration ───────────────────────────────────────────────

  @Patch(':id/tax')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update VAT/GST rate and inclusive/exclusive mode (M2.3)' })
  updateTax(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaxDto,
  ) {
    return this.restaurantsService.updateTax(tenantId, id, dto);
  }

  // ─── M2.5 Service Charge ──────────────────────────────────────────────────

  @Patch(':id/service-charge')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update service charge percentage (M2.5)' })
  updateServiceCharge(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateServiceChargeDto,
  ) {
    return this.restaurantsService.updateServiceCharge(tenantId, id, dto);
  }

  @Patch(':id/delivery-settings')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update delivery fee and minimum order amount' })
  updateDeliverySettings(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDeliverySettingsDto,
  ) {
    return this.restaurantsService.updateDeliverySettings(tenantId, id, dto);
  }

  // ─── M2.6 Tip Options ────────────────────────────────────────────────────

  @Patch(':id/tip-options')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Update suggested tip percentages (M2.6)' })
  updateTipOptions(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTipOptionsDto,
  ) {
    return this.restaurantsService.updateTipOptions(tenantId, id, dto);
  }

  // ─── M2.7 Receipt Configuration ───────────────────────────────────────────

  @Patch(':id/receipt')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Update receipt header, footer, and display options (M2.7)' })
  updateReceipt(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReceiptDto,
  ) {
    return this.restaurantsService.updateReceipt(tenantId, id, dto);
  }

  // ─── M2.8 Order Types ─────────────────────────────────────────────────────

  @Patch(':id/order-types')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Enable/disable order channels (dine-in, takeaway, delivery, etc.) (M2.8)' })
  updateOrderTypes(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrderTypesDto,
  ) {
    return this.restaurantsService.updateOrderTypes(tenantId, id, dto);
  }

  // ─── M2.9 Auto-Accept ─────────────────────────────────────────────────────

  @Patch(':id/auto-accept')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Toggle auto-accept per order channel (M2.9)' })
  updateAutoAccept(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAutoAcceptDto,
  ) {
    return this.restaurantsService.updateAutoAccept(tenantId, id, dto);
  }

  // ─── M16.3 Auto-accept timer ──────────────────────────────────────────────

  @Patch(':id/auto-accept-timer')
  @Roles(UserRole.MANAGER)
  @ApiOperation({
    summary: 'Set auto-accept timer per channel (M16.3). pos/qr/online: minutes (0=disabled). Requires autoAccept enabled for that channel.',
  })
  updateAutoAcceptTimer(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: Record<string, number>,
  ) {
    return this.restaurantsService.updateAutoAcceptTimer(tenantId, id, dto);
  }

  @Get(':id/auto-accept-timer')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Get current auto-accept timer config (M16.3)' })
  getAutoAcceptTimer(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.restaurantsService.getAutoAcceptTimer(tenantId, id);
  }

  // ─── QR Settings ──────────────────────────────────────────────────────────

  @Patch(':id/qr-settings')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Set QR base URL for table ordering (MVP #3)' })
  updateQrBaseUrl(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { qrBaseUrl?: string | null },
  ) {
    return this.restaurantsService.updateQrBaseUrl(tenantId, id, body.qrBaseUrl ?? null);
  }

  // ─── Payment Gateways ─────────────────────────────────────────────────────

  @Get(':id/payment-gateways')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'List payment gateway credentials for this restaurant (MVP #8)' })
  listPaymentGateways(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.restaurantsService.listPaymentGateways(tenantId, id);
  }

  @Patch(':id/payment-gateways/:gateway')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Create or update payment gateway credentials (MVP #8)' })
  upsertPaymentGateway(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('gateway') gateway: string,
    @Body() dto: { apiKey?: string; secretKey?: string; webhookSecret?: string; isLive?: boolean; isActive?: boolean },
  ) {
    return this.restaurantsService.upsertPaymentGateway(tenantId, id, gateway, dto);
  }
}
