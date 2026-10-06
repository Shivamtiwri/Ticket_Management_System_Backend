import { Router } from 'express';
import { getCustomerDashboard, getAgentDashboard, getAdminDashboard } from '../controllers/dashboard.controller';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate);

router.get('/customer', authorize(UserRole.CUSTOMER), getCustomerDashboard);
router.get('/agent', authorize(UserRole.AGENT), getAgentDashboard);
router.get('/admin', authorize(UserRole.ADMIN), getAdminDashboard);

export default router;
