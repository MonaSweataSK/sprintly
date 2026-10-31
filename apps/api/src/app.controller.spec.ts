import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health/health.controller.js';

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  describe('check', () => {
    it('returns the healthy status payload', () => {
      expect(healthController.check()).toEqual({ status: 'ok' });
    });
  });
});
