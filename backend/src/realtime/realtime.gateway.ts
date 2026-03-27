import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * M0.5 — Real-Time Communication
 * Room-based broadcasting per restaurant/tenant.
 * Events: new_order, order_status_change, item_out_of_stock
 *
 * Auth is optional — staff connect with JWT (join tenant room),
 * customers/guests connect without token (join per-order room via join_order).
 */
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket gateway initialized');
  }

  async handleConnection(client: Socket) {
    const token =
      client.handshake.auth.token ||
      client.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      // Guest / customer without JWT — allowed to connect, no rooms yet
      this.logger.log(`Guest socket connected: ${client.id}`);
      return;
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET', 'restrocloud-dev-secret-change-in-prod'),
      });

      (client as any).user = payload;
      (client as any).tenantId = payload.tenantId;

      const tenantRoom = `tenant:${payload.tenantId}`;
      await client.join(tenantRoom);

      this.logger.log(
        `Client connected: ${client.id} — User: ${payload.sub ?? payload.customerId} — Tenant: ${payload.tenantId}`,
      );
    } catch {
      // Invalid token — allow connection but without any room membership
      this.logger.warn(`Socket ${client.id} connected with invalid token — no rooms joined`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Join a specific restaurant room for targeted broadcasts (staff)
   */
  @SubscribeMessage('join_restaurant')
  async handleJoinRestaurant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { restaurantId: string },
  ) {
    const restaurantRoom = `restaurant:${data.restaurantId}`;
    await client.join(restaurantRoom);
    this.logger.log(`Socket ${client.id} joined room: ${restaurantRoom}`);
    client.emit('room_joined', { room: restaurantRoom });
    return { success: true, room: restaurantRoom };
  }

  @SubscribeMessage('join_kitchen')
  async handleJoinKitchen(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { restaurantId: string },
  ) {
    const kitchenRoom = `kitchen:${data.restaurantId}`;
    await client.join(kitchenRoom);
    client.emit('room_joined', { room: kitchenRoom });
    return { success: true, room: kitchenRoom };
  }

  /**
   * Join a per-order room for customer order tracking.
   * Validates ownership via cartToken (guests) or customerId (logged-in customers).
   */
  @SubscribeMessage('join_order')
  async handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string; cartToken?: string; customerId?: string },
  ) {
    const { orderId, cartToken, customerId } = data;

    if (!orderId) return { success: false, error: 'orderId required' };

    // Verify the caller owns this order
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { cartToken: true, customerId: true },
    });

    if (!order) return { success: false, error: 'Order not found' };

    const ownsViaCart = cartToken && order.cartToken === cartToken;
    const ownsViaCustomer = customerId && order.customerId === customerId;

    if (!ownsViaCart && !ownsViaCustomer) {
      return { success: false, error: 'Unauthorized' };
    }

    const orderRoom = `order:${orderId}`;
    await client.join(orderRoom);
    this.logger.log(`Socket ${client.id} joined order room: ${orderRoom}`);
    client.emit('room_joined', { room: orderRoom });
    return { success: true, room: orderRoom };
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    return { event: 'pong', timestamp: new Date().toISOString() };
  }
}
