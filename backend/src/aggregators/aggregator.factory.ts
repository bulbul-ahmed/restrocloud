import { Injectable, BadRequestException } from '@nestjs/common';
import { IAggregatorAdapter } from './interfaces/aggregator-adapter.interface';
import { FoodpandaAdapter } from './adapters/foodpanda.adapter';
import { PathaoAdapter } from './adapters/pathao.adapter';

/**
 * M17.1 — Factory that returns the correct IAggregatorAdapter for a given platform.
 * All aggregators implement the same interface.
 */
@Injectable()
export class AggregatorFactory {
  private readonly adapters: Map<string, IAggregatorAdapter>;

  constructor(
    private readonly foodpanda: FoodpandaAdapter,
    private readonly pathao: PathaoAdapter,
  ) {
    this.adapters = new Map<string, IAggregatorAdapter>([
      ['foodpanda', foodpanda],
      ['pathao', pathao],
    ]);
  }

  getAdapter(platform: string): IAggregatorAdapter {
    const adapter = this.adapters.get(platform.toLowerCase());
    if (!adapter) {
      throw new BadRequestException(
        `Unsupported aggregator platform: "${platform}". Supported: ${this.getSupportedPlatforms().join(', ')}`,
      );
    }
    return adapter;
  }

  getSupportedPlatforms(): string[] {
    return Array.from(this.adapters.keys());
  }
}
