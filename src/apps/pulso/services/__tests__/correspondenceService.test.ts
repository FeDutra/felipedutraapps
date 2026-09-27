import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCorrespondenceMetrics,
  filterAndSearchSubscribers,
  formatCorrespondenceDate,
  toJsDate
} from '../correspondenceHelpers.ts';
import type { CorrespondenceSubscriberClient } from '../../types/correspondence.types.ts';

describe('Correspondence Frontend Service - Pure Functions', () => {
  const sampleSubscribers: CorrespondenceSubscriberClient[] = [
    {
      id: 'hash1',
      name: 'Alice Silva',
      email: 'alice@example.com',
      source: 'landing',
      status: 'active',
      createdAt: new Date('2026-09-20T10:00:00Z'),
      confirmedAt: new Date('2026-09-20T10:05:00Z'),
      lastDeliveryStatus: 'welcome_sent'
    },
    {
      id: 'hash2',
      name: 'Bob Santos',
      email: 'bob@example.com',
      source: 'web',
      status: 'pending',
      createdAt: new Date('2026-09-21T12:00:00Z'),
      confirmedAt: null,
      lastDeliveryStatus: 'confirmation_sent'
    },
    {
      id: 'hash3',
      name: null,
      email: 'charlie@example.com',
      source: 'direct',
      status: 'error',
      errorCode: 'RESEND_API_ERROR',
      createdAt: new Date('2026-09-22T14:00:00Z'),
      lastDeliveryStatus: 'failed'
    },
    {
      id: 'hash4',
      name: 'Daniela Lima',
      email: 'daniela@example.com',
      source: 'web',
      status: 'unsubscribed',
      createdAt: new Date('2026-09-18T08:00:00Z'),
      confirmedAt: new Date('2026-09-18T09:00:00Z'),
      unsubscribedAt: new Date('2026-09-22T15:00:00Z')
    }
  ];

  describe('computeCorrespondenceMetrics', () => {
    test('calculates correct totals for all states', () => {
      const metrics = computeCorrespondenceMetrics(sampleSubscribers);
      assert.equal(metrics.total, 4);
      assert.equal(metrics.active, 1);
      assert.equal(metrics.pending, 1);
      assert.equal(metrics.error, 1);
      assert.equal(metrics.unsubscribed, 1);
    });

    test('handles empty list gracefully', () => {
      const metrics = computeCorrespondenceMetrics([]);
      assert.deepEqual(metrics, {
        total: 0,
        active: 0,
        pending: 0,
        error: 0,
        unsubscribed: 0
      });
    });
  });

  describe('filterAndSearchSubscribers', () => {
    test('returns all subscribers when filter is all and search is empty', () => {
      const result = filterAndSearchSubscribers(sampleSubscribers, 'all', '');
      assert.equal(result.length, 4);
    });

    test('filters by status correctly', () => {
      const activeOnly = filterAndSearchSubscribers(sampleSubscribers, 'active', '');
      assert.equal(activeOnly.length, 1);
      assert.equal(activeOnly[0].email, 'alice@example.com');

      const pendingOnly = filterAndSearchSubscribers(sampleSubscribers, 'pending', '');
      assert.equal(pendingOnly.length, 1);
      assert.equal(pendingOnly[0].email, 'bob@example.com');
    });

    test('searches by name, email, or source case-insensitively', () => {
      const searchName = filterAndSearchSubscribers(sampleSubscribers, 'all', 'alice');
      assert.equal(searchName.length, 1);
      assert.equal(searchName[0].id, 'hash1');

      const searchEmail = filterAndSearchSubscribers(sampleSubscribers, 'all', 'CHARLIE');
      assert.equal(searchEmail.length, 1);
      assert.equal(searchEmail[0].id, 'hash3');

      const searchSource = filterAndSearchSubscribers(sampleSubscribers, 'all', 'landing');
      assert.equal(searchSource.length, 1);
      assert.equal(searchSource[0].id, 'hash1');
    });

    test('combines status filter and search query', () => {
      const combined = filterAndSearchSubscribers(sampleSubscribers, 'active', 'daniela');
      assert.equal(combined.length, 0); // Daniela is unsubscribed, not active

      const match = filterAndSearchSubscribers(sampleSubscribers, 'unsubscribed', 'daniela');
      assert.equal(match.length, 1);
    });
  });

  describe('toJsDate and formatCorrespondenceDate', () => {
    test('handles JS Date, string, and Firestore timestamp object', () => {
      const now = new Date('2026-09-27T18:30:00Z');
      assert.ok(toJsDate(now) instanceof Date);

      const strDate = '2026-09-27T18:30:00Z';
      assert.ok(toJsDate(strDate) instanceof Date);

      const firestoreMock = {
        toDate: () => new Date('2026-09-27T18:30:00Z')
      };
      assert.ok(toJsDate(firestoreMock) instanceof Date);

      const secondsMock = { seconds: 1727461800 };
      assert.ok(toJsDate(secondsMock) instanceof Date);

      assert.equal(toJsDate(null), null);
      assert.equal(toJsDate(undefined), null);
    });

    test('formatCorrespondenceDate returns dash for empty date and formatted string for valid date', () => {
      assert.equal(formatCorrespondenceDate(null), '—');
      const formatted = formatCorrespondenceDate(new Date('2026-09-27T18:30:00Z'));
      assert.ok(formatted.length > 5);
      assert.notEqual(formatted, '—');
    });
  });
});
