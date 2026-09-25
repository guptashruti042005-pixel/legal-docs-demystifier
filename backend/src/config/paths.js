const path = require('path');
const os = require('os');
const fs = require('fs');

/**
 * Detect if running in a serverless environment (e.g. Vercel, AWS Lambda).
 */
const isServerless = Boolean(
  process.env.VERCEL === '1' ||
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);

/**
 * Resolves the uploads directory path:
 * - On Vercel / serverless: /tmp is the only writable directory; /var/task is read-only.
 * - On local development: project's local 'backend/uploads' directory.
 */
const getUploadsDir = () => {
  const dir = isServerless
    ? path.join(os.tmpdir(), 'uploads')
    : path.resolve(__dirname, '..', '..', 'uploads');

  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      console.warn(`[Paths] Warning: Could not create uploads directory at ${dir}: ${err.message}`);
    }
  }

  return dir;
};

const uploadsDir = getUploadsDir();

module.exports = {
  isServerless,
  uploadsDir,
  getUploadsDir
};
