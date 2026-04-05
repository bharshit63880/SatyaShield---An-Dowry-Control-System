import { generateChatbotReply } from '../services/chatbot.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createChatbotReply = asyncHandler(async (req, res) => {
  const reply = await generateChatbotReply(req.validated.chat.messages);

  res.status(200).json({
    success: true,
    data: {
      message: reply
    }
  });
});
