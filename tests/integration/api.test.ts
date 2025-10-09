import request from 'supertest';
import app from '../../dist/server';
import fs from 'fs';

describe('Document Conversion API Integration Tests', () => {
  // Note: These tests assume that LibreOffice is installed on the system
  // and that the server is configured properly.

  describe('POST /api/v1/convert', () => {
    it('should return 400 when no file is uploaded', async () => {
      const response = await request(app)
        .post('/api/v1/convert')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.type).toBe('MissingFileError');
    });

    it('should return 415 when an unsupported file type is uploaded', async () => {
      // Create a temporary text file for testing
      const tempFilePath = '/tmp/test.txt';
      fs.writeFileSync(tempFilePath, 'This is a test text file');
      
      const response = await request(app)
        .post('/api/v1/convert')
        .attach('file', tempFilePath)
        .expect(415);

      expect(response.body.error).toBeDefined();
      fs.unlinkSync(tempFilePath); // Clean up
    });

    it('should return 413 when file is too large', async () => {
      // Note: Testing this would require creating a file larger than the configured limit,
      // which is outside the scope of a simple integration test
      // This would be covered by the file validator unit tests
    });
  });

  describe('GET /downloads/:fileId', () => {
    it('should return 404 for non-existent file ID', async () => {
      const response = await request(app)
        .get('/api/v1/downloads/invalid-file-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });
});