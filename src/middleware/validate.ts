import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(validations.map((v) => v.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        errors: errors.array().map((e) => ({ field: (e as any).path, message: e.msg })),
      });
      return;
    }
    next();
  };
};
