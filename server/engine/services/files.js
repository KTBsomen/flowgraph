/**
 * Files Service — Handles file writes for Activepieces pieces.
 * Pieces call ctx.files.write({ fileName, data }) and get back a file reference path.
 */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_ROOT = path.join(process.cwd(), 'data', 'files');

/**
 * Create a file service scoped to a specific run.
 * @param {string} runId — The current execution run ID
 * @param {string} [filesRoot] — Base directory for file storage
 */
function createFilesService(runId, filesRoot = DEFAULT_ROOT) {
  const runDir = path.join(filesRoot, runId);

  return {
    async write({ fileName, data }) {
      await fs.mkdir(runDir, { recursive: true });
      const hash = crypto.randomBytes(4).toString('hex');
      const safeName = `${hash}_${fileName}`;
      const filePath = path.join(runDir, safeName);
      await fs.writeFile(filePath, data);
      return filePath;
    }
  };
}

module.exports = { createFilesService };
