import { TicketStatus, UserRole } from '../types';

type TransitionMap = {
  [key in TicketStatus]: TicketStatus[];
};

const AGENT_TRANSITIONS: TransitionMap = {
  [TicketStatus.OPEN]: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
  [TicketStatus.ASSIGNED]: [TicketStatus.IN_PROGRESS, TicketStatus.WAITING_FOR_USER],
  [TicketStatus.IN_PROGRESS]: [TicketStatus.WAITING_FOR_USER, TicketStatus.RESOLVED],
  [TicketStatus.WAITING_FOR_USER]: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
  [TicketStatus.RESOLVED]: [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS],
  [TicketStatus.CLOSED]: [],
};

const CUSTOMER_TRANSITIONS: TransitionMap = {
  [TicketStatus.OPEN]: [],
  [TicketStatus.ASSIGNED]: [],
  [TicketStatus.IN_PROGRESS]: [],
  [TicketStatus.WAITING_FOR_USER]: [TicketStatus.IN_PROGRESS],
  [TicketStatus.RESOLVED]: [TicketStatus.CLOSED],
  [TicketStatus.CLOSED]: [],
};

export const isValidTransition = (
  currentStatus: TicketStatus,
  newStatus: TicketStatus,
  role: UserRole
): boolean => {
  if (role === UserRole.ADMIN) return true;
  const transitions = role === UserRole.CUSTOMER ? CUSTOMER_TRANSITIONS : AGENT_TRANSITIONS;
  return transitions[currentStatus]?.includes(newStatus) ?? false;
};

export const getAllowedTransitions = (currentStatus: TicketStatus, role: UserRole): TicketStatus[] => {
  if (role === UserRole.ADMIN) {
    return Object.values(TicketStatus).filter(s => s !== currentStatus);
  }
  const transitions = role === UserRole.CUSTOMER ? CUSTOMER_TRANSITIONS : AGENT_TRANSITIONS;
  return transitions[currentStatus] ?? [];
};
