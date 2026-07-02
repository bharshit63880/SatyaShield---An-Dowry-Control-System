import { generateChatbotReply } from '../services/chatbot.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const createChatbotReply = asyncHandler(async (req, res) => {
  const reply = await generateChatbotReply(req.validated.chat.messages);

  return sendSuccess(res, {
    message: 'Chatbot reply generated successfully.',
    data: {
      message: reply
    }
  });
});
