import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '../lib/user-client.js';
import { jwtRequired, type JwtRequest } from '../middleware/jwt.js';
import { telegramIdOrIp } from '../lib/express-helpers.js';
import { logger } from '../lib/logger.js';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('invalid type'));
    }
  },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => telegramIdOrIp(req),
  message: { error: 'too many uploads, slow down' },
});

export const uploadRouter = Router();

uploadRouter.post('/photo', jwtRequired, uploadLimiter, (req: JwtRequest, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'file too large, max 10 MB' });
      return res.status(400).json({ error: 'upload error' });
    }
    if (err) return res.status(400).json({ error: err.message });

    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'no file' });

      const type = await fileTypeFromBuffer(file.buffer);
      if (!type || !ALLOWED_MIMES.includes(type.mime)) {
        return res.status(400).json({ error: 'invalid image format — only JPEG, PNG, WebP' });
      }

      const telegramId = req.jwtPayload!.telegram_id;
      const ext = type.ext;
      const filePath = `${telegramId}/${randomUUID()}.${ext}`;

      const db = getSupabaseAdmin();
      const { error: uploadErr } = await db.storage.from('order-images').upload(filePath, file.buffer, {
        contentType: type.mime,
        upsert: false,
      });

      if (uploadErr) {
        logger.error({ error: uploadErr.message }, 'storage upload failed');
        return res.status(500).json({ error: 'upload failed' });
      }

      const { data: publicUrl } = db.storage.from('order-images').getPublicUrl(filePath);

      return res.json({ url: publicUrl.publicUrl, path: filePath });
    } catch (e) {
      logger.error({ error: e instanceof Error ? e.message : 'unknown' }, 'upload error');
      return res.status(500).json({ error: 'upload failed' });
    }
  });
});
