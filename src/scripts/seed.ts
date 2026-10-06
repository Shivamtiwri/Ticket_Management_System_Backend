import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from '../models/User';
import { UserRole } from '../types';
import { logger } from '../utils/logger';

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ticket_management');
  logger.info('Connected to database');

  // Create admin
  const admin = await User.findOne({ email: 'admin@example.com' });
  if (!admin) {
    await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'Admin@123',
      role: UserRole.ADMIN,
    });
    logger.info('Admin user created: admin@example.com / Admin@123');
  }

  // Create agent
  const agent = await User.findOne({ email: 'agent@example.com' });
  if (!agent) {
    await User.create({
      name: 'Support Agent',
      email: 'agent@example.com',
      password: 'Agent@123',
      role: UserRole.AGENT,
    });
    logger.info('Agent user created: agent@example.com / Agent@123');
  }

  // Create customer
  const customer = await User.findOne({ email: 'customer@example.com' });
  if (!customer) {
    await User.create({
      name: 'Test Customer',
      email: 'customer@example.com',
      password: 'Customer@123',
      role: UserRole.CUSTOMER,
    });
    logger.info('Customer user created: customer@example.com / Customer@123');
  }

  logger.info('Seeding complete!');
  await mongoose.connection.close();
};

seed().catch((err) => {
  logger.error('Seed failed:', err);
  process.exit(1);
});
