import { Router } from 'express';
import { register, login, getMe, logout, changePassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { registerValidator, loginValidator } from '../validators/auth.validators';
import { authLimiter } from '../middleware/rateLimiter';
import { changePasswordValidator } from '../validators/user.validators';

const router = Router();

router.post('/register', authLimiter, validate(registerValidator), register);
router.post('/login', authLimiter, validate(loginValidator), login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.patch('/change-password', authenticate, validate(changePasswordValidator), changePassword);

export default router;
