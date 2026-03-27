import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { generateSecret, generateURI, generateSync, verifySync } from 'otplib';
import * as qrcode from 'qrcode';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { EmailService } from '../common/email/email.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const BCRYPT_ROUNDS = 12;
const REFRESH_TTL_DAYS = 7;
const OTP_TTL_SECONDS = 600; // 10 minutes
const EMAIL_VERIFY_TTL_HOURS = 24;
const PASSWORD_RESET_TTL_HOURS = 1;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private redis: RedisService,
    private email: EmailService,
  ) {}

  // ─── Password Helpers ─────────────────────────────────────────────────────

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // ─── M1.1 Register (creates tenant + owner + restaurant) ─────────────────

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (existingUser) throw new ConflictException('Email already registered');

    const verifyToken = uuidv4();
    const verifyExpires = new Date(Date.now() + EMAIL_VERIFY_TTL_HOURS * 60 * 60 * 1000);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.restaurantName,
        slug: this.slugify(dto.restaurantName) + '-' + uuidv4().slice(0, 6),
        plan: 'STARTER',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: dto.email,
        phone: dto.phone,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash: await this.hashPassword(dto.password),
        role: 'OWNER',
        isVerified: false,
        emailVerifyToken: verifyToken,
        emailVerifyExpires: verifyExpires,
      },
    });

    const restaurant = await this.prisma.restaurant.create({
      data: {
        tenantId: tenant.id,
        name: dto.restaurantName,
        slug: this.slugify(dto.restaurantName),
        country: dto.country || 'BD',
        currency: this.getCurrencyForCountry(dto.country),
        timezone: this.getTimezoneForCountry(dto.country),
      },
    });

    // Link the owner to their restaurant
    await this.prisma.user.update({
      where: { id: user.id },
      data: { restaurantId: restaurant.id },
    });

    // Send verification email (non-blocking)
    this.email
      .sendVerificationEmail(user.email!, user.firstName, verifyToken)
      .catch((err) => this.logger.error(`Verify email send failed: ${err.message}`));

    this.logger.log(`New tenant registered: ${tenant.slug} (${user.email})`);

    return this.generateTokenPair(user.id, user.tenantId, user.role, user.email);
  }

  // ─── M1.2 Email Verification ──────────────────────────────────────────────

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });

    if (!user) throw new BadRequestException('Invalid or expired verification token');
    if (user.emailVerifyExpires && user.emailVerifyExpires < new Date()) {
      throw new BadRequestException('Verification token has expired — request a new one');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    });

    // Bust the Redis user cache so next request sees isVerified=true
    await this.redis.del(`user:${user.id}`);

    return { message: 'Email verified successfully' };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.isVerified) throw new BadRequestException('Email already verified');
    if (!user.email) throw new BadRequestException('No email on this account');

    const verifyToken = uuidv4();
    const verifyExpires = new Date(Date.now() + EMAIL_VERIFY_TTL_HOURS * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifyToken: verifyToken, emailVerifyExpires: verifyExpires },
    });

    await this.email.sendVerificationEmail(user.email, user.firstName, verifyToken);

    return { message: 'Verification email resent' };
  }

  // ─── M1.3 Login ───────────────────────────────────────────────────────────

  async login(dto: LoginDto, deviceInfo?: string, ipAddress?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { phone: dto.identifier }],
        isActive: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await this.verifyPassword(dto.password, user.passwordHash);
    if (!passwordValid) {
      this.prisma.userLoginHistory.create({
        data: { userId: user.id, ipAddress, deviceInfo, success: false },
      }).catch(() => {});
      throw new UnauthorizedException('Invalid credentials');
    }

    // If 2FA enabled, return a short-lived pending token instead of full tokens
    if (user.twoFaEnabled) {
      const pendingToken = this.jwt.sign(
        { sub: user.id, tenantId: user.tenantId, role: user.role, email: user.email, twoFaPending: true },
        { expiresIn: '5m' },
      );
      return { requiresTwoFactor: true, pendingToken };
    }

    const tokens = await this.generateTokenPair(user.id, user.tenantId, user.role, user.email);

    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.userSession.create({
      data: { userId: user.id, refreshToken: tokens.refreshToken, deviceInfo, ipAddress, expiresAt },
    });

    await this.redis.setJson(
      `user:${user.id}`,
      { id: user.id, tenantId: user.tenantId, role: user.role, email: user.email },
      900,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.prisma.userLoginHistory.create({
      data: { userId: user.id, ipAddress, deviceInfo, success: true },
    }).catch(() => {});

    return tokens;
  }

  // ─── M0.3.2 Token Refresh ─────────────────────────────────────────────────

  async refresh(dto: RefreshTokenDto) {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken: dto.refreshToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) await this.prisma.userSession.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Refresh token expired or invalid');
    }

    const { user } = session;
    const tokens = await this.generateTokenPair(user.id, user.tenantId, user.role, user.email);

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    return tokens;
  }

  async logout(refreshToken: string) {
    await this.prisma.userSession.deleteMany({ where: { refreshToken } });
  }

  // ─── M1.4 Phone OTP Login ─────────────────────────────────────────────────

  async sendOtp(phone: string) {
    const user = await this.prisma.user.findFirst({
      where: { phone, isActive: true },
    });

    if (!user) throw new NotFoundException('No account found for this phone number');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `otp:${phone}`;

    await this.redis.setJson(key, { code, userId: user.id, attempts: 0 }, OTP_TTL_SECONDS);

    // In production: send via SMS gateway (Twilio, etc.)
    // In dev: log to console
    this.logger.log(`[OTP] Phone: ${phone} | Code: ${code} | Expires in 10 min`);

    return { message: 'OTP sent to phone number' };
  }

  async verifyOtp(phone: string, code: string, deviceInfo?: string, ipAddress?: string) {
    const key = `otp:${phone}`;
    const data = await this.redis.getJson<{ code: string; userId: string; attempts: number }>(key);

    if (!data) throw new UnauthorizedException('OTP expired or not found');

    if (data.attempts >= 3) {
      await this.redis.del(key);
      throw new UnauthorizedException('Too many attempts — request a new OTP');
    }

    if (data.code !== code) {
      await this.redis.setJson(key, { ...data, attempts: data.attempts + 1 }, OTP_TTL_SECONDS);
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.redis.del(key);

    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) throw new NotFoundException('User not found');

    const tokens = await this.generateTokenPair(user.id, user.tenantId, user.role, user.email);

    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.userSession.create({
      data: { userId: user.id, refreshToken: tokens.refreshToken, deviceInfo, ipAddress, expiresAt },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), isVerified: true },
    });

    return tokens;
  }

  // ─── M1.7 PIN Login ───────────────────────────────────────────────────────

  async setPin(userId: string, pin: string) {
    if (!/^\d{4,6}$/.test(pin)) {
      throw new BadRequestException('PIN must be 4–6 digits');
    }

    const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { pinHash },
    });

    await this.redis.del(`user:${userId}`);
    return { message: 'PIN set successfully' };
  }

  async pinLogin(restaurantId: string, pin: string, deviceInfo?: string, ipAddress?: string) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    // Find all staff in this restaurant with a PIN set
    const staffWithPins = await this.prisma.user.findMany({
      where: { restaurantId, pinHash: { not: null }, isActive: true },
    });

    let matchedUser: typeof staffWithPins[0] | null = null;
    for (const staff of staffWithPins) {
      if (await bcrypt.compare(pin, staff.pinHash!)) {
        matchedUser = staff;
        break;
      }
    }

    if (!matchedUser) throw new UnauthorizedException('Invalid PIN');

    const tokens = await this.generateTokenPair(
      matchedUser.id,
      matchedUser.tenantId,
      matchedUser.role,
      matchedUser.email,
    );

    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.userSession.create({
      data: { userId: matchedUser.id, refreshToken: tokens.refreshToken, deviceInfo, ipAddress, expiresAt },
    });

    await this.prisma.user.update({
      where: { id: matchedUser.id },
      data: { lastLoginAt: new Date() },
    });

    return tokens;
  }

  // ─── M1.8 Session Management ──────────────────────────────────────────────

  async listSessions(userId: string) {
    return this.prisma.userSession.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: { id: true, deviceInfo: true, ipAddress: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(sessionId: string, userId: string) {
    const session = await this.prisma.userSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    await this.prisma.userSession.delete({ where: { id: sessionId } });
    return { message: 'Session revoked' };
  }

  async revokeAllSessions(userId: string, exceptRefreshToken?: string) {
    const where = exceptRefreshToken
      ? { userId, NOT: { refreshToken: exceptRefreshToken } }
      : { userId };
    const { count } = await this.prisma.userSession.deleteMany({ where });
    await this.redis.del(`user:${userId}`);
    return { message: `${count} session(s) revoked` };
  }

  // ─── M1.9 Password Reset ──────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email, isActive: true } });

    // Always return success to avoid email enumeration
    if (!user) return { message: 'If that email is registered, a reset link has been sent' };

    const resetToken = uuidv4();
    const resetExpires = new Date(Date.now() + PASSWORD_RESET_TTL_HOURS * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: resetToken, passwordResetExpires: resetExpires },
    });

    await this.email.sendPasswordResetEmail(user.email!, user.firstName, resetToken);

    return { message: 'If that email is registered, a reset link has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: { passwordResetToken: dto.token },
    });

    if (!user) throw new BadRequestException('Invalid or expired reset token');
    if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
      throw new BadRequestException('Reset token has expired — request a new one');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await this.hashPassword(dto.newPassword),
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Invalidate all sessions for security
    await this.prisma.userSession.deleteMany({ where: { userId: user.id } });
    await this.redis.del(`user:${user.id}`);

    return { message: 'Password reset successfully — please log in again' };
  }

  // ─── M1.10 TOTP 2FA ───────────────────────────────────────────────────────

  async enable2FA(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.twoFaEnabled) throw new BadRequestException('2FA is already enabled');

    const secret = generateSecret();
    const account = user.email || user.phone || user.id;
    const otpauthUrl = generateURI({ secret, issuer: 'RestroCloud', label: account });
    const qrDataUrl = await qrcode.toDataURL(otpauthUrl);

    // Save secret but don't enable yet — must confirm with a valid code
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFaSecret: secret, twoFaEnabled: false },
    });

    return { secret, qrDataUrl, otpauthUrl };
  }

  async confirm2FA(userId: string, totpCode: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFaSecret) throw new BadRequestException('2FA setup not initiated');
    if (user.twoFaEnabled) throw new BadRequestException('2FA already active');

    const result = verifySync({ token: totpCode, secret: user.twoFaSecret });
    if (!result) throw new UnauthorizedException('Invalid TOTP code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFaEnabled: true },
    });

    await this.redis.del(`user:${userId}`);
    return { message: '2FA enabled successfully' };
  }

  async disable2FA(userId: string, totpCode: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFaEnabled || !user.twoFaSecret) {
      throw new BadRequestException('2FA is not enabled');
    }

    const result = verifySync({ token: totpCode, secret: user.twoFaSecret });
    if (!result) throw new UnauthorizedException('Invalid TOTP code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFaEnabled: false, twoFaSecret: null },
    });

    await this.redis.del(`user:${userId}`);
    return { message: '2FA disabled successfully' };
  }

  async verify2FA(pendingToken: string, totpCode: string, deviceInfo?: string, ipAddress?: string) {
    let payload: any;
    try {
      payload = this.jwt.verify(pendingToken, {
        secret: this.config.get('JWT_SECRET', 'restrocloud-dev-secret-change-in-prod'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired pending token');
    }

    if (!payload.twoFaPending) throw new UnauthorizedException('Not a pending 2FA token');

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.twoFaSecret || !user.twoFaEnabled) {
      throw new BadRequestException('2FA not configured for this user');
    }

    const result = verifySync({ token: totpCode, secret: user.twoFaSecret });
    if (!result) throw new UnauthorizedException('Invalid TOTP code');

    const tokens = await this.generateTokenPair(user.id, user.tenantId, user.role, user.email);

    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.userSession.create({
      data: { userId: user.id, refreshToken: tokens.refreshToken, deviceInfo, ipAddress, expiresAt },
    });

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return tokens;
  }

  // ─── User Validation (JWT Strategy) ──────────────────────────────────────

  async validateUserById(userId: string) {
    const cached = await this.redis.getJson<any>(`user:${userId}`);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { id: userId, isActive: true },
      select: { id: true, tenantId: true, role: true, email: true, restaurantId: true, isVerified: true },
    });

    if (!user) return null;

    await this.redis.setJson(`user:${user.id}`, user, 900);
    return user;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private async generateTokenPair(
    userId: string,
    tenantId: string,
    role: string,
    email: string | null,
  ) {
    const payload = { sub: userId, tenantId, role, email };

    const accessToken = this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
    });

    const refreshToken = uuidv4() + '-' + uuidv4();

    return { accessToken, refreshToken, tokenType: 'Bearer' };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private getCurrencyForCountry(country?: string): string {
    const map: Record<string, string> = {
      BD: 'BDT', IN: 'INR', US: 'USD', GB: 'GBP',
      AE: 'AED', SA: 'SAR', MY: 'MYR', SG: 'SGD',
    };
    return map[country || 'BD'] || 'USD';
  }

  private getTimezoneForCountry(country?: string): string {
    const map: Record<string, string> = {
      BD: 'Asia/Dhaka', IN: 'Asia/Kolkata', US: 'America/New_York',
      GB: 'Europe/London', AE: 'Asia/Dubai', MY: 'Asia/Kuala_Lumpur',
    };
    return map[country || 'BD'] || 'UTC';
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, isActive: true },
      select: {
        id: true,
        tenantId: true,
        restaurantId: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
        twoFaEnabled: true,
        pinHash: true,
        lastLoginAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      ...user,
      pinSet: !!user.pinHash,
      twoFactorEnabled: user.twoFaEnabled,
      pinHash: undefined,
      twoFaEnabled: undefined,
    };
  }
}
