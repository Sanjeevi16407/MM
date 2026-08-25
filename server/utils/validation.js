/**
 * Validation and sanitization utilities for MingleMonkey🐒
 */

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const DISALLOWED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.bin', '.msi', '.com', '.vbs', '.js', '.jar', '.scr', '.ps1'
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_MESSAGE_LENGTH = 2000;
const MAX_NICKNAME_LENGTH = 25;
const MIN_NICKNAME_LENGTH = 2;

function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .trim();
}

function validateNickname(nickname) {
  if (!nickname || typeof nickname !== 'string') {
    return { valid: false, error: 'Nickname is required' };
  }
  const clean = nickname.trim();
  if (clean.length < MIN_NICKNAME_LENGTH) {
    return { valid: false, error: `Nickname must be at least ${MIN_NICKNAME_LENGTH} characters` };
  }
  if (clean.length > MAX_NICKNAME_LENGTH) {
    return { valid: false, error: `Nickname must be at most ${MAX_NICKNAME_LENGTH} characters` };
  }
  // Allow alphanumeric, underscores, hyphens, and spaces
  const regex = /^[a-zA-Z0-9_\- ]+$/;
  if (!regex.test(clean)) {
    return { valid: false, error: 'Nickname can only contain letters, numbers, hyphens, and underscores' };
  }
  return { valid: true, nickname: clean };
}

function validateMessage(content, attachment) {
  const cleanContent = typeof content === 'string' ? content.trim() : '';
  
  if (!cleanContent && !attachment) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (cleanContent.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message exceeds maximum limit of ${MAX_MESSAGE_LENGTH} characters` };
  }

  if (attachment) {
    const fileValidation = validateAttachment(attachment);
    if (!fileValidation.valid) {
      return fileValidation;
    }
  }

  return { valid: true, content: sanitizeText(cleanContent), attachment };
}

function validateAttachment(attachment) {
  if (!attachment || typeof attachment !== 'object') {
    return { valid: false, error: 'Invalid attachment data' };
  }

  const { name, type, size, data } = attachment;

  if (!data || typeof data !== 'string') {
    return { valid: false, error: 'Attachment file data is missing' };
  }

  // Check file extension
  if (name && typeof name === 'string') {
    const lowerName = name.toLowerCase();
    for (const ext of DISALLOWED_EXTENSIONS) {
      if (lowerName.endsWith(ext)) {
        return { valid: false, error: `Executable or script files (${ext}) are not allowed` };
      }
    }
  }

  // Validate size
  if (size && size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds the 5MB limit' };
  }

  // Validate mime type if provided
  if (type && !ALLOWED_MIME_TYPES.includes(type) && !type.startsWith('image/')) {
    return { valid: false, error: 'File type is not supported' };
  }

  return { valid: true };
}

module.exports = {
  sanitizeText,
  validateNickname,
  validateMessage,
  validateAttachment,
  MAX_MESSAGE_LENGTH,
  MAX_FILE_SIZE
};
