import { ApiError } from '../utils/ApiError.js';

export async function generateChatbotReply(messages) {
  if (!messages?.length) {
    throw new ApiError(400, 'Chat message content cannot be empty.');
  }

  return [
    'I can provide only general, local safety guidance in this privacy mode.',
    'Avoid sharing names, phone numbers, exact addresses, GPS coordinates, financial details, or other identifying information.',
    'Save evidence safely and consider contacting a trusted person, qualified lawyer, local police, or an official support service.',
    'If there is immediate danger, use your local emergency service; SatyaShield is not an emergency channel.'
  ].join(' ');
}
