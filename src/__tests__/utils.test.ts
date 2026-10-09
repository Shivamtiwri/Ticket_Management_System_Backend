import {
  buildSearchRegex,
  escapeRegex,
  isObjectIdString,
  ticketIdFilter,
} from '../utils/queryUtils';
import { getAllowedTransitions, isValidTransition } from '../utils/statusTransitions';
import { generateTicketId } from '../utils/ticketId';
import { TicketStatus, UserRole } from '../types';

describe('ticket query utilities', () => {
  it('escapes user-provided regex syntax and builds a case-insensitive search', () => {
    expect(escapeRegex('a+b.test')).toBe('a\\+b\\.test');
    expect(buildSearchRegex('  A+B.test ').test('prefix a+b.TEST suffix')).toBe(true);
    expect(buildSearchRegex('a+b.test').test('aaabXtest')).toBe(false);
  });

  it('accepts exactly 24 hexadecimal characters as an ObjectId string', () => {
    expect(isObjectIdString('507f1f77bcf86cd799439011')).toBe(true);
    expect(isObjectIdString('507f1f77bcf86cd79943901z')).toBe(false);
    expect(isObjectIdString('short')).toBe(false);
  });

  it('matches public ticket IDs and adds an ObjectId branch only for valid IDs', () => {
    expect(ticketIdFilter('TKT-123')).toEqual({ $or: [{ ticketId: 'TKT-123' }] });
    expect(ticketIdFilter('507f1f77bcf86cd799439011')).toEqual({
      $or: [
        { ticketId: '507f1f77bcf86cd799439011' },
        { _id: '507f1f77bcf86cd799439011' },
      ],
    });
  });
});

describe('ticket status transitions', () => {
  it('applies agent and customer transition rules and permits administrator transitions', () => {
    expect(isValidTransition(TicketStatus.OPEN, TicketStatus.ASSIGNED, UserRole.AGENT)).toBe(true);
    expect(isValidTransition(TicketStatus.CLOSED, TicketStatus.OPEN, UserRole.AGENT)).toBe(false);
    expect(isValidTransition(TicketStatus.OPEN, TicketStatus.ASSIGNED, UserRole.CUSTOMER)).toBe(false);
    expect(isValidTransition(TicketStatus.RESOLVED, TicketStatus.CLOSED, UserRole.CUSTOMER)).toBe(true);
    expect(isValidTransition(TicketStatus.CLOSED, TicketStatus.OPEN, UserRole.ADMIN)).toBe(true);
  });

  it('returns only possible next statuses for non-admin users', () => {
    expect(getAllowedTransitions(TicketStatus.OPEN, UserRole.CUSTOMER)).toEqual([]);
    expect(getAllowedTransitions(TicketStatus.OPEN, UserRole.AGENT)).toEqual([
      TicketStatus.ASSIGNED,
      TicketStatus.IN_PROGRESS,
    ]);
    expect(getAllowedTransitions(TicketStatus.OPEN, UserRole.ADMIN)).not.toContain(TicketStatus.OPEN);
  });
});

describe('ticket ID generation', () => {
  it('emits the stable TKT-prefixed uppercase format', () => {
    expect(generateTicketId()).toMatch(/^TKT-[A-Z0-9]+-[A-Z0-9]{1,4}$/);
  });
});
