import { Router } from 'express';
import { getActivityLogs } from '../controllers/activity.controller';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate);
router.get('/', authorize(UserRole.ADMIN), getActivityLogs);

export default router;
