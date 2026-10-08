import { Router } from 'express';
import { getActivityLogs } from '../controllers/activity.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { activityQueryValidator } from '../validators/activity.validators';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate);
router.get('/', authorize(UserRole.ADMIN), validate(activityQueryValidator), getActivityLogs);

export default router;
