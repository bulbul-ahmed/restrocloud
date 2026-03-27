import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SetPinDto } from './dto/set-pin.dto';
import { PinLoginDto } from './dto/pin-login.dto';
import { TotpVerifyDto } from './dto/totp-verify.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/roles.decorator';

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  // ─── M1.1 Register ────────────────────────────────────────────────────────

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register new restaurant owner (creates tenant + restaurant)' })
  @ApiResponse({ status: 201, description: 'Tokens returned; verification email sent' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // ─── M1.2 Email Verification ──────────────────────────────────────────────

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with token from verification email (M1.2)' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification link (M1.2)' })
  async resendVerification(@CurrentUser() user: any) {
    return this.authService.resendVerification(user.id);
  }

  // ─── M1.3 Login ───────────────────────────────────────────────────────────

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/phone + password (M1.3)' })
  @ApiResponse({ status: 200, description: 'Tokens, or {requiresTwoFactor:true,pendingToken} if 2FA enabled' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.headers['user-agent'], req.ip);
  }

  // ─── M1.4 Phone OTP Login ─────────────────────────────────────────────────

  @Post('send-otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send 6-digit OTP to phone number (M1.4)' })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phone);
  }

  @Post('verify-otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify phone OTP and receive tokens (M1.4)' })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.authService.verifyOtp(dto.phone, dto.code, req.headers['user-agent'], req.ip);
  }

  // ─── M0.3.2 Token Refresh ─────────────────────────────────────────────────

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout — invalidate refresh token' })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
  }

  // ─── M1.7 PIN Login ───────────────────────────────────────────────────────

  @Post('set-pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set or change 4–6 digit POS PIN for current user (M1.7)' })
  async setPin(@CurrentUser() user: any, @Body() dto: SetPinDto) {
    return this.authService.setPin(user.id, dto.pin);
  }

  @Post('pin-login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Quick PIN login for POS terminal (M1.7)' })
  async pinLogin(@Body() dto: PinLoginDto, @Req() req: Request) {
    return this.authService.pinLogin(dto.restaurantId, dto.pin, req.headers['user-agent'], req.ip);
  }

  // ─── M1.8 Session Management ──────────────────────────────────────────────

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all active sessions for current user (M1.8)' })
  async listSessions(@CurrentUser() user: any) {
    return this.authService.listSessions(user.id);
  }

  @Delete('sessions/all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all sessions (logout everywhere) (M1.8)' })
  async revokeAllSessions(@CurrentUser() user: any, @Body() dto: RefreshTokenDto) {
    return this.authService.revokeAllSessions(user.id, dto.refreshToken);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific session by ID (M1.8)' })
  async revokeSession(@Param('id') sessionId: string, @CurrentUser() user: any) {
    return this.authService.revokeSession(sessionId, user.id);
  }

  // ─── M1.9 Password Reset ──────────────────────────────────────────────────

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email (M1.9)' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token from email (M1.9)' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ─── M1.10 TOTP 2FA ───────────────────────────────────────────────────────

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start 2FA setup — returns TOTP secret + QR code (M1.10)' })
  async enable2FA(@CurrentUser() user: any) {
    return this.authService.enable2FA(user.id);
  }

  @Post('2fa/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm 2FA activation with TOTP code (M1.10)' })
  async confirm2FA(@CurrentUser() user: any, @Body() dto: TotpVerifyDto) {
    return this.authService.confirm2FA(user.id, dto.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA with current TOTP code (M1.10)' })
  async disable2FA(@CurrentUser() user: any, @Body() dto: TotpVerifyDto) {
    return this.authService.disable2FA(user.id, dto.code);
  }

  @Post('2fa/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete 2FA login — submit TOTP code with pendingToken (M1.10)' })
  async verify2FA(@Body() dto: { pendingToken: string; code: string }, @Req() req: Request) {
    return this.authService.verify2FA(dto.pendingToken, dto.code, req.headers['user-agent'], req.ip);
  }

  // ─── Me ───────────────────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async me(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id);
  }
}
