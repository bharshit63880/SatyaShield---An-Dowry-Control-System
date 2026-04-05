import { loginAdmin } from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.auth;

  const result = await loginAdmin({ email, password });

  res.status(200).json({
    success: true,
    message: 'Login successful.',
    data: result
  });
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user
    }
  });
});
